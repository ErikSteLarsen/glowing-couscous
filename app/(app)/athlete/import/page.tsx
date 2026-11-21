import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { ActivityImportClient } from '@/components/ActivityImportClient';
import { PageShell, TopBar } from '@/components/ui';
import { activityImportService } from '@/lib/activity-import-service';
import { stravaService } from '@/lib/strava-service';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';
import { resolveBackTarget } from '@/lib/app-navigation';

export const maxDuration = 60;

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ strava?: string; from?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!hasAppRole(user)) redirect('/setup');

  const [imports, strava, query] = await Promise.all([
    activityImportService.listForUser(user.id),
    stravaService.connectionForUser(user.id),
    searchParams,
  ]);
  // Visiting Import also recovers this owner's due webhook work. The worker
  // remains responsible for retries while nobody is reviewing the inbox.
  if (strava.connected) after(() => stravaService.processPendingWebhookEvents(user.id).then(() => undefined).catch(() => undefined));
  return (
    <PageShell>
      <TopBar
        back={resolveBackTarget({ route: 'import', from: query.from })}
        title="Import"
        description="Review activities from Strava or an activity file, match them to a planned session, and add the completed result to Tempo."
      />
      <div className="page-content--library space-y-5">
        <ActivityImportClient
          initialActivities={imports.activities}
          plannedSessions={imports.plannedSessions}
          initialStravaConnection={strava}
          stravaResult={query.strava ?? null}
        />
      </div>
    </PageShell>
  );
}
