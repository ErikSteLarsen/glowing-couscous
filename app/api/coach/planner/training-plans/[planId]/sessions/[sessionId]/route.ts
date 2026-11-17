import { NextRequest, NextResponse } from 'next/server';
import { requireCoach } from '@/lib/api-auth';
import { coachTrainingPlanService } from '@/lib/coach-training-plan-service';
import { parsePositiveInteger, readJsonObject } from '@/lib/route-params';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string; sessionId: string }> },
) {
  const { user, error } = await requireCoach();
  if (error) return error;

  const { planId, sessionId } = await params;
  const parsedPlanId = parsePositiveInteger(planId);
  const parsedSessionId = parsePositiveInteger(sessionId);
  if (parsedPlanId === null) return NextResponse.json({ error: 'Invalid planId' }, { status: 400 });
  if (parsedSessionId === null) return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 });
  const body = await readJsonObject(request);
  if (!body.ok) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  const result = await coachTrainingPlanService.savePlanSession(
    user.id,
    parsedPlanId,
    body.value,
    parsedSessionId,
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
  const parsedPlanId = parsePositiveInteger(planId);
  const parsedSessionId = parsePositiveInteger(sessionId);
  if (parsedPlanId === null) return NextResponse.json({ error: 'Invalid planId' }, { status: 400 });
  if (parsedSessionId === null) return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 });
  const result = await coachTrainingPlanService.deletePlanSession(user.id, parsedPlanId, parsedSessionId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
