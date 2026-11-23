import { NextRequest, NextResponse } from 'next/server';

import { requireAthlete } from '@/lib/api-auth';
import { athletePlannerService } from '@/lib/athlete-planner-service';
import { parsePositiveInteger, readJsonObject } from '@/lib/route-params';

/** Moves an open, self-planned session to another day; body: `{ date: 'yyyy-MM-dd' }`. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { user, error } = await requireAthlete();
    if (error) return error;

    const { sessionId } = await params;
    const parsedSessionId = parsePositiveInteger(sessionId);
    if (parsedSessionId === null) return NextResponse.json({ error: 'Workout not found.' }, { status: 400 });
    const body = await readJsonObject(request);
    if (!body.ok) return NextResponse.json({ error: 'Something went wrong. Reload the page and try again.' }, { status: 400 });

    const result = await athletePlannerService.rescheduleSession(user.id, parsedSessionId, body.value);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json({ ok: true, sessionId: result.sessionId, date: result.date });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Could not move this workout. Try again.' }, { status: 500 });
  }
}
