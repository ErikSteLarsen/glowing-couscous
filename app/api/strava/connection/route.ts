import { NextResponse } from 'next/server';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';
import { stravaService } from '@/lib/strava-service';

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in to disconnect Strava.' }, { status: 401 });
  if (!hasAppRole(user)) return NextResponse.json({ error: 'Finish setting up your account first.' }, { status: 403 });
  try {
    const result = await stravaService.disconnectForUser(user.id);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Could not disconnect Strava. Try again.' }, { status: 500 });
  }
}
