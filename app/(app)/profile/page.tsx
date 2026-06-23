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
    <PageShell size="wide">
      <TopBar
        eyebrow="Profile"
        title={account.name ?? 'Your profile'}
        description="Personal details and current account identity."
      />
      <ProfileClient account={account} athleteState={athleteState} />
    </PageShell>
  );
}
