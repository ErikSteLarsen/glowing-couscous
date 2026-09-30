import { after, NextResponse } from 'next/server';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';
import { stravaInboxService } from '@/lib/strava-inbox-service';
import { stravaService } from '@/lib/strava-service';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in to review Strava activities.' }, { status: 401 });
  if (!hasAppRole(user)) return NextResponse.json({ error: 'Complete account setup first.' }, { status: 403 });
  try {
    const result = await stravaInboxService.notificationsForUser(user.id);
    // Recover this owner's due queue work on return to the app, even without a scheduler.
    if (result.connected) after(() => stravaService.processPendingWebhookEvents(user.id).then(() => undefined).catch(() => undefined));
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ error: 'New Strava activities could not be checked.' }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in to review Strava activities.' }, { status: 401 });
  if (!hasAppRole(user)) return NextResponse.json({ error: 'Complete account setup first.' }, { status: 403 });
  let input: unknown;
  try { input = await request.json(); } catch { return NextResponse.json({ error: 'Review could not be read.' }, { status: 400 }); }
  const body = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const { ids, action } = body;
  if (!Array.isArray(ids) || ids.length < 1 || ids.length > 100 || ids.some((id) => typeof id !== 'string' || !/^\d{1,20}$/.test(id)) ||
    (action !== 'notify' && action !== 'discard' && action !== 'restore')) {
    return NextResponse.json({ error: 'Choose valid activities and a review action.' }, { status: 400 });
  }
  try {
    return NextResponse.json(await stravaInboxService.reviewForUser(user.id, ids, action));
  } catch {
    return NextResponse.json({ error: 'Activity review could not be saved. Try again.' }, { status: 503 });
  }
}
