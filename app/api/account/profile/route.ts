import { NextRequest, NextResponse } from 'next/server';
import { requireSignedInUser } from '@/lib/api-auth';
import { accountService } from '@/lib/account-service';

export async function PATCH(req: NextRequest) {
  const { user, error } = await requireSignedInUser();
  if (error || !user) return error;

  const { name, overviewCards } = (await req.json()) as {
    name?: unknown;
    overviewCards?: unknown;
  };

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

  return NextResponse.json({ ok: true });
}
