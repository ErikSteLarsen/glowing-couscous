import { NextRequest, NextResponse } from 'next/server';
import { requireAthlete } from '@/lib/api-auth';
import { athleteService } from '@/lib/athlete-service';
import { coachRequestService } from '@/lib/coach-request-service';
import { isJsonObject, parsePositiveInteger } from '@/lib/route-params';

export async function GET() {
  const { user, error } = await requireAthlete();
  if (error) return error;

  const coachSearchState = await athleteService.loadCoachSearchState(user.id);

  return NextResponse.json({
    requests: coachSearchState.requests.map((request) => ({
      id: request.id,
      status: request.status,
      updatedAt: request.updatedAt.toISOString(),
      coach: request.coach,
    })),
  });
}

export async function POST(req: NextRequest) {
  const { user, error } = await requireAthlete();
  if (error) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!isJsonObject(body)) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const coachId = parsePositiveInteger(body.coachId);
  if (coachId === null) {
    return NextResponse.json({ error: 'Invalid coachId' }, { status: 400 });
  }

  const result = await coachRequestService.createForAthlete(user.id, coachId);
  if (!result.ok) {
    if (result.status === 409) {
      return NextResponse.json({ error: result.error ?? 'Request already pending' }, { status: 409 });
    }
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
