import { NextRequest, NextResponse } from 'next/server';
import { requireCoach } from '@/lib/api-auth';
import { coachSessionLibraryService } from '@/lib/coach-session-library-service';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { user, error } = await requireCoach();
  if (error) return error;

  const { sessionId } = await params;
  const result = await coachSessionLibraryService.saveForCoach(user.id, await request.json(), Number(sessionId));
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
  const result = await coachSessionLibraryService.deleteForCoach(user.id, Number(sessionId));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
