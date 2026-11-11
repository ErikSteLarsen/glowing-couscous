import { NextRequest, NextResponse } from 'next/server';

import { requireSignedInUser } from '@/lib/api-auth';
import { shareLinkService } from '@/lib/share-link-service';
import { isJsonObject, readJsonObject } from '@/lib/route-params';

const actions = ['planner', 'template'] as const;

export async function POST(request: NextRequest) {
  const { user, error } = await requireSignedInUser();
  if (error) return error;
  if (!user.role) return NextResponse.json({ error: 'Choose a role before saving.' }, { status: 409 });

  const body = await readJsonObject(request);
  if (!body.ok) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  const token = body.value.token;
  const action = body.value.action;
  if (typeof token !== 'string' || !actions.includes(action as (typeof actions)[number]) || !isJsonObject(body.value.draft)) {
    return NextResponse.json({ error: 'Share action and draft are required.' }, { status: 400 });
  }

  if (action === 'template' && user.role !== 'ATHLETE') {
    return NextResponse.json({ error: 'Shared template copies are available to Athlete accounts.' }, { status: 403 });
  }
  const result = action === 'template'
    ? await shareLinkService.saveTemplateCopy(user.id, token, body.value.draft)
    : await shareLinkService.savePlannerCopy(user.id, user.role, token, body.value.draft);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, sessionIds: 'sessionIds' in result ? result.sessionIds : undefined }, { status: 201 });
}
