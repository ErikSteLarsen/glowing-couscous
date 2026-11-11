import { NextResponse } from 'next/server';
import { requireAthlete } from '@/lib/api-auth';
import { parsePositiveInteger } from '@/lib/route-params';
import { athleteEventService } from '@/lib/athlete-event-service';

type Context = { params: Promise<{ eventId: string }> };

async function getEventId(params: Context['params']) {
  const { eventId } = await params;
  return parsePositiveInteger(eventId);
}

export async function GET(request: Request, { params }: Context) {
  const { user, error } = await requireAthlete();
  if (error) return error;
  const eventId = await getEventId(params);
  if (!eventId) return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
  const url = new URL(request.url);
  const pageValue = Number(url.searchParams.get('page') ?? 0);
  const page = Number.isInteger(pageValue) && pageValue >= 0 ? pageValue : 0;
  const result = await athleteEventService.searchActivities(user.id, eventId, url.searchParams.get('q'), page);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.value);
}

export async function POST(request: Request, { params }: Context) {
  const { user, error } = await requireAthlete();
  if (error) return error;
  const eventId = await getEventId(params);
  if (!eventId) return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
  let body: unknown;
  try { body = await request.json(); } catch { body = {}; }
  const activityId = body && typeof body === 'object' && !Array.isArray(body) && 'activityId' in body ? body.activityId : undefined;
  const result = await athleteEventService.linkActivity(user.id, eventId, activityId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: Request, { params }: Context) {
  const { user, error } = await requireAthlete();
  if (error) return error;
  const eventId = await getEventId(params);
  const activityId = parsePositiveInteger(new URL(request.url).searchParams.get('activityId'));
  if (!eventId || !activityId) return NextResponse.json({ error: 'Linked activity not found.' }, { status: 404 });
  const result = await athleteEventService.unlinkActivity(user.id, eventId, activityId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
