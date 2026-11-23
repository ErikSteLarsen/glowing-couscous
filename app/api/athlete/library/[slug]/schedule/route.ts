import { NextRequest, NextResponse } from 'next/server';

import { requireAthlete } from '@/lib/api-auth';
import { readJsonObject } from '@/lib/route-params';
import { workoutCatalogService } from '@/lib/workout-catalog-service';

/** Places copies on chosen dates; body: `{ dates: ['yyyy-MM-dd'], timeLabel?, requestKey }`. Retrying a requestKey replays the first result. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  try {
    const { user, error } = await requireAthlete();
    if (error) return error;

    const { slug } = await params;
    const body = await readJsonObject(request);
    if (!body.ok) return NextResponse.json({ error: 'Something went wrong. Reload the page and try again.' }, { status: 400 });

    const result = await workoutCatalogService.schedule(user.id, slug, body.value);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Could not add this workout to your Calendar. Try again.' }, { status: 500 });
  }
}
