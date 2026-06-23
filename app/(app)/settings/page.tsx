import { redirect } from 'next/navigation';
import { PageShell, TopBar } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth-session';
import { accountService } from '@/lib/account-service';
import { readOverviewCardsFromPrefsJson } from '@/lib/overview-preferences';
import { SettingsClient } from './SettingsClient';

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const account = await accountService.getAccount(user.id);
  if (!account) redirect('/login');

  const initialOverviewCards = readOverviewCardsFromPrefsJson(account.prefsJson);

  return (
    <PageShell size="wide">
      <TopBar
        eyebrow="Settings"
        title="Preferences"
        description="Choose how much overview information appears on the athlete home screen."
      />
      <SettingsClient role={account.role} initialOverviewCards={initialOverviewCards} />
    </PageShell>
  );
}
