import { NextRequest, NextResponse } from 'next/server';
import { requireCoach } from '@/lib/api-auth';
import { coachTrainingPlanService } from '@/lib/coach-training-plan-service';
import { readJsonObject } from '@/lib/route-params';

export async function POST(request: NextRequest) {
  const { user, error } = await requireCoach();
  if (error) return error;

  const body = await readJsonObject<Parameters<typeof coachTrainingPlanService.createPlan>[1]>(request);
  if (!body.ok) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  const plan = await coachTrainingPlanService.createPlan(user.id, body.value);
  return NextResponse.json({ ok: true, planId: plan.id }, { status: 201 });
}
