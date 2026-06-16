import { NextRequest, NextResponse } from 'next/server';
import { requireAthlete } from '@/lib/api-auth';
import { coachRequestService } from '@/lib/coach-request-service';

export async function GET() {
  const { user, error } = await requireAthlete();
  if (error) return error;

  const requests = await coachRequestService.listForAthlete(user.id);

  return NextResponse.json({
    requests: requests.map((request) => ({
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

  const body = await req.json();
  const coachId = Number(body.coachId);
  if (!coachId || Number.isNaN(coachId)) {
    return NextResponse.json({ error: 'Invalid coachId' }, { status: 400 });
  }

  const result = await coachRequestService.createForAthlete(user.id, coachId);
  if (!result.ok) {
    if (result.status === 409) {
      return NextResponse.json({ error: 'Request already pending' }, { status: 409 });
    }
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
