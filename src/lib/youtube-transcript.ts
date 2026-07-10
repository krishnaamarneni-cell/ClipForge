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

async function tryInnerTubeDirectly(videoId: string): Promise<Buffer | null> {
  // Use YouTube's InnerTube API with iOS client — bypasses bot detection
  const INNERTUBE_CLIENTS = [
    {
      name: 'IOS',
      body: {
        context: {
          client: {
            clientName: 'IOS',
            clientVersion: '19.29.1',
            deviceMake: 'Apple',
            deviceModel: 'iPhone16,2',
            hl: 'en',
            gl: 'US',
            userAgent: 'com.google.ios.youtube/19.29.1 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X;)',
          },
        },
        videoId,
        playbackContext: { contentPlaybackContext: { html5Preference: 'HTML5_PREF_WANTS' } },
        contentCheckOk: true,
        racyCheckOk: true,
      },
    },
    {
      name: 'ANDROID',
      body: {
        context: {
          client: {
            clientName: 'ANDROID',
            clientVersion: '19.29.37',
            androidSdkVersion: 30,
            hl: 'en',
            gl: 'US',
            userAgent: 'com.google.android.youtube/19.29.37 (Linux; U; Android 11) gzip',
          },
        },
        videoId,
        playbackContext: { contentPlaybackContext: { html5Preference: 'HTML5_PREF_WANTS' } },
        contentCheckOk: true,
        racyCheckOk: true,
      },
    },
    {
      name: 'TV_EMBEDDED',
      body: {
        context: {
          client: {
            clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER',
            clientVersion: '2.0',
            hl: 'en',
            gl: 'US',
          },
          thirdParty: { embedUrl: 'https://www.google.com' },
        },
        videoId,
        playbackContext: { contentPlaybackContext: { html5Preference: 'HTML5_PREF_WANTS' } },
        contentCheckOk: true,
        racyCheckOk: true,
      },
    },
  ];

  for (const client of INNERTUBE_CLIENTS) {
    try {
      console.log(`[innertube] Trying ${client.name} client...`);
      const res = await fetch(
        'https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8&prettyPrint=false',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': (client.body.context.client as { userAgent?: string }).userAgent || 'Mozilla/5.0',
            'X-YouTube-Client-Name': client.name === 'IOS' ? '5' : client.name === 'ANDROID' ? '3' : '85',
            'X-YouTube-Client-Version': client.body.context.client.clientVersion,
          },
          body: JSON.stringify(client.body),
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!res.ok) {
        console.log(`[innertube] ${client.name}: HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();
      const formats = data?.streamingData?.adaptiveFormats;
      if (!formats || !Array.isArray(formats) || formats.length === 0) {
        console.log(`[innertube] ${client.name}: no streaming data`);
        continue;
      }

      const audioFormats = formats.filter((f: { mimeType?: string }) =>
        f.mimeType?.startsWith('audio/')
      );
      if (audioFormats.length === 0) {
        console.log(`[innertube] ${client.name}: no audio formats`);
        continue;
      }

      audioFormats.sort((a: { bitrate?: number }, b: { bitrate?: number }) =>
        (a.bitrate || 0) - (b.bitrate || 0)
      );
      const audio = audioFormats[0];
      const audioUrl = audio.url;

      if (!audioUrl) {
        console.log(`[innertube] ${client.name}: no direct URL (signature cipher)`);
        continue;
      }

      console.log(`[innertube] ${client.name}: downloading ${audio.mimeType} @ ${audio.bitrate}bps`);
      const audioRes = await fetch(audioUrl, { signal: AbortSignal.timeout(30000) });
      if (!audioRes.ok) {
        console.log(`[innertube] ${client.name}: audio download HTTP ${audioRes.status}`);
        continue;
      }

      const buf = await audioRes.arrayBuffer();
      if (buf.byteLength > 25 * 1024 * 1024) {
        throw new Error('Audio too large (>25MB). Try a shorter video.');
      }

      console.log(`[innertube] ${client.name}: success! ${(buf.byteLength / 1024 / 1024).toFixed(1)}MB`);
      return Buffer.from(buf);
    } catch (err) {
      if (err instanceof Error && err.message.includes('too large')) throw err;
      console.log(`[innertube] ${client.name} failed: ${err instanceof Error ? err.message : err}`);
    }
  }
  return null;
}

async function downloadViaProxy(videoId: string): Promise<Buffer> {
  // Try 1: Direct InnerTube API (mimics YouTube mobile apps)
  const directBuf = await tryInnerTubeDirectly(videoId);
  if (directBuf) return directBuf;

  // Try 2: Invidious/Piped proxy instances
  const [invidiousInstances, pipedInstances] = await Promise.all([
    getInvidiousInstances(),
    getPipedInstances(),
  ]);

  console.log(`[proxy] Found ${invidiousInstances.length} Invidious + ${pipedInstances.length} Piped instances`);

  for (const instance of invidiousInstances) {
    console.log(`[proxy] Trying Invidious: ${instance}`);
    const buf = await tryInvidiousInstance(instance, videoId);
    if (buf) return buf;
  }

  for (const instance of pipedInstances) {
    console.log(`[proxy] Trying Piped: ${instance}`);
    const buf = await tryPipedInstance(instance, videoId);
    if (buf) return buf;
  }

  throw new Error(
    'Could not download audio. YouTube blocks downloads from cloud servers. ' +
    'Try a video with captions enabled, or upload the audio file directly.'
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
