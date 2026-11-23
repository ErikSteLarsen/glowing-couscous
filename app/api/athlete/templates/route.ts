import { NextRequest, NextResponse } from 'next/server';

import { requireAthlete } from '@/lib/api-auth';
import { templateService } from '@/lib/template-service';
import { readJsonObject } from '@/lib/route-params';

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAthlete();
    if (error) return error;
    const body = await readJsonObject(request);
    if (!body.ok) return NextResponse.json({ error: 'Something went wrong. Reload the page and try again.' }, { status: 400 });
    const result = await templateService.saveForOwner(user.id, body.value);
    if (result.error) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Could not save this routine. Try again.' }, { status: 500 });
  }
}
