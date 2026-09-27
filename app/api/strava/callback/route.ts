import { timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';
import { stravaService, StravaConnectionConflictError } from '@/lib/strava-service';

const STATE_COOKIE = 'tempo_strava_oauth_state';
const IMPORT_PATH = '/athlete/import';

function redirectToImport(request: Request, result: string) {
  const url = new URL(IMPORT_PATH, request.url);
  url.searchParams.set('strava', result);
  const response = NextResponse.redirect(url);
  response.cookies.set(STATE_COOKIE, '', {
    httpOnly: true,
    secure: new URL(request.url).protocol === 'https:',
    sameSite: 'lax',
    path: '/api/strava/callback',
    maxAge: 0,
  });
  return response;
}

function matchesState(received: string, expected: string) {
  const left = Buffer.from(received);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const state = url.searchParams.get('state') ?? '';
  const code = url.searchParams.get('code') ?? '';
  const cookieStore = await cookies();
  const cookieState = cookieStore.get(STATE_COOKIE)?.value ?? '';
  const user = await getCurrentUser();
  const responseState = `${state.split('.')[0] ?? ''}.${user?.id ?? ''}`;
  if (!user || !hasAppRole(user) || !cookieState || !matchesState(state, cookieState) || !matchesState(state, responseState)) {
    return redirectToImport(request, 'error:state');
  }
  if (url.searchParams.get('error') === 'access_denied') return redirectToImport(request, 'cancelled');
  if (!code) return redirectToImport(request, 'error:authorization');

  try {
    const scopes = url.searchParams.get('scope') ?? '';
    const connection = await stravaService.connectAccount(user.id, code, scopes);
    let syncFailed = false;
    try {
      await stravaService.syncRecentActivities(user.id);
    } catch {
      syncFailed = true;
    }
    if (syncFailed && !connection.previousProviderRevoked) return redirectToImport(request, 'connected:sync-revoke-error');
    if (syncFailed) return redirectToImport(request, 'connected:sync-error');
    if (!connection.previousProviderRevoked) return redirectToImport(request, 'connected:revoke-error');
    return redirectToImport(request, 'connected');
  } catch (error) {
    if (error instanceof StravaConnectionConflictError) return redirectToImport(request, 'error:account-linked');
    return redirectToImport(request, 'error:connect');
  }
}
