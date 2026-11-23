import { NextRequest, NextResponse } from 'next/server';
import { requireAthlete } from '@/lib/api-auth';
import { athleteManualActivityService } from '@/lib/athlete-manual-activity-service';
import { isJsonObject, parsePositiveInteger } from '@/lib/route-params';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ activityId: string }> },
) {
  try {
    const { user, error } = await requireAthlete();
    if (error) return error;

    const { activityId } = await params;
    const parsedActivityId = parsePositiveInteger(activityId);
    if (parsedActivityId === null) return NextResponse.json({ error: 'Activity not found.' }, { status: 400 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Something went wrong. Reload the page and try again.' }, { status: 400 });
    }
    if (!isJsonObject(body)) return NextResponse.json({ error: 'Something went wrong. Reload the page and try again.' }, { status: 400 });

    const result = await athleteManualActivityService.correct(user.id, parsedActivityId, body);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    return NextResponse.json({
      ok: true,
      activityId: result.activityId,
      sessionId: result.sessionId,
      completedAt: result.completedAt.toISOString(),
      updatedAt: result.updatedAt.toISOString(),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Could not save your changes. Try again.' }, { status: 500 });
  }
}
