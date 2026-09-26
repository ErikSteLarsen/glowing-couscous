import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';

const STATE_COOKIE = 'tempo_strava_oauth_state';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in before connecting Strava.' }, { status: 401 });
  if (!hasAppRole(user)) return NextResponse.json({ error: 'Complete account setup first.' }, { status: 403 });

  const clientId = process.env.STRAVA_CLIENT_ID?.trim();
  if (!clientId || !process.env.STRAVA_CLIENT_SECRET?.trim() || !process.env.STRAVA_TOKEN_ENCRYPTION_KEY?.trim()) {
    return NextResponse.json({ error: 'Strava connection is not configured yet.' }, { status: 503 });
  }

  const callbackBase = process.env.AUTH_URL?.trim() || request.url;
  const callback = process.env.STRAVA_OAUTH_REDIRECT_URI?.trim() || new URL('/api/strava/callback', callbackBase).toString();
  const state = `${randomBytes(24).toString('hex')}.${user.id}`;
  const authorization = new URL('https://www.strava.com/oauth/authorize');
  authorization.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callback,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'activity:read,activity:read_all',
    state,
  }).toString();

  const response = NextResponse.redirect(authorization);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: new URL(request.url).protocol === 'https:',
    sameSite: 'lax',
    path: '/api/strava/callback',
    maxAge: 600,
  });
  return response;
}
