import { NextResponse } from 'next/server';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';
import { StravaProviderError, stravaService } from '@/lib/strava-service';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in to import a Strava activity.' }, { status: 401 });
  if (!hasAppRole(user)) return NextResponse.json({ error: 'Finish setting up your account first.' }, { status: 403 });

  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: 'Something went wrong. Reload the page and try again.' }, { status: 400 }); }
  const body = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const stravaActivityId = typeof body.stravaActivityId === 'string' ? body.stravaActivityId : '';
  const title = typeof body.title === 'string' ? body.title : undefined;
  const sport = typeof body.sport === 'string' ? body.sport : undefined;
  const plannedSessionId = body.plannedSessionId === null || body.plannedSessionId === undefined
    ? null
    : Number.isInteger(body.plannedSessionId) && Number(body.plannedSessionId) > 0
      ? Number(body.plannedSessionId)
      : -1;
  if (!/^\d{1,20}$/.test(stravaActivityId) || plannedSessionId === -1) {
    return NextResponse.json({ error: 'Choose a Strava activity and a planned workout.' }, { status: 400 });
  }

  try {
    const result = await stravaService.importActivityForUser(user.id, stravaActivityId, plannedSessionId, title, sport);
    return result.ok
      ? NextResponse.json(result, { status: 201 })
      : NextResponse.json({ error: result.error }, { status: result.status });
  } catch (error) {
    const status = error instanceof StravaProviderError ? error.status : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not import this Strava activity. Try again.' }, { status });
  }
}
