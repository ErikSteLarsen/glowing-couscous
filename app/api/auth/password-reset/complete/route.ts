import { NextRequest, NextResponse } from 'next/server';
import { isJsonObject } from '@/lib/route-params';
import { passwordResetService } from '@/lib/password-reset-service';

const invalidLinkMessage = 'This password reset link is invalid or has expired. Request a new one to continue.';

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!isJsonObject(body) || typeof body.token !== 'string' || typeof body.password !== 'string') {
    return NextResponse.json({ error: invalidLinkMessage }, { status: 400 });
  }
  if (body.password.length < 8) {
    return NextResponse.json({ error: 'Use at least 8 characters for your password.' }, { status: 400 });
  }
  if (Buffer.byteLength(body.password, 'utf8') > 72) {
    return NextResponse.json({ error: 'That password is too long. Use up to 72 bytes.' }, { status: 400 });
  }

  try {
    const changed = await passwordResetService.completeReset(body.token, body.password);
    if (!changed) return NextResponse.json({ error: invalidLinkMessage }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'We couldn’t update your password. Please try again.' }, { status: 503 });
  }
}
