import { NextRequest, NextResponse } from 'next/server';

import { requireAthlete } from '@/lib/api-auth';
import { readJsonObject } from '@/lib/route-params';
import { startedWorkoutService } from '@/lib/started-workout-service';

/** Opens a catalog workout to follow or ride, without planning it; body: `{ date: 'yyyy-MM-dd' }`, the rider's local day. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { user, error } = await requireAthlete();
    if (error) return error;

    const { slug } = await params;
    const body = await readJsonObject(request);
    if (!body.ok) return NextResponse.json({ error: 'Something went wrong. Reload the page and try again.' }, { status: 400 });

    const result = await startedWorkoutService.start(user.id, { kind: 'catalog', slug }, body.value);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Could not start the ride. Try again.' }, { status: 500 });
  }
}
