import { NextRequest, NextResponse } from 'next/server';
import { getCurrentCoach } from '@/lib/demo-session';
import { templateService } from '@/lib/template-service';

export async function POST(request: NextRequest) {
  try {
    const coach = await getCurrentCoach();
    if (!coach) {
      return NextResponse.json({ error: 'Coach not found' }, { status: 404 });
    }

    const body = await request.json();
    const result = await templateService.saveForCoach(coach.id, body);

    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}
