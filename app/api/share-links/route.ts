import { NextRequest, NextResponse } from 'next/server';

import { requireSignedInUser } from '@/lib/api-auth';
import { createShareLinkService, type ShareLinkSourceKind } from '@/lib/share-link-service';
import { parsePositiveInteger, readJsonObject } from '@/lib/route-params';

const sourceKinds: readonly ShareLinkSourceKind[] = ['session', 'template'];

export async function POST(request: NextRequest) {
  const { user, error } = await requireSignedInUser();
  if (error) return error;

  const body = await readJsonObject(request);
  if (!body.ok) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

  const sourceKind = body.value.sourceKind;
  const sourceId = parsePositiveInteger(body.value.sourceId);
  if (!sourceKinds.includes(sourceKind as ShareLinkSourceKind) || sourceId === null) {
    return NextResponse.json({ error: 'Source kind and source id are required.' }, { status: 400 });
  }

  const result = await createShareLinkService().createForUser(user.id, sourceKind as ShareLinkSourceKind, sourceId);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ url: result.url }, { status: 201 });
}
