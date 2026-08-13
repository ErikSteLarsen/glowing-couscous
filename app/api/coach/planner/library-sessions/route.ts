import { NextRequest, NextResponse } from 'next/server';
import { requireCoach } from '@/lib/api-auth';
import { coachSessionLibraryService } from '@/lib/coach-session-library-service';

export async function GET() {
  const { user, error } = await requireCoach();
  if (error) return error;

  const sessions = await coachSessionLibraryService.listForCoach(user.id);
  return NextResponse.json({ sessions });
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireCoach();
  if (error) return error;

  const result = await coachSessionLibraryService.saveForCoach(user.id, await request.json());
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, sessionId: result.sessionId }, { status: 201 });
}
