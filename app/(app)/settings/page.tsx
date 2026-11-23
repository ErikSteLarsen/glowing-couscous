import { redirect } from 'next/navigation';
import { PageShell, TopBar } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth-session';
import { accountService } from '@/lib/account-service';
import { readOverviewCardsFromPrefsJson } from '@/lib/overview-preferences';
import { stravaService } from '@/lib/strava-service';
import { StravaConnectionSettings } from './StravaConnectionSettings';
import { AboutSettings, DesktopAppSettings, SettingsClient } from './SettingsClient';

export default async function SettingsPage({ searchParams }: {
  searchParams: Promise<{ strava?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const [account, strava, query] = await Promise.all([
    accountService.getAccount(user.id),
    stravaService.connectionForUser(user.id),
    searchParams,
  ]);
  if (!account) redirect('/login');

  const initialOverviewCards = readOverviewCardsFromPrefsJson(account.prefsJson);

  return (
    <PageShell>
      <TopBar title="Settings" />
      <div className="page-content--compact settings-preferences space-y-5">
        <SettingsClient initialOverviewCards={initialOverviewCards} />
        <StravaConnectionSettings
          connected={strava.connected}
          canConnect={strava.canConnect}
          athleteName={strava.athleteName}
          webhookConfigured={strava.webhookConfigured}
          oauthResult={typeof query.strava === 'string' ? query.strava : undefined}
        />
        <DesktopAppSettings />
        <AboutSettings />
      </div>
    </PageShell>
  );
}
