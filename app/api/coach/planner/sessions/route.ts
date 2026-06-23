import { NextRequest, NextResponse } from 'next/server';
import { requireCoach } from '@/lib/api-auth';
import { coachPlannerService } from '@/lib/coach-planner-service';

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireCoach();
    if (error) return error;

    const body = await request.json();
    const result = await coachPlannerService.saveSession(user.id, body);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ ok: true, sessionId: result.sessionId }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create planner session' }, { status: 500 });
  }
}
