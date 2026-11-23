import { NextResponse } from 'next/server';
import { requireSignedInUser } from '@/lib/api-auth';
import { accountDeletionService } from '@/lib/account-deletion-service';

export async function DELETE(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  if (request.headers.get('origin') !== new URL(request.url).origin) return NextResponse.json({ error: 'Something went wrong. Reload the page and try again.' }, { status: 403, headers });
  const { user, error } = await requireSignedInUser();
  if (error || !user) return error;
  const result = await accountDeletionService.unshare(user.id);
  return NextResponse.json(result, { status: result.ok ? 200 : result.status, headers });
}
