import { NextRequest, NextResponse } from 'next/server';

import { requireSignedInUser } from '@/lib/api-auth';
import { createShareLinkService, type ShareLinkAction } from '@/lib/share-link-service';
import { isJsonObject, readJsonObject } from '@/lib/route-params';

const actions: readonly ShareLinkAction[] = ['planner', 'template'];

export async function POST(request: NextRequest) {
  const { user, error } = await requireSignedInUser();
  if (error) return error;
  if (!user.role) return NextResponse.json({ error: 'Choose a role before saving.' }, { status: 409 });

  const body = await readJsonObject(request);
  if (!body.ok) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  const token = body.value.token;
  const action = body.value.action;
  if (typeof token !== 'string' || !actions.includes(action as ShareLinkAction) || !isJsonObject(body.value.draft)) {
    return NextResponse.json({ error: 'Share action and draft are required.' }, { status: 400 });
  }

  const service = createShareLinkService();
  const result = action === 'template'
    ? await service.saveTemplateCopy(user.id, token, body.value.draft)
    : await service.savePlannerCopy(user.id, user.role, token, body.value.draft);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, sessionIds: 'sessionIds' in result ? result.sessionIds : undefined }, { status: 201 });
}
