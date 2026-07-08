import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { analyzeTranscript } from '@/lib/ai/analyze';
import { generateClipSuggestions } from '@/lib/ai/clips';
import type { TranscriptSegment } from '@/types';

const MOCK_TRANSCRIPT: TranscriptSegment[] = [
  { start: 0, end: 8, text: "Welcome back everyone. Today I want to talk about something that's been blowing my mind lately -- the AI landscape in 2026 is completely unrecognizable from where we were just two years ago." },
  { start: 8, end: 16, text: "And I'm not talking about incremental improvements. I mean fundamental shifts in how we interact with these systems. The biggest one? AI agents are finally doing real work." },
  { start: 16, end: 25, text: "Here's a stat that floored me: over forty percent of Fortune 500 companies now have autonomous AI agents handling some part of their customer operations. Not chatbots. Actual decision-making agents." },
  { start: 25, end: 33, text: "But here's the thing nobody's talking about -- the real revolution isn't in enterprise. It's happening with solo creators and small teams. One person can now build what used to take a team of twenty." },
  { start: 33, end: 42, text: "I talked to a founder last week who built an entire SaaS product, from database design to deployment, in a single weekend. Using AI coding agents. And it's not some toy app -- it has paying customers." },
  { start: 42, end: 50, text: "Now let me shift gears because there's a darker side to this that we need to address. The job displacement conversation has gotten very real, very fast." },
  { start: 50, end: 58, text: "Junior developer roles have contracted by about thirty percent in the last eighteen months. That's not a prediction -- that's Bureau of Labor Statistics data. And it's accelerating." },
  { start: 58, end: 67, text: "But -- and this is important -- new roles are emerging just as fast. AI operations, prompt engineering, agent orchestration. The total number of tech jobs is actually up. The composition is just radically different." },
  { start: 67, end: 75, text: "So the advice I'd give to anyone starting their career right now is: don't learn a programming language. Learn how to think in systems. Learn how to decompose problems. The AI will write the code." },
  { start: 75, end: 84, text: "Let's talk about multimodal AI because that's where things get really wild. We now have models that can see, hear, read, and generate across all those modalities simultaneously." },
  { start: 84, end: 93, text: "I ran an experiment last week where I gave a model a whiteboard photo of a system architecture and asked it to generate the entire codebase. It produced twelve files, all working, in about ninety seconds." },
  { start: 93, end: 101, text: "The quality wasn't perfect -- maybe eighty-five percent there. But two years ago that would have been science fiction. The rate of improvement is genuinely exponential." },
  { start: 101, end: 110, text: "Now here's my hot take for 2026: I think we're about twelve months away from AI models that can genuinely watch a YouTube video and produce a complete summary that's better than what most humans would write." },
  { start: 110, end: 118, text: "Actually, some would argue we're already there. The challenge isn't capability anymore -- it's trust. Organizations are struggling with when to let AI make decisions versus when to keep humans in the loop." },
  { start: 118, end: 127, text: "I was at a conference last month where a hospital CTO said something that stuck with me. She said, the AI is right ninety-eight percent of the time. But we need it to be right one hundred percent of the time for the cases where being wrong means someone dies." },
  { start: 127, end: 136, text: "That's the core tension of this entire era. AI is superhuman at pattern recognition but still fundamentally lacks the ability to know what it doesn't know. And that gap, that two percent, is where all the interesting problems live." },
  { start: 136, end: 145, text: "On the open-source front, the gap between open and closed models has basically vanished. Open-weight models running on consumer hardware are now competitive with the best commercial APIs for most tasks." },
  { start: 145, end: 153, text: "This is huge for privacy and sovereignty. Companies can now run production AI workloads entirely on-premises. No data leaving the building. That was the dream, and it's here." },
  { start: 153, end: 162, text: "For creators specifically -- and I know a lot of you watching are creators -- the tools available now are insane. AI-generated B-roll, automatic captioning that actually captures tone, music generation that doesn't sound like stock audio." },
  { start: 162, end: 170, text: "My prediction: by the end of this year, a solo creator with the right AI toolkit will produce content that's indistinguishable from what a full production studio puts out. The playing field hasn't just leveled -- it's inverted." },
  { start: 170, end: 180, text: "So that's where we are. 2026 is the year AI stopped being a tool and started being a collaborator. Whether you're excited or terrified by that -- and honestly, I'm both -- the only wrong move is to ignore it. Thanks for watching. Drop your thoughts in the comments." },
];

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
    const hasWhisperKey = !!process.env.OPENAI_API_KEY;

    if (hasWhisperKey && project.filePath) {
      // Real Whisper transcription
      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI();
      const fs = await import('fs');

      const response = await openai.audio.transcriptions.create({
        file: fs.createReadStream(project.filePath),
        model: 'whisper-1',
        response_format: 'verbose_json',
        timestamp_granularities: ['segment'],
      });

      transcript = (response.segments ?? []).map((seg: { start: number; end: number; text: string }) => ({
        start: seg.start,
        end: seg.end,
        text: seg.text.trim(),
      }));
    } else {
      transcript = MOCK_TRANSCRIPT;
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
