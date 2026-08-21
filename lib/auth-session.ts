import { auth } from '@/auth';
import type { AppRole } from '@/lib/app-navigation';
import {
  isAppRole,
  parseApplicationUserId,
  parseSessionPrincipal,
} from '@/lib/auth-principal';

export { isAppRole, parseApplicationUserId, parseSessionPrincipal } from '@/lib/auth-principal';

export type AuthenticatedUser = {
  id: number;
  name: string;
  email: string;
  role: AppRole | null;
};

export type SessionUser = AuthenticatedUser & {
  role: AppRole;
};

export function hasAppRole(user: AuthenticatedUser | null): user is SessionUser {
  return Boolean(user && isAppRole(user.role));
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const session = await auth();
  if (!session?.user) return null;

  return parseSessionPrincipal(session.user);
}
