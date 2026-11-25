import { redirect } from 'next/navigation';
import { ActionLink, PageShell, TopBar } from '@/components/ui';
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
    <PageShell className="profile-page__content">
      <TopBar
        title={account.name ?? 'Your profile'}
        description="Your name and the heart-rate, power and pace values Wattonaut uses for workout targets."
        actions={controls ? <ActionLink href="#account" tone="secondary">Account</ActionLink> : undefined}
      />
      <ProfileClient account={account} />
      {controls ? (
        <div id="account" className="scroll-mt-20">
          <AccountControls userId={user.id} controls={controls} />
        </div>
      ) : null}
    </PageShell>
  );
}
