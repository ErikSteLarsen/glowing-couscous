import { NextRequest, NextResponse } from 'next/server';
import { plannerService } from '@/lib/planner-service';
import { prisma } from '@/lib/prisma';
import { requireCoach } from '@/lib/api-auth';
import { coachService } from '@/lib/coach-service';
import { parsePositiveInteger, readJsonObject } from '@/lib/route-params';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { user, error } = await requireCoach();
    if (error) return error;

    const { sessionId } = await params;
    const parsedSessionId = parsePositiveInteger(sessionId);
    if (parsedSessionId === null) {
      return NextResponse.json({ error: 'Workout not found.' }, { status: 400 });
    }

    const body = await readJsonObject(request);
    if (!body.ok) return NextResponse.json({ error: 'Something went wrong. Reload the page and try again.' }, { status: 400 });
    const session = await prisma.session.findUnique({
      where: { id: parsedSessionId },
      select: { id: true, athleteId: true, date: true },
    });

    if (!session) {
      return NextResponse.json({ error: 'Workout not found.' }, { status: 404 });
    }

    if (!session.athleteId || !session.date) {
      return NextResponse.json({ error: 'Workout not found.' }, { status: 404 });
    }

    const hasAthlete = await coachService.hasAthlete(user.id, session.athleteId);
    if (!hasAthlete) {
      return NextResponse.json({ error: 'Workout not found.' }, { status: 404 });
    }

    const result = await plannerService.forWeek({ athleteId: session.athleteId, weekStart: session.date }).execute({
      type: 'save-session',
      sessionId: session.id,
      draft: body.value,
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Could not save this workout. Try again.' }, { status: 500 });
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
    const parsedSessionId = parsePositiveInteger(sessionId);
    if (parsedSessionId === null) {
      return NextResponse.json({ error: 'Workout not found.' }, { status: 400 });
    }

    const session = await prisma.session.findUnique({
      where: { id: parsedSessionId },
      select: { id: true, athleteId: true, date: true },
    });

    if (!session) {
      return NextResponse.json({ error: 'Workout not found.' }, { status: 404 });
    }

    if (!session.athleteId || !session.date) {
      return NextResponse.json({ error: 'Workout not found.' }, { status: 404 });
    }

    const hasAthlete = await coachService.hasAthlete(user.id, session.athleteId);
    if (!hasAthlete) {
      return NextResponse.json({ error: 'Workout not found.' }, { status: 404 });
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
    return NextResponse.json({ error: 'Could not remove this workout. Try again.' }, { status: 500 });
  }
}
