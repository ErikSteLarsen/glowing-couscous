import { NextRequest, NextResponse } from 'next/server';

import { requireSignedInUser } from '@/lib/api-auth';
import { shareLinkService } from '@/lib/share-link-service';
import { isJsonObject, readJsonObject } from '@/lib/route-params';

const actions = ['planner', 'library', 'template'] as const;

export async function POST(request: NextRequest) {
  const { user, error } = await requireSignedInUser();
  if (error) return error;
  if (!user.role) return NextResponse.json({ error: 'Finish setting up your account first.' }, { status: 409 });

  const body = await readJsonObject(request);
  if (!body.ok) return NextResponse.json({ error: 'Something went wrong. Reload the page and try again.' }, { status: 400 });
  const token = body.value.token;
  const action = body.value.action;
  if (typeof token !== 'string' || !actions.includes(action as (typeof actions)[number]) || !isJsonObject(body.value.draft)) {
    return NextResponse.json({ error: 'Something went wrong. Reload the page and try again.' }, { status: 400 });
  }

  if (action === 'template' && user.role !== 'ATHLETE') {
    return NextResponse.json({ error: 'Only athlete accounts can save a shared workout as a training plan.' }, { status: 403 });
  }
  if (action === 'library' && user.role !== 'ATHLETE') {
    return NextResponse.json({ error: 'Coach accounts save shared workouts with Add to Workouts.' }, { status: 403 });
  }
  const result = await saveCopy(action as (typeof actions)[number], user.id, user.role, token, body.value.draft);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, sessionIds: 'sessionIds' in result ? result.sessionIds : undefined }, { status: 201 });
}

function saveCopy(action: (typeof actions)[number], userId: number, role: 'ATHLETE' | 'COACH', token: string, draft: unknown) {
  if (action === 'template') return shareLinkService.saveTemplateCopy(userId, token, draft);
  if (action === 'library') return shareLinkService.saveLibraryCopy(userId, token, draft);
  return shareLinkService.savePlannerCopy(userId, role, token, draft);
}
