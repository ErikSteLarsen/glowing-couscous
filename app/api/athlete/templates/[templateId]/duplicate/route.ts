import { NextRequest, NextResponse } from 'next/server';

import { requireAthlete } from '@/lib/api-auth';
import { templateService } from '@/lib/template-service';
import { parsePositiveInteger } from '@/lib/route-params';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> },
) {
  const { user, error } = await requireAthlete();
  if (error) return error;
  const { templateId } = await params;
  const parsedTemplateId = parsePositiveInteger(templateId);
  if (parsedTemplateId === null) return NextResponse.json({ error: 'Invalid templateId' }, { status: 400 });
  const result = await templateService.duplicateForOwner(user.id, parsedTemplateId);
  if (result.error) return NextResponse.json({ error: result.error }, { status: 404 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
