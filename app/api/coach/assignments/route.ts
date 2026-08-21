import { NextRequest, NextResponse } from 'next/server';
import { requireCoach } from '@/lib/api-auth';
import { assignmentService, type AssignmentSource } from '@/lib/assignment-service';
import { isJsonObject, parsePositiveInteger, readJsonObject } from '@/lib/route-params';

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireCoach();
    if (error) return error;

    const body = await readJsonObject(request);
    if (!body.ok) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    const parsedAthleteId = parsePositiveInteger(body.value.athleteId);
    if (parsedAthleteId === null) {
      return NextResponse.json({ error: 'Invalid athleteId' }, { status: 400 });
    }

    let source: AssignmentSource;
    if (isJsonObject(body.value.source)) {
      const sourceId = body.value.source.kind === 'template'
        ? parsePositiveInteger(body.value.source.templateId)
        : body.value.source.kind === 'library-session'
          ? parsePositiveInteger(body.value.source.sessionId)
          : body.value.source.kind === 'training-plan'
            ? parsePositiveInteger(body.value.source.trainingPlanId)
            : null;
      if (sourceId === null) return NextResponse.json({ error: 'Invalid source' }, { status: 400 });
      if (body.value.source.kind === 'template') source = { kind: 'template', templateId: sourceId };
      else if (body.value.source.kind === 'library-session') source = { kind: 'library-session', sessionId: sourceId };
      else if (body.value.source.kind === 'training-plan') source = { kind: 'training-plan', trainingPlanId: sourceId };
      else return NextResponse.json({ error: 'Invalid source' }, { status: 400 });
    } else {
      const parsedTemplateId = parsePositiveInteger(body.value.templateId);
      if (parsedTemplateId === null) return NextResponse.json({ error: 'Invalid templateId' }, { status: 400 });
      source = { kind: 'template', templateId: parsedTemplateId };
    }

    const result = await assignmentService.assignSourceToAthlete({
      coachId: user.id,
      athleteId: parsedAthleteId,
      source,
      scheduledDate: typeof body.value.scheduledDate === 'string' ? body.value.scheduledDate : '',
      weekStart: typeof body.value.weekStart === 'string' ? body.value.weekStart : undefined,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(
      'sessionIds' in result ? { ok: true, sessionIds: result.sessionIds } : { ok: true, sessionId: result.sessionId },
      { status: 201 },
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to assign template' }, { status: 500 });
  }
}
