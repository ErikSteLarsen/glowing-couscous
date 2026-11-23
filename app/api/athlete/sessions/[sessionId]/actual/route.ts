import { NextRequest, NextResponse } from 'next/server';

import { requireAthlete } from '@/lib/api-auth';
import { athleteCompletionService } from '@/lib/athlete-completion-service';
import { parsePositiveInteger, readJsonObject } from '@/lib/route-params';

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

    const result = await athleteCompletionService.saveActualOutcome(
      { role: 'ATHLETE', userId: user.id },
      parsedSessionId,
      body.value,
    );
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    return NextResponse.json({ ok: true, sessionId: result.sessionId, completedAt: result.completedAt.toISOString() });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Could not save your result. Try again.' }, { status: 500 });
  }
}
