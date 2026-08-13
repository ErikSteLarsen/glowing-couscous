import { NextRequest, NextResponse } from 'next/server';
import { requireCoach } from '@/lib/api-auth';
import { coachTrainingPlanService } from '@/lib/coach-training-plan-service';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string; sessionId: string }> },
) {
  const { user, error } = await requireCoach();
  if (error) return error;

  const { planId, sessionId } = await params;
  const result = await coachTrainingPlanService.savePlanSession(
    user.id,
    Number(planId),
    await request.json(),
    Number(sessionId),
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, sessionId: result.sessionId });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ planId: string; sessionId: string }> },
) {
  const { user, error } = await requireCoach();
  if (error) return error;

  const { planId, sessionId } = await params;
  const result = await coachTrainingPlanService.deletePlanSession(user.id, Number(planId), Number(sessionId));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
