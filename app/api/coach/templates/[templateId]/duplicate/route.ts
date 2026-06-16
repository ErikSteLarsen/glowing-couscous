import { NextRequest, NextResponse } from 'next/server';
import { requireCoach } from '@/lib/api-auth';
import { templateService } from '@/lib/template-service';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const { user, error } = await requireCoach();
  if (error) return error;

  const { templateId } = await params;
  const parsedTemplateId = Number(templateId);
  if (!Number.isInteger(parsedTemplateId) || parsedTemplateId <= 0) {
    return NextResponse.json({ error: 'Invalid templateId' }, { status: 400 });
  }

  const result = await templateService.duplicateForCoach(user.id, parsedTemplateId);
  if (result.error) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
