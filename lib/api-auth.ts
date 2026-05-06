import { NextResponse } from 'next/server';
import { auth } from '@/auth';

const forbidden = NextResponse.json({ error: 'Forbidden' }, { status: 403 });
const unauthorized = NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

export async function requireCoach() {
  const session = await auth();
  if (!session?.user) return { user: null, error: unauthorized };
  if (session.user.role !== 'COACH') return { user: null, error: forbidden };
  return { user: session.user as { id: number; role: string; name?: string | null; email?: string | null }, error: null };
}

export async function requireAthlete() {
  const session = await auth();
  if (!session?.user) return { user: null, error: unauthorized };
  if (session.user.role !== 'ATHLETE') return { user: null, error: forbidden };
  return { user: session.user as { id: number; role: string; name?: string | null; email?: string | null }, error: null };
}
