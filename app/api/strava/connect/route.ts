import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';
import { safeStravaReturnPath, STRAVA_REQUESTED_SCOPES } from '@/lib/strava-post';

const STATE_COOKIE = 'tempo_strava_oauth_state';
const RETURN_COOKIE = 'tempo_strava_return';

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in before connecting Strava.' }, { status: 401 });
  if (!hasAppRole(user)) return NextResponse.json({ error: 'Finish setting up your account first.' }, { status: 403 });

  const clientId = process.env.STRAVA_CLIENT_ID?.trim();
  if (!clientId || !process.env.STRAVA_CLIENT_SECRET?.trim() || !process.env.STRAVA_TOKEN_ENCRYPTION_KEY?.trim()) {
    return NextResponse.json({ error: 'You can’t connect Strava right now.' }, { status: 503 });
  }

  const url = new URL(request.url);
  const callbackBase = process.env.AUTH_URL?.trim() || request.url;
  const callback = process.env.STRAVA_OAUTH_REDIRECT_URI?.trim() || new URL('/api/strava/callback', callbackBase).toString();
  const state = `${randomBytes(24).toString('hex')}.${user.id}`;
  const authorization = new URL('https://www.strava.com/oauth/authorize');
  authorization.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callback,
    response_type: 'code',
    approval_prompt: url.searchParams.get('reconnect') === '1' ? 'force' : 'auto',
    scope: STRAVA_REQUESTED_SCOPES,
    state,
  }).toString();

  const response = NextResponse.redirect(authorization);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'lax',
    path: '/api/strava/callback',
    maxAge: 600,
  });
  // After connecting from an activity, come back to it instead of the Import page.
  const returnTo = safeStravaReturnPath(url.searchParams.get('returnTo'));
  response.cookies.set(RETURN_COOKIE, returnTo ?? '', {
    httpOnly: true,
    secure: url.protocol === 'https:',
    sameSite: 'lax',
    path: '/api/strava/callback',
    maxAge: returnTo ? 600 : 0,
  });
  return response;
}
