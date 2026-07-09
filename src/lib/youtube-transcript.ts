import { YoutubeTranscript } from 'youtube-transcript';
import type { TranscriptSegment } from '@/types';

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://piped-api.privacy.com.de',
  'https://pipedapi.in.projectsegfau.lt',
];

export async function fetchYouTubeTranscript(videoId: string): Promise<TranscriptSegment[]> {
  // Try 1: Fetch existing YouTube captions (free, instant)
  try {
    const raw = await YoutubeTranscript.fetchTranscript(videoId);
    if (raw && raw.length > 0) {
      console.log(`[transcript] Got ${raw.length} caption segments from YouTube`);
      return raw.map((item, i) => {
        const start = item.offset / 1000;
        const duration = item.duration / 1000;
        const end = i < raw.length - 1
          ? raw[i + 1].offset / 1000
          : start + duration;

        return {
          start: Math.round(start * 100) / 100,
          end: Math.round(end * 100) / 100,
          text: decodeHtmlEntities(item.text),
        };
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.log(`[transcript] YouTube captions unavailable: ${msg}`);
  }

  // Try 2: Download audio via Piped proxy and transcribe with Groq Whisper
  if (!process.env.GROQ_API_KEY) {
    throw new Error('No captions available and no Groq API key for Whisper transcription. Add your Groq API key in Settings.');
  }

  console.log('[transcript] Captions unavailable — downloading audio via Piped proxy...');
  const audioBuffer = await downloadViaPiped(videoId);

  console.log(`[transcript] Audio downloaded: ${(audioBuffer.byteLength / 1024 / 1024).toFixed(1)}MB. Sending to Whisper...`);
  return await transcribeWithWhisper(audioBuffer);
}

async function downloadViaPiped(videoId: string): Promise<Buffer> {
  let lastError = '';

  for (const instance of PIPED_INSTANCES) {
    try {
      console.log(`[piped] Trying ${instance}...`);
      const res = await fetch(`${instance}/streams/${videoId}`, {
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        lastError = `${instance} returned ${res.status}`;
        continue;
      }

      const data = await res.json();
      const audioStreams = data.audioStreams;

      if (!audioStreams || audioStreams.length === 0) {
        lastError = `${instance} returned no audio streams`;
        continue;
      }

      // Pick smallest audio stream to minimize download time and stay under Whisper 25MB limit
      const sorted = [...audioStreams].sort(
        (a: { bitrate: number }, b: { bitrate: number }) => a.bitrate - b.bitrate
      );
      const stream = sorted[0];

      console.log(`[piped] Downloading audio: ${stream.quality || stream.bitrate + 'bps'}, ${stream.mimeType}`);

      const audioRes = await fetch(stream.url, {
        signal: AbortSignal.timeout(30000),
      });

      if (!audioRes.ok) {
        lastError = `Audio download failed: ${audioRes.status}`;
        continue;
      }

      const arrayBuffer = await audioRes.arrayBuffer();

      if (arrayBuffer.byteLength > 25 * 1024 * 1024) {
        throw new Error('Audio file too large (>25MB). Try a shorter video or upload audio directly.');
      }

      return Buffer.from(arrayBuffer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('too large')) throw err;
      lastError = msg;
      console.log(`[piped] ${instance} failed: ${msg}`);
    }
  }

  throw new Error(`Could not download audio from any Piped instance. Last error: ${lastError}`);
}

async function transcribeWithWhisper(audioBuffer: Buffer): Promise<TranscriptSegment[]> {
  const Groq = (await import('groq-sdk')).default;
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const file = new File([new Uint8Array(audioBuffer)], 'audio.webm', { type: 'audio/webm' });

  const response = await groq.audio.transcriptions.create({
    file,
    model: 'whisper-large-v3',
    response_format: 'verbose_json',
    timestamp_granularities: ['segment'],
  });

  const segments = (response as unknown as {
    segments?: Array<{ start: number; end: number; text: string }>;
  }).segments ?? [];

  console.log(`[transcript] Whisper returned ${segments.length} segments`);

  return segments.map((seg) => ({
    start: Math.round(seg.start * 100) / 100,
    end: Math.round(seg.end * 100) / 100,
    text: seg.text.trim(),
  }));
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}
