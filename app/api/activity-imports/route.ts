import { after, NextResponse } from 'next/server';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';
import { activityImportService } from '@/lib/activity-import-service';
import { activityAnalysisService } from '@/lib/activity-analysis-service';

export const maxDuration = 60;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in to import an activity.' }, { status: 401 });
  if (!hasAppRole(user)) return NextResponse.json({ error: 'Finish setting up your account first.' }, { status: 403 });

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json({ error: 'Could not read this activity. Try again.' }, { status: 400 });
  }

  const result = await activityImportService.importForUser(user.id, input);
  if (result.ok) after(() => activityAnalysisService.processOne(result.activityId, user.id));
  return result.ok
    ? NextResponse.json(result, { status: 201 })
    : NextResponse.json({ error: result.error }, { status: result.status });
}
