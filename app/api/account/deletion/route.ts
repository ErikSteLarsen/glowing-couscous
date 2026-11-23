import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { parseSessionPrincipal } from '@/lib/auth-principal';
import { accountDeletionService } from '@/lib/account-deletion-service';

const headers = { 'Cache-Control': 'no-store' };

export async function GET() {
  const session = await auth();
  const user = parseSessionPrincipal(session?.user);
  if (!user) return NextResponse.json({ error: 'Sign in again.' }, { status: 401, headers });
  return NextResponse.json(await accountDeletionService.preview(user.id), { headers });
}

export async function DELETE(request: Request) {
  // Cookie authentication alone is not a cross-site mutation authorization.
  if (request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({ error: 'Something went wrong. Reload the page and try again.' }, { status: 403, headers });
  const session = await auth();
  const user = parseSessionPrincipal(session?.user);
  if (!user || !Number.isSafeInteger(session?.user.sessionVersion)) return NextResponse.json({ error: 'Sign in again.' }, { status: 401, headers });
  const text = await request.text();
  if (text.length > 4096) return NextResponse.json({ error: 'That request is too large. Try again.' }, { status: 413, headers });
  const body = (() => { try { return JSON.parse(text); } catch { return null; } })();
  if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ error: 'Something went wrong. Reload the page and try again.' }, { status: 400, headers });
  const result = await accountDeletionService.deleteAccount(user.id, body, {
    sessionVersion: session!.user.sessionVersion!, signInProvider: session!.user.signInProvider, authenticatedAt: session!.user.authenticatedAt,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : result.status, headers });
}
