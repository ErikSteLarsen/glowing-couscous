import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { parseSessionPrincipal } from '@/lib/auth-principal';
import { hasAppRole } from '@/lib/auth-session';

const forbidden = NextResponse.json({ error: 'You don’t have access to this.' }, { status: 403 });
const unauthorized = NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 });

export async function requireSignedInUser() {
  const session = await auth();
  const user = parseSessionPrincipal(session?.user);
  if (!user) return { user: null, error: unauthorized };
  return { user, error: null };
}

export async function requireCoach() {
  const session = await auth();
  const user = parseSessionPrincipal(session?.user);
  if (!user) return { user: null, error: unauthorized };
  if (!hasAppRole(user) || user.role !== 'COACH') return { user: null, error: forbidden };
  return { user, error: null };
}

export async function requireAthlete() {
  const session = await auth();
  const user = parseSessionPrincipal(session?.user);
  if (!user) return { user: null, error: unauthorized };
  if (!hasAppRole(user)) return { user: null, error: forbidden };
  return { user, error: null };
}
