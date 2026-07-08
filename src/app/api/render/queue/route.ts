import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status');

    const where = status ? { status } : {};

    const jobs = await prisma.renderJob.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        clip: {
          select: {
            id: true,
            title: true,
            startTime: true,
            endTime: true,
            duration: true,
          },
        },
        project: {
          select: {
            id: true,
            title: true,
            sourceType: true,
          },
        },
      },
    });

    return NextResponse.json(jobs);
  } catch (error) {
    console.error('Failed to list render jobs:', error);
    return NextResponse.json(
      { error: 'Failed to list render jobs' },
      { status: 500 }
    );
  }
}
