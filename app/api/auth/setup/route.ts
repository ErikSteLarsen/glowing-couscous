import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { createAuthRoleService } from '@/lib/auth-role-service';
import { isAppRole, parseApplicationUserId } from '@/lib/auth-principal';

const authRoleService = createAuthRoleService({ db: prisma });

export async function PATCH(req: NextRequest) {
  const session = await auth();
  const userId = parseApplicationUserId(session?.user?.id);
  if (userId === null) {
    return NextResponse.json({ error: 'Sign in to continue.' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Something went wrong. Reload the page and try again.' }, { status: 400 });
  }

  const role = body && typeof body === 'object' && 'role' in body ? body.role : null;
  if (!isAppRole(role)) {
    return NextResponse.json({ error: 'Choose a role.' }, { status: 400 });
  }

  const result = await authRoleService.assignRole(userId, role);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, role: result.role });
}
