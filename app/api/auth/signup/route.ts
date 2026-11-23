import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { isJsonObject } from '@/lib/route-params';
import { isPlausibleEmailAddress, normalizeEmailAddress } from '@/lib/email-address';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Something went wrong. Reload the page and try again.' }, { status: 400 });
  }
  if (!isJsonObject(body)) {
    return NextResponse.json({ error: 'Something went wrong. Reload the page and try again.' }, { status: 400 });
  }
  const { name, email, password } = body;

  if (typeof name !== 'string' || typeof email !== 'string' || typeof password !== 'string') {
    return NextResponse.json({ error: 'Something went wrong. Reload the page and try again.' }, { status: 400 });
  }
  const displayName = name.trim();
  if (!displayName) {
    return NextResponse.json({ error: 'Enter your name' }, { status: 400 });
  }
  const normalizedEmail = normalizeEmailAddress(email);
  if (!isPlausibleEmailAddress(normalizedEmail)) {
    return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Use at least 8 characters for your password.' }, { status: 400 });
  }
  if (Buffer.byteLength(password, 'utf8') > 72) {
    return NextResponse.json({ error: 'That password is too long. Use a shorter one.' }, { status: 400 });
  }

  const existing = await prisma.user.findFirst({
    where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  try {
    await prisma.user.create({ data: { name: displayName, email: normalizedEmail, passwordHash, role: 'ATHLETE', selfCoached: true } });
  } catch (error) {
    if (isUniqueConflict(error)) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

function isUniqueConflict(error: unknown) {
  return Boolean(error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === 'P2002');
}
