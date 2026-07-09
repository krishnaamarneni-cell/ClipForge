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

  // Try 2: Download audio and transcribe with Groq Whisper
  if (!process.env.GROQ_API_KEY) {
    throw new Error('No captions available for this video and no Groq API key set for Whisper transcription.');
  }

  console.log('[transcript] Downloading audio for Whisper transcription...');
  const audioBuffer = await downloadYouTubeAudio(videoId);

  if (audioBuffer.byteLength > 25 * 1024 * 1024) {
    throw new Error('Video audio is too large for auto-transcription (>25MB). Try a shorter video or upload the audio file directly.');
  }

  console.log(`[transcript] Audio downloaded: ${(audioBuffer.byteLength / 1024 / 1024).toFixed(1)}MB. Sending to Whisper...`);
  return await transcribeWithWhisper(audioBuffer);
}

async function downloadYouTubeAudio(videoId: string): Promise<Buffer> {
  const ytdl = (await import('ytdl-core')).default;
  const url = `https://www.youtube.com/watch?v=${videoId}`;

  if (!ytdl.validateURL(url)) {
    throw new Error('Invalid YouTube URL');
  }

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalSize = 0;
    const maxSize = 25 * 1024 * 1024;

    const stream = ytdl(url, {
      filter: 'audioonly',
      quality: 'lowestaudio',
    });

    const timeout = setTimeout(() => {
      stream.destroy();
      reject(new Error('Audio download timed out (30s). Try a shorter video.'));
    }, 30000);

    stream.on('data', (chunk: Buffer) => {
      totalSize += chunk.length;
      if (totalSize > maxSize) {
        stream.destroy();
        clearTimeout(timeout);
        reject(new Error('Audio file too large (>25MB). Try a shorter video or upload audio directly.'));
        return;
      }
      chunks.push(chunk);
    });

    stream.on('end', () => {
      clearTimeout(timeout);
      resolve(Buffer.concat(chunks));
    });

    stream.on('error', (err: Error) => {
      clearTimeout(timeout);
      reject(new Error(`Failed to download audio: ${err.message}`));
    });
  });
}

async function transcribeWithWhisper(audioBuffer: Buffer): Promise<TranscriptSegment[]> {
  const Groq = (await import('groq-sdk')).default;
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const file = new File([audioBuffer], 'audio.webm', { type: 'audio/webm' });

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
