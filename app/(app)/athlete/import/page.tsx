import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { ActivityImportClient } from '@/components/ActivityImportClient';
import { PageShell, TopBar, buttonFocusClassName } from '@/components/ui';
import { activityImportService } from '@/lib/activity-import-service';
import { stravaService } from '@/lib/strava-service';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';
import { resolveBackTarget } from '@/lib/app-navigation';

import { ActivityImportForm } from './ActivityImportForm';

export const maxDuration = 60;

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ strava?: string; from?: string; summary?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!hasAppRole(user)) redirect('/setup');

  const query = await searchParams;
  if (typeof query.strava === 'string' && query.strava) {
    redirect(`/settings?strava=${encodeURIComponent(query.strava)}#connections`);
  }
  // Preserve the original account-management shortcut from Profile.
  if (query.from === 'profile') redirect('/settings#connections');

  const [imports, strava] = await Promise.all([
    activityImportService.listForUser(user.id),
    stravaService.connectionForUser(user.id),
  ]);
  // Visiting Import also recovers this owner's due webhook work. The worker
  // remains responsible for retries while nobody is reviewing the inbox.
  if (strava.connected) after(() => stravaService.processPendingWebhookEvents(user.id).then(() => undefined).catch(() => undefined));
  return (
    <PageShell>
      <TopBar
        back={resolveBackTarget({ route: 'import', from: query.from })}
        title="Import"
      />
      <div className="page-content--library space-y-5">
        <ActivityImportClient
          initialActivities={imports.activities}
          plannedSessions={imports.plannedSessions}
          initialStravaConnection={strava}
        />
        <details open={query.summary === '1' || undefined} className="rounded-2xl border border-[var(--border)] px-5">
          <summary className={`min-h-11 rounded-lg py-3 hover:bg-[var(--raised)] text-sm font-medium text-[var(--text)] ${buttonFocusClassName}`}>Advanced options</summary>
          <details id="import-summary" open={query.summary === '1' || undefined} className="mb-3 scroll-mt-20">
            <summary className={`min-h-11 rounded-lg py-3 hover:bg-[var(--raised)] text-sm text-[var(--text)] ${buttonFocusClassName}`}>Import summary only</summary>
            <div className="pb-2"><ActivityImportForm /></div>
          </details>
        </details>
      </div>
    </PageShell>
  );
}
