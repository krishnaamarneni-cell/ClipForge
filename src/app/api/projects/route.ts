import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { clips: true, renderJobs: true } },
      },
    });

    const totalClips = projects.reduce((sum, p) => sum + p._count.clips, 0);
    const totalRenders = projects.reduce((sum, p) => sum + p._count.renderJobs, 0);

    const publications = await prisma.publication.count();

    return NextResponse.json({
      projects,
      stats: {
        totalProjects: projects.length,
        clipsGenerated: totalClips,
        videosRendered: totalRenders,
        published: publications,
      },
    });
  } catch (error) {
    console.error('Failed to list projects:', error);
    return NextResponse.json(
      { error: 'Failed to list projects' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') ?? '';
    let sourceType: string;
    let sourceUrl: string | undefined;
    let title: string | undefined;
    let fileName: string | undefined;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      sourceType = formData.get('sourceType') as string;
      sourceUrl = (formData.get('sourceUrl') as string) || undefined;
      title = (formData.get('title') as string) || undefined;
      fileName = (formData.get('fileName') as string) || undefined;

      const file = formData.get('file') as File | null;
      if (file) {
        fileName = file.name;
        // In production, save file to disk/S3 and set filePath
      }
    } else {
      const body = await request.json();
      sourceType = body.sourceType;
      sourceUrl = body.sourceUrl;
      title = body.title;
    }

    if (!sourceType) {
      return NextResponse.json(
        { error: 'sourceType is required' },
        { status: 400 }
      );
    }

    if (sourceType === 'youtube' && !sourceUrl) {
      return NextResponse.json(
        { error: 'sourceUrl is required for YouTube projects' },
        { status: 400 }
      );
    }

    const project = await prisma.project.create({
      data: {
        title: title || extractTitle(sourceType, sourceUrl, fileName) || 'Untitled Project',
        sourceType,
        sourceUrl,
        fileName,
        status: 'pending',
      },
    });

    // Trigger analysis pipeline asynchronously
    const baseUrl = request.nextUrl.origin;
    fetch(`${baseUrl}/api/projects/${project.id}/analyze`, {
      method: 'POST',
    }).catch((err) => console.error('Failed to trigger analysis:', err));

    return NextResponse.json(project, { status: 201 });
  } catch (error) {
    console.error('Failed to create project:', error);
    return NextResponse.json(
      { error: 'Failed to create project' },
      { status: 500 }
    );
  }
}

function extractTitle(
  sourceType: string,
  sourceUrl?: string,
  fileName?: string
): string | undefined {
  if (fileName) {
    return fileName.replace(/\.[^/.]+$/, '');
  }
  if (sourceType === 'youtube' && sourceUrl) {
    return `YouTube Video`;
  }
  return undefined;
}
