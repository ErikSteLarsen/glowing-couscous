import { NextResponse } from 'next/server';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';
import { activityImportService } from '@/lib/activity-import-service';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ activityId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in to view this activity.' }, { status: 401 });
  if (!hasAppRole(user)) return NextResponse.json({ error: 'Finish setting up your account first.' }, { status: 403 });

  const { activityId } = await params;
  const telemetry = await activityImportService.loadTelemetry(user.id, Number(activityId));
  return telemetry
    ? NextResponse.json({ telemetry })
    : NextResponse.json({ error: 'Activity not found.' }, { status: 404 });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ activityId: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in to delete an imported activity.' }, { status: 401 });
  if (!hasAppRole(user)) return NextResponse.json({ error: 'Finish setting up your account first.' }, { status: 403 });

  const { activityId } = await params;
  const result = await activityImportService.deleteImportedActivityForUser(user.id, Number(activityId));
  return result.ok
    ? NextResponse.json(result)
    : NextResponse.json({ error: result.error }, { status: result.status });
}
