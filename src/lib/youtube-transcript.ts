import { YoutubeTranscript } from 'youtube-transcript';
import type { TranscriptSegment } from '@/types';

export async function fetchYouTubeTranscript(videoId: string): Promise<TranscriptSegment[]> {
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

    if (msg.includes('disabled')) {
      throw new Error(
        'Captions are disabled on this video. Most YouTube videos have auto-generated captions — this one doesn\'t. ' +
        'Try a different video, or download the audio and upload it directly for Whisper transcription.'
      );
    }

    throw new Error(`Could not fetch YouTube captions: ${msg}`);
  }

  throw new Error('No caption data found for this video.');
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
