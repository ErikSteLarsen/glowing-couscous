import { redirect } from 'next/navigation';
import { PageShell, TopBar } from '@/components/ui';
import { ProfileClient } from './ProfileClient';
import { getCurrentUser } from '@/lib/auth-session';
import { accountService } from '@/lib/account-service';

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const account = await accountService.getAccount(user.id);
  if (!account) redirect('/login');

  return (
    <PageShell>
      <TopBar
        title={account.name ?? 'Your profile'}
        description="Update your name and training metrics."
      />
      <ProfileClient account={account} />
    </PageShell>
  );
}
