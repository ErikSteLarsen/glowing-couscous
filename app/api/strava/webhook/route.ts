import { timingSafeEqual } from 'node:crypto';
import { after, NextResponse } from 'next/server';
import { stravaService } from '@/lib/strava-service';

export const runtime = 'nodejs';
export const maxDuration = 60;

function constantTimeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const challenge = url.searchParams.get('hub.challenge');
  const verifyToken = url.searchParams.get('hub.verify_token') ?? '';
  const expected = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN?.trim() ?? '';
  if (url.searchParams.get('hub.mode') !== 'subscribe' || !challenge || !expected || !constantTimeEqual(verifyToken, expected)) {
    return NextResponse.json({ error: 'Webhook verification failed.' }, { status: 403 });
  }
  return NextResponse.json({ 'hub.challenge': challenge });
}

export async function POST(request: Request) {
  const expectedSubscription = Number(process.env.STRAVA_WEBHOOK_SUBSCRIPTION_ID);
  if (!Number.isSafeInteger(expectedSubscription) || expectedSubscription <= 0) {
    return NextResponse.json({ error: 'Webhook subscription is not configured.' }, { status: 503 });
  }
  const contentLength = Number(request.headers.get('content-length') ?? 0);
  if (contentLength > 32_768) return NextResponse.json({ error: 'Webhook event is too large.' }, { status: 413 });

  let payload: unknown;
  try {
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > 32_768) return NextResponse.json({ error: 'Webhook event is too large.' }, { status: 413 });
    payload = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'Webhook event is not valid JSON.' }, { status: 400 });
  }

  const event = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const ownerId = event.owner_id;
  const objectId = event.object_id;
  const subscriptionId = event.subscription_id;
  const eventTime = event.event_time;
  const objectType = event.object_type;
  const aspectType = event.aspect_type;
  const rawUpdates = event.updates && typeof event.updates === 'object' ? event.updates as Record<string, unknown> : {};
  const updates = Object.fromEntries(['title', 'type', 'private', 'authorized'].flatMap((key) =>
    typeof rawUpdates[key] === 'string' || typeof rawUpdates[key] === 'boolean' ? [[key, rawUpdates[key]]] : [],
  ));
  if (!Number.isSafeInteger(ownerId) || Number(ownerId) <= 0 || !Number.isSafeInteger(objectId) || Number(objectId) <= 0 ||
      subscriptionId !== expectedSubscription || !Number.isSafeInteger(eventTime) || Number(eventTime) <= 0 ||
      !['activity', 'athlete'].includes(String(objectType)) || !['create', 'update', 'delete'].includes(String(aspectType))) {
    return NextResponse.json({ error: 'Webhook event did not match the expected subscription format.' }, { status: 400 });
  }

  try {
    const eventId = await stravaService.enqueueWebhookEvent({
      ownerAthleteId: String(ownerId),
      objectId: String(objectId),
      objectType: String(objectType),
      aspectType: String(aspectType),
      updates,
      eventTime: Number(eventTime),
      subscriptionId: Number(subscriptionId),
    });
    after(async () => { await stravaService.processWebhookEvent(eventId).catch(() => undefined); });
    return NextResponse.json({ accepted: true });
  } catch {
    return NextResponse.json({ error: 'Webhook event could not be queued.' }, { status: 500 });
  }
}
