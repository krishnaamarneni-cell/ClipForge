import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const DEFAULT_SETTINGS = {
  defaultHashtags: ['shorts', 'viral', 'clips'],
  defaultCaptionStyle: 'bold',
  defaultPlatforms: ['youtube_shorts'],
  exportQuality: 'standard',
  autoGenerateClips: true,
  clipLengths: [30, 60],
};

export async function GET() {
  try {
    let settings = await prisma.settings.findUnique({
      where: { id: 'global' },
    });

    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          id: 'global',
          data: JSON.stringify(DEFAULT_SETTINGS),
        },
      });
    }

    return NextResponse.json(JSON.parse(settings.data));
  } catch (error) {
    console.error('Failed to get settings:', error);
    return NextResponse.json(
      { error: 'Failed to get settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    const existing = await prisma.settings.findUnique({
      where: { id: 'global' },
    });

    const currentData = existing ? JSON.parse(existing.data) : DEFAULT_SETTINGS;
    const merged = { ...currentData, ...body };

    const settings = await prisma.settings.upsert({
      where: { id: 'global' },
      update: { data: JSON.stringify(merged) },
      create: { id: 'global', data: JSON.stringify(merged) },
    });

    return NextResponse.json(JSON.parse(settings.data));
  } catch (error) {
    console.error('Failed to update settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
