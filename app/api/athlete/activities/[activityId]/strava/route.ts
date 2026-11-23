import { NextResponse } from 'next/server';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';
import { stravaPostService } from '@/lib/strava-post-service';

export const maxDuration = 60;

async function owner() {
  const user = await getCurrentUser();
  if (!user) return { error: NextResponse.json({ error: 'Sign in to post to Strava.' }, { status: 401 }) };
  if (!hasAppRole(user)) return { error: NextResponse.json({ error: 'Finish setting up your account first.' }, { status: 403 }) };
  return { user };
}

export async function GET(_request: Request, { params }: { params: Promise<{ activityId: string }> }) {
  const { user, error } = await owner();
  if (error) return error;
  const view = await stravaPostService.loadForUser(user.id, Number((await params).activityId));
  return view ? NextResponse.json(view) : NextResponse.json({ error: 'Activity not found.' }, { status: 404 });
}

export async function POST(request: Request, { params }: { params: Promise<{ activityId: string }> }) {
  const { user, error } = await owner();
  if (error) return error;
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: 'Something went wrong. Reload the page and try again.' }, { status: 400 });
  }
  const result = await stravaPostService.postForUser(user.id, Number((await params).activityId), input);
  return result.ok
    ? NextResponse.json(result)
    : NextResponse.json({ error: result.error, reason: result.reason ?? null }, { status: result.status });
}
