import { NextRequest, NextResponse } from 'next/server';
import { requireCoach } from '@/lib/api-auth';
import { coachRequestService } from '@/lib/coach-request-service';
import { readJsonObject, parsePositiveInteger } from '@/lib/route-params';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> },
) {
  const { user, error } = await requireCoach();
  if (error) return error;

  const { requestId } = await params;
  const parsedRequestId = parsePositiveInteger(requestId);
  if (parsedRequestId === null) {
    return NextResponse.json({ error: 'Request not found.' }, { status: 400 });
  }

  const body = await readJsonObject(req);
  if (!body.ok) return NextResponse.json({ error: 'Something went wrong. Reload the page and try again.' }, { status: 400 });
  const { action } = body.value;
  if (action !== 'accept' && action !== 'reject') {
    return NextResponse.json({ error: 'Something went wrong. Reload the page and try again.' }, { status: 400 });
  }

  const result = await coachRequestService.decideForCoach(user.id, parsedRequestId, action);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true });
}
