import { NextRequest, NextResponse } from 'next/server';
import { requireCoach } from '@/lib/api-auth';
import { coachPlannerService } from '@/lib/coach-planner-service';
import { parsePositiveInteger, readJsonObject } from '@/lib/route-params';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { user, error } = await requireCoach();
    if (error) return error;

    const { sessionId } = await params;
    const parsedSessionId = parsePositiveInteger(sessionId);
    if (parsedSessionId === null) {
      return NextResponse.json({ error: 'Workout not found.' }, { status: 400 });
    }

    const body = await readJsonObject(request);
    if (!body.ok) return NextResponse.json({ error: 'Something went wrong. Reload the page and try again.' }, { status: 400 });
    const result = await coachPlannerService.saveSession(user.id, body.value, parsedSessionId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ ok: true, sessionId: result.sessionId });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Could not save this workout. Try again.' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { user, error } = await requireCoach();
    if (error) return error;

    const { sessionId } = await params;
    const parsedSessionId = parsePositiveInteger(sessionId);
    if (parsedSessionId === null) {
      return NextResponse.json({ error: 'Workout not found.' }, { status: 400 });
    }

    const result = await coachPlannerService.deleteSession(user.id, parsedSessionId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Could not delete this workout. Try again.' }, { status: 500 });
  }
}
