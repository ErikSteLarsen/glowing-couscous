import { NextRequest, NextResponse } from 'next/server';

import { requireAthlete } from '@/lib/api-auth';
import { guidedWorkoutService } from '@/lib/guided-workout-service';
import { readJsonObject } from '@/lib/route-params';

export async function POST(request: NextRequest) {
  const { user, error } = await requireAthlete();
  if (error) return error;
  const body = await readJsonObject(request);
  if (!body.ok) return NextResponse.json({ error: 'Something went wrong. Reload the page and try again.' }, { status: 400 });
  const result = await guidedWorkoutService.generateForAthlete(user.id, body.value);
  return NextResponse.json(result, { status: result.ok ? 200 : result.status, headers: { 'Cache-Control': 'private, no-store' } });
}
