import { redirect } from 'next/navigation';
import { PageShell, TopBar } from '@/components/ui';
import { ProfileClient } from './ProfileClient';
import { getCurrentUser } from '@/lib/auth-session';
import { accountService } from '@/lib/account-service';
import { athleteService } from '@/lib/athlete-service';

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const account = await accountService.getAccount(user.id);
  if (!account) redirect('/login');

  const athleteState =
    user.role === 'ATHLETE' ? await athleteService.loadProfileState(user.id) : null;

  return (
    <PageShell>
      <TopBar
        title={account.name ?? 'Your profile'}
        description={account.role === 'ATHLETE' ? 'Update your name and training metrics.' : 'Update your profile details.'}
      />
      <ProfileClient account={account} athleteState={athleteState} />
    </PageShell>
  );
}
