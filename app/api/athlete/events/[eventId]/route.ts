import { NextResponse } from 'next/server';
import { requireAthlete } from '@/lib/api-auth';
import { parsePositiveInteger } from '@/lib/route-params';
import { athleteEventService } from '@/lib/athlete-event-service';

type Context = { params: Promise<{ eventId: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const { user, error } = await requireAthlete();
  if (error) return error;
  const { eventId: rawId } = await params;
  const eventId = parsePositiveInteger(rawId);
  if (!eventId) return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Enter valid event details.' }, { status: 400 }); }
  const result = body.action === 'result'
    ? await athleteEventService.recordResult(user.id, eventId, body)
    : await athleteEventService.update(user.id, eventId, body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ event: result.value });
}

export async function DELETE(_request: Request, { params }: Context) {
  const { user, error } = await requireAthlete();
  if (error) return error;
  const { eventId: rawId } = await params;
  const eventId = parsePositiveInteger(rawId);
  if (!eventId) return NextResponse.json({ error: 'Event not found.' }, { status: 404 });
  const result = await athleteEventService.delete(user.id, eventId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
