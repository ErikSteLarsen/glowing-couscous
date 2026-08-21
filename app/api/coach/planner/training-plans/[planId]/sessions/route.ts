import { NextRequest, NextResponse } from 'next/server';
import { requireCoach } from '@/lib/api-auth';
import { coachTrainingPlanService } from '@/lib/coach-training-plan-service';
import { parsePositiveInteger, readJsonObject } from '@/lib/route-params';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { user, error } = await requireCoach();
  if (error) return error;

  const { planId } = await params;
  const parsedPlanId = parsePositiveInteger(planId);
  if (parsedPlanId === null) return NextResponse.json({ error: 'Invalid planId' }, { status: 400 });
  const body = await readJsonObject<Parameters<typeof coachTrainingPlanService.savePlanSession>[2]>(request);
  if (!body.ok) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  const result = await coachTrainingPlanService.savePlanSession(user.id, parsedPlanId, body.value);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, sessionId: result.sessionId }, { status: 201 });
}
