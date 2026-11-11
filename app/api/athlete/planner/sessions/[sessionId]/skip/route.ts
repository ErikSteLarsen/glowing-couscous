import { NextRequest, NextResponse } from 'next/server';

import { requireAthlete } from '@/lib/api-auth';
import { athleteSessionStatusService } from '@/lib/athlete-session-status-service';
import { parsePositiveInteger } from '@/lib/route-params';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { user, error } = await requireAthlete();
    if (error) return error;

    const { sessionId: rawSessionId } = await params;
    const sessionId = parsePositiveInteger(rawSessionId);
    if (sessionId === null) return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 });

    const result = await athleteSessionStatusService.skipSession(user.id, sessionId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    return NextResponse.json({ ok: true, sessionId: result.sessionId, status: result.status });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to skip session' }, { status: 500 });
  }
}
