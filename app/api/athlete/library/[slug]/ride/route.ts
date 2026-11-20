import { NextRequest, NextResponse } from 'next/server';

import { requireAthlete } from '@/lib/api-auth';
import { readJsonObject } from '@/lib/route-params';
import { workoutCatalogService } from '@/lib/workout-catalog-service';

/** Plans this catalog workout on the rider's local day and returns the session to ride; body: `{ date: 'yyyy-MM-dd' }`. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { user, error } = await requireAthlete();
    if (error) return error;

    const { slug } = await params;
    const body = await readJsonObject(request);
    if (!body.ok) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const result = await workoutCatalogService.rideNow(user.id, slug, body.value);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to start the ride' }, { status: 500 });
  }
}
