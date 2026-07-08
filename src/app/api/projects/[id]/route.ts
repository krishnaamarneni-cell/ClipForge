import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: params.id },
      include: {
        transcript: true,
        analysis: true,
        clips: {
          orderBy: { engagementScore: 'desc' },
          include: {
            renderJobs: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    const parsed = {
      ...project,
      transcript: project.transcript ? {
        ...project.transcript,
        segments: JSON.parse(project.transcript.segments || '[]'),
      } : null,
      analysis: project.analysis ? {
        ...project.analysis,
        topics: JSON.parse(project.analysis.topics || '[]'),
        hooks: JSON.parse(project.analysis.hooks || '[]'),
        emotionalPeaks: JSON.parse(project.analysis.emotionalPeaks || '[]'),
        keyMoments: JSON.parse(project.analysis.keyMoments || '[]'),
        speakerChanges: JSON.parse(project.analysis.speakerChanges || '[]'),
      } : null,
      clips: project.clips.map(clip => ({
        ...clip,
        hashtags: JSON.parse(clip.hashtags || '[]'),
        platforms: JSON.parse(clip.platforms || '[]'),
        captionData: clip.captionData ? JSON.parse(clip.captionData) : null,
      })),
    };

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Failed to get project:', error);
    return NextResponse.json(
      { error: 'Failed to get project' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const project = await prisma.project.findUnique({
      where: { id: params.id },
    });

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      );
    }

    await prisma.project.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete project:', error);
    return NextResponse.json(
      { error: 'Failed to delete project' },
      { status: 500 }
    );
  }
}
