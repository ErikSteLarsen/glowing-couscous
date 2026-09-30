import { NextResponse } from 'next/server';
import { requireSignedInUser } from '@/lib/api-auth';
import { accountService } from '@/lib/account-service';

export async function DELETE() {
  const { user, error } = await requireSignedInUser();
  if (error || !user) return error;
  await accountService.signOutEverywhere(user.id);
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
}
