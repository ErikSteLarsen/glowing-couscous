import { redirect } from 'next/navigation';
import { PageShell, TopBar } from '@/components/ui';
import { ProfileClient } from './ProfileClient';
import { getCurrentUser } from '@/lib/auth-session';
import { accountService } from '@/lib/account-service';
import { AccountControls } from '@/components/AccountControls';

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const account = await accountService.getAccount(user.id);
  if (!account) redirect('/login');
  const controls = await accountService.getControls(user.id);

  return (
    <PageShell>
      <TopBar
        title={account.name ?? 'Your profile'}
        description="Manage the optional heart-rate, power, and pace values used for workout targets. Leave any value blank if you don’t know it."
      />
      <ProfileClient account={account} />
      {controls ? <AccountControls userId={user.id} controls={controls} /> : null}
    </PageShell>
  );
}
