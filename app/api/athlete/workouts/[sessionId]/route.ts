import { NextRequest, NextResponse } from 'next/server';

import { requireAthlete } from '@/lib/api-auth';
import { parsePositiveInteger, readJsonObject } from '@/lib/route-params';
import { workoutLibraryService } from '@/lib/workout-library-service';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { user, error } = await requireAthlete();
  if (error) return error;
  const { sessionId } = await params;
  const parsedSessionId = parsePositiveInteger(sessionId);
  if (parsedSessionId === null) return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 });
  const body = await readJsonObject(request);
  if (!body.ok) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  const result = await workoutLibraryService.saveForOwner('athlete', user.id, body.value, parsedSessionId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, sessionId: result.sessionId });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { user, error } = await requireAthlete();
  if (error) return error;
  const { sessionId } = await params;
  const parsedSessionId = parsePositiveInteger(sessionId);
  if (parsedSessionId === null) return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 });
  const result = await workoutLibraryService.deleteForOwner('athlete', user.id, parsedSessionId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
