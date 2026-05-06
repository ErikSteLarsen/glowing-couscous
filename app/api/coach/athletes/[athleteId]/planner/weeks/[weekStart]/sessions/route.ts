import { NextRequest, NextResponse } from 'next/server';
import { plannerService } from '@/lib/planner-service';
import { requireCoach } from '@/lib/api-auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ athleteId: string; weekStart: string }> },
) {
  try {
    const { error } = await requireCoach();
    if (error) return error;

    const { athleteId, weekStart } = await params;
    const body = await request.json();
    const result = await plannerService.forWeek({ athleteId: Number(athleteId), weekStart }).execute({
      type: 'save-session',
      draft: body,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}
