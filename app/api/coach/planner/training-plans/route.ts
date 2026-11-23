import { NextRequest, NextResponse } from 'next/server';
import { requireCoach } from '@/lib/api-auth';
import { coachTrainingPlanService } from '@/lib/coach-training-plan-service';
import { readJsonObject } from '@/lib/route-params';

export async function POST(request: NextRequest) {
  const { user, error } = await requireCoach();
  if (error) return error;

  const body = await readJsonObject(request);
  if (!body.ok) return NextResponse.json({ error: 'Something went wrong. Reload the page and try again.' }, { status: 400 });
  const result = await coachTrainingPlanService.createPlan(user.id, body.value);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, planId: result.planId }, { status: 201 });
}
