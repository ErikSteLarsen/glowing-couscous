import { NextRequest, NextResponse } from 'next/server';

import { requireAthlete } from '@/lib/api-auth';
import { athleteService } from '@/lib/athlete-service';
import { parsePositiveInteger } from '@/lib/route-params';

const MAX_SESSION_IDS = 50;

/** Which sessions behind locally stored ride checkpoints belong to the signed-in athlete, and their status. */
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAthlete();
    if (error) return error;

    const raw = request.nextUrl.searchParams.get('sessionIds') ?? '';
    const parts = raw === '' ? [] : raw.split(',');
    const sessionIds = parts.map(parsePositiveInteger);
    if (parts.length > MAX_SESSION_IDS || sessionIds.some((id) => id === null)) {
      return NextResponse.json({ error: 'Something went wrong. Reload the page and try again.' }, { status: 400 });
    }

    const sessions = await athleteService.listRideSessionStates(user.id, [...new Set(sessionIds as number[])]);
    return NextResponse.json({ sessions }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Could not load your rides. Try again.' }, { status: 500 });
  }
}
