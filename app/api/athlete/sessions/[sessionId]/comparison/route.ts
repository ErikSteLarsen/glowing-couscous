import { NextResponse } from 'next/server';

import { requireAthlete } from '@/lib/api-auth';
import { parsePositiveInteger } from '@/lib/route-params';
import { sessionComparisonService } from '@/lib/session-comparison-service';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { user, error } = await requireAthlete();
    if (error) return error;
    const { sessionId } = await params;
    const parsedSessionId = parsePositiveInteger(sessionId);
    if (parsedSessionId === null) return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 });

    const result = await sessionComparisonService.loadComparison({ role: 'ATHLETE', userId: user.id }, parsedSessionId);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to load comparison' }, { status: 500 });
  }
}
