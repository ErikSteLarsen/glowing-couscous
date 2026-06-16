import { NextRequest, NextResponse } from 'next/server';
import { requireCoach } from '@/lib/api-auth';
import { coachRequestService } from '@/lib/coach-request-service';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const { user, error } = await requireCoach();
  if (error) return error;

  const { requestId } = await params;
  const parsedRequestId = Number(requestId);
  if (!Number.isInteger(parsedRequestId) || parsedRequestId <= 0) {
    return NextResponse.json({ error: 'Invalid requestId' }, { status: 400 });
  }

  const { action } = await req.json();
  if (action !== 'accept' && action !== 'reject') {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  const result = await coachRequestService.decideForCoach(user.id, parsedRequestId, action);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
