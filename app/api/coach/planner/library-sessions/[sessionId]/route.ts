import { NextRequest, NextResponse } from 'next/server';
import { requireCoach } from '@/lib/api-auth';
import { coachSessionLibraryService } from '@/lib/coach-session-library-service';
import { parsePositiveInteger, readJsonObject } from '@/lib/route-params';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { user, error } = await requireCoach();
  if (error) return error;

  const { sessionId } = await params;
  const parsedSessionId = parsePositiveInteger(sessionId);
  if (parsedSessionId === null) return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 });
  const body = await readJsonObject<Parameters<typeof coachSessionLibraryService.saveForCoach>[1]>(request);
  if (!body.ok) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  const result = await coachSessionLibraryService.saveForCoach(user.id, body.value, parsedSessionId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, sessionId: result.sessionId });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { user, error } = await requireCoach();
  if (error) return error;

  const { sessionId } = await params;
  const parsedSessionId = parsePositiveInteger(sessionId);
  if (parsedSessionId === null) return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 });
  const result = await coachSessionLibraryService.deleteForCoach(user.id, parsedSessionId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
