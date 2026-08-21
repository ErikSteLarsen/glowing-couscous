import { NextRequest, NextResponse } from 'next/server';
import { requireCoach } from '@/lib/api-auth';
import { assignmentService } from '@/lib/assignment-service';
import { parsePositiveInteger, readJsonObject } from '@/lib/route-params';

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireCoach();
    if (error) return error;

    const body = await readJsonObject(request);
    if (!body.ok) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    const parsedAthleteId = parsePositiveInteger(body.value.athleteId);
    const parsedTemplateId = parsePositiveInteger(body.value.templateId);

    if (parsedAthleteId === null) {
      return NextResponse.json({ error: 'Invalid athleteId' }, { status: 400 });
    }

    if (parsedTemplateId === null) {
      return NextResponse.json({ error: 'Invalid templateId' }, { status: 400 });
    }

    const result = await assignmentService.assignTemplateToAthlete({
      coachId: user.id,
      athleteId: parsedAthleteId,
      templateId: parsedTemplateId,
      scheduledDate: typeof body.value.scheduledDate === 'string' ? body.value.scheduledDate : '',
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ ok: true, sessionId: result.sessionId }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to assign template' }, { status: 500 });
  }
}
