import { after, NextRequest, NextResponse } from 'next/server';
import { isJsonObject } from '@/lib/route-params';
import { isPlausibleEmailAddress, normalizeEmailAddress } from '@/lib/email-address';
import { passwordResetService } from '@/lib/password-reset-service';

const genericResponse = {
  ok: true,
  message: 'If this email has a TempoBuilder password, we’ll send you a reset link shortly. Check your inbox and spam folder.',
};

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Something went wrong. Reload the page and try again.' }, { status: 400 });
  }
  if (!isJsonObject(body) || typeof body.email !== 'string') {
    return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
  }

  const email = normalizeEmailAddress(body.email);
  if (!isPlausibleEmailAddress(email)) {
    return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 });
  }
  if (!passwordResetService.isConfigured()) {
    return NextResponse.json({ error: 'Password reset isn’t working right now. Try again later.' }, { status: 503 });
  }

  after(async () => {
    try {
      await passwordResetService.requestReset(email);
    } catch {
      console.error('Password reset email delivery failed. Check the configured mail provider.');
    }
  });

  return NextResponse.json(genericResponse, { status: 202 });
}
