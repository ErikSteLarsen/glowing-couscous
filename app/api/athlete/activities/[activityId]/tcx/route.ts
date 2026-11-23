import { NextResponse } from 'next/server';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';
import { stravaPostService } from '@/lib/strava-post-service';

export async function GET(_request: Request, { params }: { params: Promise<{ activityId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Sign in to download this activity.' }, { status: 401 });
  if (!hasAppRole(user)) return NextResponse.json({ error: 'Finish setting up your account first.' }, { status: 403 });
  const file = await stravaPostService.tcxForUser(user.id, Number((await params).activityId));
  if (!file) return NextResponse.json({ error: 'This activity has no recorded data to download.' }, { status: 404 });
  return new Response(file.xml, {
    headers: {
      'content-type': 'application/vnd.garmin.tcx+xml; charset=utf-8',
      'content-disposition': `attachment; filename="${file.filename}"`,
      'cache-control': 'private, no-store',
    },
  });
}
