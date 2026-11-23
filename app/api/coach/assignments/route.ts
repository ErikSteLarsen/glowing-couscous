import { isValid, parseISO } from 'date-fns';
import { NextRequest, NextResponse } from 'next/server';
import { requireCoach } from '@/lib/api-auth';
import { assignmentService, type AssignmentSource } from '@/lib/assignment-service';
import { isJsonObject, parsePositiveInteger, readJsonObject } from '@/lib/route-params';

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireCoach();
    if (error) return error;

    const body = await readJsonObject(request);
    if (!body.ok) return NextResponse.json({ error: 'Something went wrong. Reload the page and try again.' }, { status: 400 });
    const parsedAthleteId = parsePositiveInteger(body.value.athleteId);
    if (parsedAthleteId === null) {
      return NextResponse.json({ error: 'Account not found.' }, { status: 400 });
    }

    let source: AssignmentSource;
    if (isJsonObject(body.value.source)) {
      const sourceId = body.value.source.kind === 'library-session'
          ? parsePositiveInteger(body.value.source.sessionId)
          : body.value.source.kind === 'training-plan'
            ? parsePositiveInteger(body.value.source.trainingPlanId)
            : null;
      if (sourceId === null) return NextResponse.json({ error: 'Choose a workout or training plan.' }, { status: 400 });
      if (body.value.source.kind === 'library-session') source = { kind: 'library-session', sessionId: sourceId };
      else if (body.value.source.kind === 'training-plan') source = { kind: 'training-plan', trainingPlanId: sourceId };
      else return NextResponse.json({ error: 'Choose a workout or training plan.' }, { status: 400 });
    } else {
      return NextResponse.json({ error: 'Choose a workout or training plan.' }, { status: 400 });
    }

    const scheduledDate = typeof body.value.scheduledDate === 'string' ? body.value.scheduledDate : '';
    const requestedDates = readAssignmentDates(body.value.dates, scheduledDate);
    if (requestedDates.length === 0) return NextResponse.json({ error: 'Choose at least one valid target date.' }, { status: 400 });

    const command = {
      coachId: user.id,
      athleteId: parsedAthleteId,
      source,
      weekStart: typeof body.value.weekStart === 'string' ? body.value.weekStart : undefined,
    };
    const result = Array.isArray(body.value.dates)
      ? await assignmentService.assignSourcesToAthlete(command, requestedDates)
      : await assignmentService.assignSourceToAthlete({ ...command, scheduledDate: requestedDates[0] });

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    return NextResponse.json({ ok: true, sessionIds: 'sessionIds' in result ? result.sessionIds : [result.sessionId] }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Could not add this to the athlete’s calendar. Try again.' }, { status: 500 });
  }
}

function readAssignmentDates(value: unknown, fallback: string) {
  const candidates = Array.isArray(value) ? value : [fallback];
  if (candidates.some((candidate) => typeof candidate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(candidate) || !isValid(parseISO(`${candidate}T00:00:00.000Z`)))) return [];
  return Array.from(new Set(candidates.filter((candidate): candidate is string => (
    typeof candidate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(candidate) && isValid(parseISO(`${candidate}T00:00:00.000Z`))
  )))).sort();
}
