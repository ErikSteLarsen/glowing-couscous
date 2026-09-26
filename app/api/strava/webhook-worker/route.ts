import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { stravaService } from '@/lib/strava-service';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const expected = process.env.STRAVA_WEBHOOK_WORKER_SECRET ?? '';
  const received = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  if (!expected || left.length !== right.length || !timingSafeEqual(left, right)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  const processed = await stravaService.processPendingWebhookEvents();
  return NextResponse.json({ processed });
}
