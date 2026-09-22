import { redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';

export default async function SignedInLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) redirect('/login');
  if (!hasAppRole(user)) redirect('/setup');

  return (
    <AppShell user={user} hasActiveCoach={false}>
      {children}
    </AppShell>
  );
}
