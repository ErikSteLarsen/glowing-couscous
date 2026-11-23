import { NextRequest, NextResponse } from 'next/server';

import { requireAthlete } from '@/lib/api-auth';
import { athletePlannerService } from '@/lib/athlete-planner-service';
import { readJsonObject } from '@/lib/route-params';

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAthlete();
    if (error) return error;

    const body = await readJsonObject(request);
    if (!body.ok) return NextResponse.json({ error: 'Something went wrong. Reload the page and try again.' }, { status: 400 });
    const result = await athletePlannerService.saveSession(user.id, body.value);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    return NextResponse.json({ ok: true, sessionIds: result.sessionIds }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Could not create this workout. Try again.' }, { status: 500 });
  }
}
