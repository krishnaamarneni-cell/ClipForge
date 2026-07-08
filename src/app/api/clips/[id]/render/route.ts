import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const clip = await prisma.clip.findUnique({
      where: { id: params.id },
      include: { project: true },
    });

    if (!clip) {
      return NextResponse.json({ error: 'Clip not found' }, { status: 404 });
    }

    const body = await request.json();
    const { platform, resolution } = body;

    if (!platform) {
      return NextResponse.json(
        { error: 'platform is required' },
        { status: 400 }
      );
    }

    const existingJob = await prisma.renderJob.findFirst({
      where: {
        clipId: clip.id,
        platform,
        status: { in: ['queued', 'processing'] },
      },
    });

    if (existingJob) {
      return NextResponse.json(
        { error: 'A render job for this clip and platform is already in progress' },
        { status: 409 }
      );
    }

    const renderJob = await prisma.renderJob.create({
      data: {
        projectId: clip.projectId,
        clipId: clip.id,
        platform,
        resolution: resolution ?? '1080x1920',
        status: 'queued',
      },
    });

    await prisma.clip.update({
      where: { id: clip.id },
      data: { status: 'rendering' },
    });

    return NextResponse.json(renderJob, { status: 201 });
  } catch (error) {
    console.error('Failed to queue render job:', error);
    return NextResponse.json(
      { error: 'Failed to queue render job' },
      { status: 500 }
    );
  }
}
