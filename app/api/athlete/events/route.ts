import { NextResponse } from 'next/server';
import { requireAthlete } from '@/lib/api-auth';
import { athleteEventService } from '@/lib/athlete-event-service';

export async function GET() {
  const { user, error } = await requireAthlete();
  if (error) return error;
  const events = await athleteEventService.list(user.id);
  if (!events) return NextResponse.json({ error: 'Athlete not found.' }, { status: 404 });
  return NextResponse.json({ events });
}

export async function POST(request: Request) {
  const { user, error } = await requireAthlete();
  if (error) return error;
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'Enter valid event details.' }, { status: 400 }); }
  const result = await athleteEventService.create(user.id, body && typeof body === 'object' ? body : {});
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ event: result.value }, { status: 201 });
}
