import { YoutubeTranscript } from 'youtube-transcript';
import type { TranscriptSegment } from '@/types';

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

  // Try 2: Download audio via Invidious/Piped proxy and transcribe with Groq Whisper
  if (!process.env.GROQ_API_KEY) {
    throw new Error('No captions available and no Groq API key for Whisper transcription. Add your Groq API key in Settings.');
  }

  console.log('[transcript] Captions unavailable — downloading audio via proxy...');
  const audioBuffer = await downloadViaProxy(videoId);

  console.log(`[transcript] Audio downloaded: ${(audioBuffer.byteLength / 1024 / 1024).toFixed(1)}MB. Sending to Whisper...`);
  return await transcribeWithWhisper(audioBuffer);
}

async function getInvidiousInstances(): Promise<string[]> {
  try {
    const res = await fetch('https://api.invidious.io/instances.json', {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data as [string, { api: boolean; type: string; uri: string }][])
      .filter(([, info]) => info.api && info.type === 'https')
      .slice(0, 8)
      .map(([, info]) => info.uri);
  } catch {
    return [];
  }
}

async function getPipedInstances(): Promise<string[]> {
  try {
    const res = await fetch('https://piped-instances.kavin.rocks', {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data as { api_url: string; name: string }[])
      .filter((i) => i.api_url)
      .slice(0, 6)
      .map((i) => i.api_url.replace(/\/$/, ''));
  } catch {
    return [];
  }
}

async function tryInvidiousInstance(instance: string, videoId: string): Promise<Buffer | null> {
  try {
    const res = await fetch(`${instance}/api/v1/videos/${videoId}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();

    const formats = data.adaptiveFormats;
    if (!formats || !Array.isArray(formats)) return null;

    const audioFormats = formats.filter((f: { type: string }) =>
      f.type?.startsWith('audio/')
    );
    if (audioFormats.length === 0) return null;

    audioFormats.sort((a: { bitrate: number }, b: { bitrate: number }) =>
      (a.bitrate || 0) - (b.bitrate || 0)
    );
    const audio = audioFormats[0];

    console.log(`[invidious] Downloading: ${audio.type}, ${audio.bitrate}bps`);
    const audioRes = await fetch(audio.url, { signal: AbortSignal.timeout(30000) });
    if (!audioRes.ok) return null;

    const buf = await audioRes.arrayBuffer();
    if (buf.byteLength > 25 * 1024 * 1024) {
      throw new Error('Audio too large (>25MB). Try a shorter video.');
    }
    return Buffer.from(buf);
  } catch (err) {
    if (err instanceof Error && err.message.includes('too large')) throw err;
    return null;
  }
}

async function tryPipedInstance(instance: string, videoId: string): Promise<Buffer | null> {
  try {
    const res = await fetch(`${instance}/streams/${videoId}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();

    const audioStreams = data.audioStreams;
    if (!audioStreams || !Array.isArray(audioStreams) || audioStreams.length === 0) return null;

    audioStreams.sort((a: { bitrate: number }, b: { bitrate: number }) =>
      (a.bitrate || 0) - (b.bitrate || 0)
    );
    const audio = audioStreams[0];

    console.log(`[piped] Downloading: ${audio.mimeType}, ${audio.bitrate}bps`);
    const audioRes = await fetch(audio.url, { signal: AbortSignal.timeout(30000) });
    if (!audioRes.ok) return null;

    const buf = await audioRes.arrayBuffer();
    if (buf.byteLength > 25 * 1024 * 1024) {
      throw new Error('Audio too large (>25MB). Try a shorter video.');
    }
    return Buffer.from(buf);
  } catch (err) {
    if (err instanceof Error && err.message.includes('too large')) throw err;
    return null;
  }
}

async function downloadViaProxy(videoId: string): Promise<Buffer> {
  // Fetch live instance lists in parallel
  const [invidiousInstances, pipedInstances] = await Promise.all([
    getInvidiousInstances(),
    getPipedInstances(),
  ]);

  console.log(`[proxy] Found ${invidiousInstances.length} Invidious + ${pipedInstances.length} Piped instances`);

  // Try Invidious instances first (more reliable for audio)
  for (const instance of invidiousInstances) {
    console.log(`[proxy] Trying Invidious: ${instance}`);
    const buf = await tryInvidiousInstance(instance, videoId);
    if (buf) return buf;
  }

  // Then Piped instances
  for (const instance of pipedInstances) {
    console.log(`[proxy] Trying Piped: ${instance}`);
    const buf = await tryPipedInstance(instance, videoId);
    if (buf) return buf;
  }

  throw new Error(
    `Could not download audio — tried ${invidiousInstances.length + pipedInstances.length} proxy instances. ` +
    'The video may be region-locked or age-restricted. Try uploading the audio file directly.'
  );
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
