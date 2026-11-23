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
    return NextResponse.json({ error: 'Something went wrong. Reload the page and try again.' }, { status: 400 });
  }
  if (!isJsonObject(body)) {
    return NextResponse.json({ error: 'Something went wrong. Reload the page and try again.' }, { status: 400 });
  }
  const result = await accountService.updateProfile(user.id, body);
  return NextResponse.json(result.ok ? result : { error: result.error }, { status: result.ok ? 200 : result.status });
}
