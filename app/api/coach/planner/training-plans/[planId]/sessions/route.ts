import { NextRequest, NextResponse } from 'next/server';
import { requireCoach } from '@/lib/api-auth';
import { coachTrainingPlanService } from '@/lib/coach-training-plan-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { user, error } = await requireCoach();
  if (error) return error;

  const { planId } = await params;
  const result = await coachTrainingPlanService.savePlanSession(user.id, Number(planId), await request.json());
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, sessionId: result.sessionId }, { status: 201 });
}
