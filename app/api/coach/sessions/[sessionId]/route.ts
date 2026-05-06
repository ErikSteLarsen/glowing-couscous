import { NextRequest, NextResponse } from 'next/server';
import { plannerService } from '@/lib/planner-service';
import { prisma } from '@/lib/prisma';
import { requireCoach } from '@/lib/api-auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { error } = await requireCoach();
    if (error) return error;

    const { sessionId } = await params;
    const body = await request.json();
    const session = await prisma.plannedSession.findUnique({
      where: { id: Number(sessionId) },
      include: { planWeek: true },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const result = await plannerService.forWeek({ athleteId: session.planWeek.athleteId, weekStart: session.planWeek.weekStart }).execute({
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
    const { error } = await requireCoach();
    if (error) return error;

    const { sessionId } = await params;
    const session = await prisma.plannedSession.findUnique({
      where: { id: Number(sessionId) },
      include: { planWeek: true },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const result = await plannerService.forWeek({ athleteId: session.planWeek.athleteId, weekStart: session.planWeek.weekStart }).execute({
      type: 'delete-session',
      sessionId: Number(sessionId),
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
