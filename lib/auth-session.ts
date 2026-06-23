import { auth } from '@/auth';
import type { AppRole } from '@/lib/app-navigation';

export type AuthenticatedUser = {
  id: number;
  name: string;
  email: string;
  role: AppRole | null;
};

export type SessionUser = AuthenticatedUser & {
  role: AppRole;
};

export function isAppRole(role: string | null | undefined): role is AppRole {
  return role === 'COACH' || role === 'ATHLETE';
}

export function hasAppRole(user: AuthenticatedUser | null): user is SessionUser {
  return Boolean(user && isAppRole(user.role));
}

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const session = await auth();
  if (!session?.user) return null;

  return {
    id: session.user.id,
    name: session.user.name ?? '',
    email: session.user.email ?? '',
    role: isAppRole(session.user.role) ? session.user.role : null,
  };
}
