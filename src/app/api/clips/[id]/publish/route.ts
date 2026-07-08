import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { platform, method } = body;

    const clip = await prisma.clip.findUnique({
      where: { id },
      include: { renderJobs: true },
    });

    if (!clip) {
      return NextResponse.json({ error: 'Clip not found' }, { status: 404 });
    }

    const settings = await prisma.settings.findUnique({ where: { id: 'global' } });
    const config = settings ? JSON.parse(settings.data) : {};

    const renderJob = clip.renderJobs.find(
      j => j.status === 'completed' && j.platform === platform
    );

    let externalId: string | undefined;
    let externalUrl: string | undefined;

    switch (method) {
      case 'youtube': {
        if (!config.googleClientId || !config.googleClientSecret) {
          return NextResponse.json({ error: 'YouTube not configured. Add Google credentials in Settings.' }, { status: 400 });
        }
        return NextResponse.json({
          message: 'YouTube publishing requires OAuth authentication. Configure in Settings.',
          authUrl: `/api/auth/google`,
        }, { status: 200 });
      }

      case 'buffer': {
        if (!config.bufferToken) {
          return NextResponse.json({ error: 'Buffer not configured. Add access token in Settings.' }, { status: 400 });
        }
        const { publishToBuffer } = await import('@/lib/publishing/buffer');
        const hashtags = JSON.parse(clip.hashtags || '[]');
        const text = `${clip.title}\n\n${clip.description}\n\n${hashtags.map((t: string) => `#${t}`).join(' ')}`;
        const result = await publishToBuffer({ accessToken: config.bufferToken, text });
        externalId = result.id;
        break;
      }

      case 'make': {
        if (!config.makeWebhookUrl) {
          return NextResponse.json({ error: 'Make webhook not configured. Add webhook URL in Settings.' }, { status: 400 });
        }
        const { triggerMakeWebhook } = await import('@/lib/publishing/make');
        const result = await triggerMakeWebhook({
          webhookUrl: config.makeWebhookUrl,
          clipTitle: clip.title,
          clipDescription: clip.description,
          hashtags: JSON.parse(clip.hashtags || '[]'),
          platform,
          filePath: renderJob?.outputPath || undefined,
        });
        if (!result.success) {
          return NextResponse.json({ error: 'Make webhook failed' }, { status: 500 });
        }
        break;
      }

      default:
        return NextResponse.json({ error: 'Invalid publish method' }, { status: 400 });
    }

    const publication = await prisma.publication.create({
      data: {
        clipId: id,
        platform,
        externalId,
        externalUrl,
        status: 'published',
        publishedAt: new Date(),
      },
    });

    await prisma.clip.update({ where: { id }, data: { status: 'published' } });

    return NextResponse.json({ publication, message: 'Published successfully' });
  } catch (error) {
    console.error('Publish error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to publish' },
      { status: 500 }
    );
  }
}
