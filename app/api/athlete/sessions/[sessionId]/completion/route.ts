import { NextRequest, NextResponse } from 'next/server';
import { plannerService } from '@/lib/planner-service';
import { prisma } from '@/lib/prisma';
import { requireAthlete } from '@/lib/api-auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { user, error } = await requireAthlete();
    if (error) return error;

    const { sessionId } = await params;
    const body = (await request.json()) as { isDone?: boolean; notes?: string };

    const athleteProfile = await prisma.athleteProfile.findUnique({ where: { userId: user.id } });
    if (!athleteProfile) return NextResponse.json({ error: 'Athlete profile not found' }, { status: 404 });

    const session = await prisma.plannedSession.findUnique({
      where: { id: Number(sessionId) },
      include: { planWeek: true },
    });

    if (!session || session.planWeek.athleteId !== athleteProfile.id) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const result = await plannerService
      .forWeek({ athleteId: athleteProfile.id, weekStart: session.planWeek.weekStart })
      .execute({
        type: 'set-session-completion',
        sessionId: session.id,
        athleteUserId: user.id,
        isDone: typeof body.isDone === 'boolean' ? body.isDone : false,
        notes: typeof body.notes === 'string' ? body.notes : '',
      });

    if (!result.ok) {
      return NextResponse.json({ error: result.error || 'Failed to update completion' }, { status: result.status ?? 400 });
    }

    if (!result.completion) {
      return NextResponse.json({ error: 'Failed to update completion' }, { status: 500 });
    }

    return NextResponse.json({ sessionId: session.id, completion: result.completion });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update completion' }, { status: 500 });
  }
}
