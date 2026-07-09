import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { analyzeTranscript } from '@/lib/ai/analyze';
import { generateClipSuggestions } from '@/lib/ai/clips';
import { fetchYouTubeTranscript } from '@/lib/youtube-transcript';
import type { TranscriptSegment } from '@/types';

export const maxDuration = 60;

function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const projectId = params.id;

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    // Step 1: Downloading / extracting source info
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'downloading' },
    });

    if (project.sourceType === 'youtube' && project.sourceUrl) {
      const videoId = extractYouTubeVideoId(project.sourceUrl);
      if (videoId) {
        await prisma.project.update({
          where: { id: projectId },
          data: {
            title: project.title === 'YouTube Video' ? `YouTube Video ${videoId}` : project.title,
            thumbnail: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          },
        });
      }
    }

    // Step 2: Transcription
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'transcribing' },
    });

    let transcript: TranscriptSegment[];
    const hasGroqKey = !!process.env.GROQ_API_KEY;

    if (hasGroqKey && project.filePath) {
      // Uploaded file: transcribe with Groq Whisper
      const Groq = (await import('groq-sdk')).default;
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
      const fs = await import('fs');

      const response = await groq.audio.transcriptions.create({
        file: fs.createReadStream(project.filePath),
        model: 'whisper-large-v3',
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'],
      });

      const segments = (response as unknown as { segments?: Array<{ start: number; end: number; text: string }> }).segments ?? [];
      transcript = segments.map((seg) => ({
        start: seg.start,
        end: seg.end,
        text: seg.text.trim(),
      }));
    } else if (project.sourceType === 'youtube' && project.sourceUrl) {
      // YouTube: fetch existing captions (free, no download needed)
      const videoId = extractYouTubeVideoId(project.sourceUrl);
      if (!videoId) {
        throw new Error('Invalid YouTube URL — could not extract video ID');
      }
      transcript = await fetchYouTubeTranscript(videoId);
      if (transcript.length === 0) {
        throw new Error('No captions available for this YouTube video. Try uploading the audio file instead.');
      }
    } else {
      throw new Error('No video source available. Please provide a YouTube URL or upload a video/audio file.');
    }

    const fullText = transcript.map((s) => s.text).join(' ');
    const duration = transcript[transcript.length - 1]?.end ?? 0;

    await prisma.transcript.upsert({
      where: { projectId },
      update: {
        fullText,
        segments: JSON.stringify(transcript),
      },
      create: {
        projectId,
        fullText,
        segments: JSON.stringify(transcript),
      },
    });

    await prisma.project.update({
      where: { id: projectId },
      data: { duration },
    });

    // Step 3: AI Analysis
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'analyzing' },
    });

    const analysis = await analyzeTranscript(transcript, duration);

    await prisma.analysis.upsert({
      where: { projectId },
      update: {
        mainTopic: analysis.mainTopic,
        topics: JSON.stringify(analysis.topics),
        hooks: JSON.stringify(analysis.hooks),
        emotionalPeaks: JSON.stringify(analysis.emotionalPeaks),
        keyMoments: JSON.stringify(analysis.keyMoments),
        speakerChanges: JSON.stringify(analysis.speakerChanges),
        summary: analysis.summary,
      },
      create: {
        projectId,
        mainTopic: analysis.mainTopic,
        topics: JSON.stringify(analysis.topics),
        hooks: JSON.stringify(analysis.hooks),
        emotionalPeaks: JSON.stringify(analysis.emotionalPeaks),
        keyMoments: JSON.stringify(analysis.keyMoments),
        speakerChanges: JSON.stringify(analysis.speakerChanges),
        summary: analysis.summary,
      },
    });

    // Step 4: Generate clip suggestions
    const clipSuggestions = await generateClipSuggestions(
      analysis,
      transcript
    );

    // Clear existing clips before inserting new ones
    await prisma.clip.deleteMany({ where: { projectId } });

    for (const clip of clipSuggestions) {
      await prisma.clip.create({
        data: {
          projectId,
          title: clip.title,
          hook: clip.hook,
          description: clip.description,
          hashtags: JSON.stringify(clip.hashtags),
          startTime: clip.startTime,
          endTime: clip.endTime,
          duration: clip.duration,
          engagementScore: clip.engagementScore <= 1 ? clip.engagementScore * 100 : clip.engagementScore,
          topicCategory: clip.topicCategory,
          platforms: JSON.stringify(clip.platforms),
          status: 'suggested',
        },
      });
    }

    // Step 5: Done
    await prisma.project.update({
      where: { id: projectId },
      data: { status: 'ready', error: null },
    });

    return NextResponse.json({ status: 'ready', clips: clipSuggestions.length });
  } catch (error) {
    console.error('Analysis pipeline failed:', error);

    await prisma.project.update({
      where: { id: projectId },
      data: {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error during analysis',
      },
    }).catch(() => {});

    return NextResponse.json(
      { error: 'Analysis pipeline failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
