import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAthlete } from '@/lib/api-auth';
import { deriveSessionMetrics } from '@/lib/session-math';
import { isJsonObject, parsePositiveInteger } from '@/lib/route-params';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { user, error } = await requireAthlete();
    if (error) return error;

    const { sessionId } = await params;
    const parsedSessionId = parsePositiveInteger(sessionId);
    if (parsedSessionId === null) {
      return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    if (!isJsonObject(body)) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const isDone = body.isDone;
    const notes = body.notes;
    if (isDone !== undefined && typeof isDone !== 'boolean') {
      return NextResponse.json({ error: 'Invalid isDone' }, { status: 400 });
    }
    if (notes !== undefined && typeof notes !== 'string') {
      return NextResponse.json({ error: 'Invalid notes' }, { status: 400 });
    }
    const session = await prisma.session.findUnique({
      where: { id: parsedSessionId },
      include: {
        blocks: {
          orderBy: { sortOrder: 'asc' },
        },
        activity: true,
      },
    });

    if (!session || session.athleteId !== user.id) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    if (!isDone) {
      await prisma.$transaction([
        prisma.activity.deleteMany({ where: { sessionId: session.id } }),
        prisma.session.update({
          where: { id: session.id },
          data: { status: 'planned' },
        }),
      ]);

      return NextResponse.json({
        sessionId: session.id,
        completion: { isDone: false, notes: notes ?? '', completedAt: null },
      });
    }

    const metrics = deriveSessionMetrics(
      session.blocks.map((block) => ({
        kind: block.kind as 'warmup' | 'work' | 'recovery' | 'cooldown',
        zone: block.zone as 1 | 2 | 3 | 4 | 5,
        durationSec: block.durationSec,
        reps: block.reps,
        target:
          block.targetType && block.targetLow !== null && block.targetHigh !== null
            ? {
                type: block.targetType as 'power' | 'pace' | 'hr',
                low: block.targetLow,
                high: block.targetHigh,
              }
            : null,
      })),
    );

    const completedAt = new Date();

    await prisma.$transaction([
      prisma.activity.upsert({
        where: { sessionId: session.id },
        update: {
          completedAt,
          durationSec: metrics.durationSec,
          tss: metrics.tss,
          compliancePct: 100,
          zoneDistributionJson: JSON.stringify(metrics.zoneDistributionSec),
          notes: notes ?? null,
        },
        create: {
          sessionId: session.id,
          athleteId: user.id,
          completedAt,
          durationSec: metrics.durationSec,
          tss: metrics.tss,
          compliancePct: 100,
          zoneDistributionJson: JSON.stringify(metrics.zoneDistributionSec),
          notes: notes ?? null,
        },
      }),
      prisma.session.update({
        where: { id: session.id },
        data: { status: 'completed' },
      }),
    ]);

    return NextResponse.json({
      sessionId: session.id,
      completion: {
        isDone: true,
        notes: notes ?? '',
        completedAt: completedAt.toISOString(),
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update completion' }, { status: 500 });
  }
}
