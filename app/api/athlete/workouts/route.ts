import { NextRequest, NextResponse } from 'next/server';

import { requireAthlete } from '@/lib/api-auth';
import { readJsonObject } from '@/lib/route-params';
import { workoutLibraryService } from '@/lib/workout-library-service';

export async function GET() {
  const { user, error } = await requireAthlete();
  if (error) return error;

  const workouts = await workoutLibraryService.listForOwner('athlete', user.id);
  return NextResponse.json({ workouts });
}

export async function POST(request: NextRequest) {
  const { user, error } = await requireAthlete();
  if (error) return error;

  const body = await readJsonObject(request);
  if (!body.ok) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  const result = await workoutLibraryService.saveForOwner('athlete', user.id, body.value);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result, { status: 201 });
}
