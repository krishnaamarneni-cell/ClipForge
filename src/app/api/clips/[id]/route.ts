import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const clip = await prisma.clip.findUnique({
      where: { id: params.id },
      include: {
        renderJobs: {
          orderBy: { createdAt: 'desc' },
        },
        project: {
          select: { id: true, title: true, sourceType: true },
        },
      },
    });

    if (!clip) {
      return NextResponse.json({ error: 'Clip not found' }, { status: 404 });
    }

    const parsed = {
      ...clip,
      hashtags: JSON.parse(clip.hashtags || '[]'),
      platforms: JSON.parse(clip.platforms || '[]'),
      captionData: clip.captionData ? JSON.parse(clip.captionData) : null,
    };

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('Failed to get clip:', error);
    return NextResponse.json(
      { error: 'Failed to get clip' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const clip = await prisma.clip.findUnique({
      where: { id: params.id },
    });

    if (!clip) {
      return NextResponse.json({ error: 'Clip not found' }, { status: 404 });
    }

    const body = await request.json();
    const allowedFields = [
      'title',
      'description',
      'hashtags',
      'captionStyle',
      'status',
      'hook',
      'hookText',
      'titleOverlay',
      'captionData',
      'platforms',
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        if (field === 'hashtags' || field === 'platforms' || field === 'captionData') {
          updateData[field] =
            typeof body[field] === 'string'
              ? body[field]
              : JSON.stringify(body[field]);
        } else {
          updateData[field] = body[field];
        }
      }
    }

    const updated = await prisma.clip.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Failed to update clip:', error);
    return NextResponse.json(
      { error: 'Failed to update clip' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const clip = await prisma.clip.findUnique({
      where: { id: params.id },
    });

    if (!clip) {
      return NextResponse.json({ error: 'Clip not found' }, { status: 404 });
    }

    await prisma.clip.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete clip:', error);
    return NextResponse.json(
      { error: 'Failed to delete clip' },
      { status: 500 }
    );
  }
}
