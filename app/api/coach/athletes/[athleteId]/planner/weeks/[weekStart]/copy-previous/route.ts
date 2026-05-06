import { NextRequest, NextResponse } from 'next/server';
import { plannerService } from '@/lib/planner-service';
import { requireCoach } from '@/lib/api-auth';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ athleteId: string; weekStart: string }> },
) {
  try {
    const { error } = await requireCoach();
    if (error) return error;

    const { athleteId, weekStart } = await params;
    const result = await plannerService.forWeek({ athleteId: Number(athleteId), weekStart }).execute({
      type: 'copy-previous-week',
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to copy previous week' }, { status: 500 });
  }
}
