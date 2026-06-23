import { NextRequest, NextResponse } from 'next/server';
import { requireCoach } from '@/lib/api-auth';
import { assignmentService } from '@/lib/assignment-service';

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireCoach();
    if (error) return error;

    const body = (await request.json()) as {
      athleteId?: number;
      templateId?: number;
      scheduledDate?: string;
    };
    const parsedAthleteId = Number(body.athleteId);
    const parsedTemplateId = Number(body.templateId);

    if (!Number.isInteger(parsedAthleteId) || parsedAthleteId <= 0) {
      return NextResponse.json({ error: 'Invalid athleteId' }, { status: 400 });
    }

    if (!Number.isInteger(parsedTemplateId) || parsedTemplateId <= 0) {
      return NextResponse.json({ error: 'Invalid templateId' }, { status: 400 });
    }

    const result = await assignmentService.assignTemplateToAthlete({
      coachId: user.id,
      athleteId: parsedAthleteId,
      templateId: parsedTemplateId,
      scheduledDate: typeof body.scheduledDate === 'string' ? body.scheduledDate : '',
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
