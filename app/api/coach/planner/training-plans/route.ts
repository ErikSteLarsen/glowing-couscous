import { NextRequest, NextResponse } from 'next/server';
import { requireCoach } from '@/lib/api-auth';
import { coachTrainingPlanService } from '@/lib/coach-training-plan-service';

export async function POST(request: NextRequest) {
  const { user, error } = await requireCoach();
  if (error) return error;

  const body = await request.json();
  const plan = await coachTrainingPlanService.createPlan(user.id, body);
  return NextResponse.json({ ok: true, planId: plan.id }, { status: 201 });
}
