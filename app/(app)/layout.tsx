import { redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { TimeZoneSync } from '@/components/TimeZoneSync';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';

export default async function SignedInLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) redirect('/login');
  if (!hasAppRole(user)) redirect('/setup');

  return (
    <AppShell user={user}>
      <TimeZoneSync />
      {children}
    </AppShell>
  );
}
