import { NextRequest, NextResponse } from 'next/server';
import { requireSignedInUser } from '@/lib/api-auth';
import { accountService } from '@/lib/account-service';
import { isJsonObject } from '@/lib/route-params';

export async function PATCH(req: NextRequest) {
  const { user, error } = await requireSignedInUser();
  if (error || !user) return error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (!isJsonObject(body)) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { name, overviewCards, performanceProfile } = body;

  if (name !== undefined) {
    const trimmedName = String(name ?? '').trim();
    if (!trimmedName) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    await accountService.updateDisplayName(user.id, trimmedName);
  }

  if (overviewCards !== undefined) {
    await accountService.updateOverviewCards(user.id, overviewCards);
  }

  if (performanceProfile !== undefined) {
    await accountService.updatePerformanceProfile(user.id, performanceProfile);
  }

  return NextResponse.json({ ok: true });
}
