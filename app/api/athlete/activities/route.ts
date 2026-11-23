import { NextRequest, NextResponse } from 'next/server';
import { requireAthlete } from '@/lib/api-auth';
import { athleteManualActivityService } from '@/lib/athlete-manual-activity-service';
import { isJsonObject } from '@/lib/route-params';

export async function GET(request: NextRequest) {
  const { user, error } = await requireAthlete();
  if (error) return error;
  const { searchParams } = new URL(request.url);
  const candidates = await athleteManualActivityService.candidates(user.id, searchParams.get('sport'), searchParams.get('completedOn'));
  return NextResponse.json({ candidates });
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireAthlete();
  if (error) return error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Something went wrong. Reload the page and try again.' }, { status: 400 });
  }
  if (!isJsonObject(body)) return NextResponse.json({ error: 'Something went wrong. Reload the page and try again.' }, { status: 400 });

  const result = await athleteManualActivityService.create(user.id, {
    sport: body.sport,
    title: body.title,
    completedOn: body.completedOn,
    durationMinutes: body.durationMinutes,
    distanceKm: body.distanceKm,
    rpe: body.rpe,
    notes: body.notes,
    requestKey: body.requestKey,
    pairingChoice: body.pairingChoice,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({
    sessionId: result.sessionId,
    completedAt: result.completedAt.toISOString(),
    href: `/athlete/session/${result.sessionId}?from=activity`,
  }, { status: 201 });
}
