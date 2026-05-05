import { NextRequest, NextResponse } from 'next/server';
import { getCurrentCoach } from '@/lib/demo-session';
import { templateService } from '@/lib/template-service';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> },
) {
  try {
    const coach = await getCurrentCoach();
    if (!coach) {
      return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
    }

    const { templateId } = await params;
    const body = await request.json();
    const result = await templateService.saveForCoach(coach.id, body, Number(templateId));

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> },
) {
  try {
    const coach = await getCurrentCoach();
    if (!coach) {
      return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
    }

    const { templateId } = await params;
    const result = await templateService.deleteForCoach(coach.id, Number(templateId));

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}
