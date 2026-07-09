import { YoutubeTranscript } from 'youtube-transcript';
import type { TranscriptSegment } from '@/types';

export async function fetchYouTubeTranscript(videoId: string): Promise<TranscriptSegment[]> {
  const raw = await YoutubeTranscript.fetchTranscript(videoId);

  if (!raw || raw.length === 0) return [];

  return raw.map((item, i) => {
    const start = item.offset / 1000;
    const duration = item.duration / 1000;
    const end = i < raw.length - 1
      ? raw[i + 1].offset / 1000
      : start + duration;

    return {
      start: Math.round(start * 100) / 100,
      end: Math.round(end * 100) / 100,
      text: item.text
        .replace(/&#39;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim(),
    };
  });
}
