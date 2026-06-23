import { redirect } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';
import { athleteService } from '@/lib/athlete-service';

export default async function SignedInLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();

  if (!user) redirect('/login');
  if (!hasAppRole(user)) redirect('/setup');

  const hasActiveCoach =
    user.role === 'ATHLETE' ? Boolean(await athleteService.findProfileByUserId(user.id)) : false;

  return (
    <AppShell user={user} hasActiveCoach={hasActiveCoach}>
      {children}
    </AppShell>
  );
}
