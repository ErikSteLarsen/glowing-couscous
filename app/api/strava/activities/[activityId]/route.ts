import { NextResponse } from 'next/server';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';
import { StravaProviderError, stravaService } from '@/lib/strava-service';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ activityId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in to review this Strava activity.' }, { status: 401 });
  if (!hasAppRole(user)) return NextResponse.json({ error: 'Complete account setup first.' }, { status: 403 });
  const { activityId } = await params;
  try {
    const activity = await stravaService.detailsForUser(user.id, activityId);
    return NextResponse.json({ activity });
  } catch (error) {
    const status = error instanceof StravaProviderError ? error.status : 502;
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Strava activity could not be loaded.' }, { status });
  }
}
