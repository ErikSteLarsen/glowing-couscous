import { auth } from '@/auth';

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: string;
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.role) return null;
  return {
    id: session.user.id,
    name: session.user.name ?? '',
    email: session.user.email ?? '',
    role: session.user.role,
  };
}
