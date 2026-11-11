import { format } from 'date-fns';
import { redirect } from 'next/navigation';
import { ActionLink, PageShell, TopBar } from '@/components/ui';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';
import { athleteService } from '@/lib/athlete-service';
import { ActivityHistoryOverview } from '@/components/ActivityHistoryOverview';
import { ActivityImportForm } from './ActivityImportForm';
import { ManualActivityForm } from './ManualActivityForm';

export default async function AthleteActivityPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!hasAppRole(user)) redirect('/setup');

  const activityFeed = await athleteService.loadActivityFeed(user.id);
  if (!activityFeed) redirect('/login');

  return (
    <PageShell>
      <TopBar
        title="History"
        description="Review completed sessions and imported activities by week or month."
        actions={<div className="flex flex-wrap gap-2"><ActionLink href="#import-activity" tone="primary">Import activity file</ActionLink><ActionLink href="#log-activity" tone="secondary">Log completed workout</ActionLink></div>}
      />
      <div className="page-content--library">
        <ActivityHistoryOverview
          activities={activityFeed.activities.map((activity) => ({
            ...activity,
            tss: activity.tss ?? 0,
            loadAvailable: activity.loadAvailable && activity.tss !== null,
          }))}
          initialDate={new Date().toISOString()}
        />
        <ActivityImportForm />
        <ManualActivityForm today={format(new Date(), 'yyyy-MM-dd')} />
      </div>
    </PageShell>
  );
}
