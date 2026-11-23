import { NextResponse } from 'next/server';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';
import { StravaProviderError, stravaService } from '@/lib/strava-service';

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in to check Strava.' }, { status: 401 });
  if (!hasAppRole(user)) return NextResponse.json({ error: 'Finish setting up your account first.' }, { status: 403 });

  try {
    const result = await stravaService.syncRecentActivities(user.id);
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof StravaProviderError ? error.status : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not check Strava. Try again.' }, { status });
  }
}
