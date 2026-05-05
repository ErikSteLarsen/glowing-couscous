import { NextRequest, NextResponse } from 'next/server';
import { plannerService } from '@/lib/planner-service';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ athleteId: string; weekStart: string }> },
) {
  try {
    const { athleteId, weekStart } = await params;
    const body = await request.json();
    const result = await plannerService.forWeek({ athleteId: Number(athleteId), weekStart }).execute({
      type: 'save-weekly-note',
      weeklyNote: String(body.weeklyNote ?? ''),
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update weekly note' }, { status: 500 });
  }
}
