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
    console.log(`[transcript] YouTube captions unavailable: ${err instanceof Error ? err.message : err}`);
  }

  // Try 2: Download audio via InnerTube and transcribe with Groq Whisper
  if (!process.env.GROQ_API_KEY) {
    throw new Error('No captions available for this video and no Groq API key set for Whisper transcription.');
  }

  console.log('[transcript] Downloading audio via InnerTube for Whisper transcription...');
  const audioBuffer = await downloadYouTubeAudio(videoId);

  if (audioBuffer.byteLength > 25 * 1024 * 1024) {
    throw new Error('Video audio is too large for auto-transcription (>25MB). Try a shorter video or upload the audio file directly.');
  }

  console.log(`[transcript] Audio downloaded: ${(audioBuffer.byteLength / 1024 / 1024).toFixed(1)}MB. Sending to Whisper...`);
  return await transcribeWithWhisper(audioBuffer);
}

async function downloadYouTubeAudio(videoId: string): Promise<Buffer> {
  const { Innertube } = await import('youtubei.js');
  const yt = await Innertube.create({ retrieve_player: true, generate_session_locally: true });

  const info = await yt.getBasicInfo(videoId);

  const format = info.chooseFormat({ type: 'audio', quality: 'best' });
  if (!format) {
    throw new Error('No audio format available for this video');
  }

  const stream = await yt.download(videoId, {
    type: 'audio',
    quality: 'best',
  });

  const chunks: Uint8Array[] = [];
  let totalSize = 0;
  const maxSize = 25 * 1024 * 1024;

  const reader = stream.getReader();
  const timeout = setTimeout(() => {
    reader.cancel();
  }, 35000);

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalSize += value.byteLength;
      if (totalSize > maxSize) {
        await reader.cancel();
        throw new Error('Audio file too large (>25MB). Try a shorter video or upload audio directly.');
      }
      chunks.push(value);
    }
  } finally {
    clearTimeout(timeout);
  }

  const combined = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return Buffer.from(combined);
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
