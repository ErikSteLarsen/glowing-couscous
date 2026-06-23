import { NextRequest, NextResponse } from 'next/server';
import { plannerService } from '@/lib/planner-service';
import { prisma } from '@/lib/prisma';
import { requireCoach } from '@/lib/api-auth';
import { coachService } from '@/lib/coach-service';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { user, error } = await requireCoach();
    if (error) return error;

    const { sessionId } = await params;
    const parsedSessionId = Number(sessionId);
    if (!Number.isInteger(parsedSessionId) || parsedSessionId <= 0) {
      return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 });
    }

    const body = await request.json();
    const session = await prisma.session.findUnique({
      where: { id: parsedSessionId },
      select: { id: true, athleteId: true, date: true },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const hasAthlete = await coachService.hasAthlete(user.id, session.athleteId);
    if (!hasAthlete) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const result = await plannerService.forWeek({ athleteId: session.athleteId, weekStart: session.date }).execute({
      type: 'save-session',
      sessionId: session.id,
      draft: body,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { user, error } = await requireCoach();
    if (error) return error;

    const { sessionId } = await params;
    const parsedSessionId = Number(sessionId);
    if (!Number.isInteger(parsedSessionId) || parsedSessionId <= 0) {
      return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 });
    }

    const session = await prisma.session.findUnique({
      where: { id: parsedSessionId },
      select: { id: true, athleteId: true, date: true },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const hasAthlete = await coachService.hasAthlete(user.id, session.athleteId);
    if (!hasAthlete) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const result = await plannerService.forWeek({ athleteId: session.athleteId, weekStart: session.date }).execute({
      type: 'delete-session',
      sessionId: parsedSessionId,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
  }
}
