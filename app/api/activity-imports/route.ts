import { NextResponse } from 'next/server';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';
import { activityImportService } from '@/lib/activity-import-service';

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in to import an activity.' }, { status: 401 });
  if (!hasAppRole(user)) return NextResponse.json({ error: 'Complete account setup first.' }, { status: 403 });

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: 'Activity data could not be read.' }, { status: 400 });
  }

  const result = await activityImportService.importForUser(user.id, input);
  return result.ok
    ? NextResponse.json(result, { status: 201 })
    : NextResponse.json({ error: result.error }, { status: result.status });
}
