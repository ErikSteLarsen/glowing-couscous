import { NextRequest, NextResponse } from 'next/server';

import { requireAthlete } from '@/lib/api-auth';
import { athletePlannerService } from '@/lib/athlete-planner-service';
import { parsePositiveInteger, readJsonObject } from '@/lib/route-params';

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAthlete();
    if (error) return error;

    const body = await readJsonObject(request);
    if (!body.ok) return NextResponse.json({ error: 'Something went wrong. Reload the page and try again.' }, { status: 400 });

    const sourceKind = body.value.sourceKind;
    if (sourceKind !== 'workout' && sourceKind !== 'template' && sourceKind !== 'built-in-plan') {
      return NextResponse.json({ error: 'Choose a workout or training plan.' }, { status: 400 });
    }

    const sourceId = sourceKind === 'built-in-plan' ? body.value.sourceId : parsePositiveInteger(body.value.sourceId);
    if (sourceId === null) return NextResponse.json({ error: 'Choose a workout or training plan.' }, { status: 400 });

    const result = await athletePlannerService.assignSource(user.id, {
      sourceKind,
      sourceId,
      version: body.value.version,
      choices: body.value.choices,
      dates: body.value.dates,
      requestKey: body.value.requestKey,
      timeLabel: body.value.timeLabel,
    });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    return NextResponse.json({ ok: true, sessionIds: result.sessionIds }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Could not add this to your Calendar. Try again.' }, { status: 500 });
  }
}
