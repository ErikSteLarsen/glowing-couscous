import { NextRequest, NextResponse } from 'next/server';
import { requireAthlete } from '@/lib/api-auth';
import { athleteCompletionService } from '@/lib/athlete-completion-service';
import { isJsonObject, parsePositiveInteger } from '@/lib/route-params';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { user, error } = await requireAthlete();
    if (error) return error;

    const { sessionId } = await params;
    const parsedSessionId = parsePositiveInteger(sessionId);
    if (parsedSessionId === null) {
      return NextResponse.json({ error: 'Workout not found.' }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Something went wrong. Reload the page and try again.' }, { status: 400 });
    }
    if (!isJsonObject(body)) {
      return NextResponse.json({ error: 'Something went wrong. Reload the page and try again.' }, { status: 400 });
    }
    const isDone = body.isDone;
    const notes = body.notes;
    if (typeof isDone !== 'boolean') {
      return NextResponse.json({ error: 'Something went wrong. Reload the page and try again.' }, { status: 400 });
    }
    if (notes !== undefined && typeof notes !== 'string') {
      return NextResponse.json({ error: 'Your note can’t be saved. Check it and try again.' }, { status: 400 });
    }
    const result = isDone
      ? await athleteCompletionService.completeSession(user.id, parsedSessionId, { notes })
      : await athleteCompletionService.reopenSession(user.id, parsedSessionId, { notes });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      sessionId: result.sessionId,
      completion: {
        isDone: result.isDone,
        notes: result.notes,
        completedAt: result.completedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Could not save. Try again.' }, { status: 500 });
  }
}
