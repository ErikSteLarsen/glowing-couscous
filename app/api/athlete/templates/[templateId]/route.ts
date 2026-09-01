import { NextRequest, NextResponse } from 'next/server';

import { requireAthlete } from '@/lib/api-auth';
import { templateService } from '@/lib/template-service';
import { parsePositiveInteger, readJsonObject } from '@/lib/route-params';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> },
) {
  try {
    const { user, error } = await requireAthlete();
    if (error) return error;
    const { templateId } = await params;
    const parsedTemplateId = parsePositiveInteger(templateId);
    if (parsedTemplateId === null) return NextResponse.json({ error: 'Invalid templateId' }, { status: 400 });
    const body = await readJsonObject(request);
    if (!body.ok) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    const result = await templateService.saveForOwner(user.id, body.value, parsedTemplateId);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
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
    const { user, error } = await requireAthlete();
    if (error) return error;
    const { templateId } = await params;
    const parsedTemplateId = parsePositiveInteger(templateId);
    if (parsedTemplateId === null) return NextResponse.json({ error: 'Invalid templateId' }, { status: 400 });
    const result = await templateService.deleteForOwner(user.id, parsedTemplateId);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}
