import { redirect } from 'next/navigation';
import { PageShell, TopBar } from '@/components/ui';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';
import { athleteService } from '@/lib/athlete-service';
import { ActivityHistoryOverview } from '@/components/ActivityHistoryOverview';

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
      />
      <div className="page-content--library">
        <ActivityHistoryOverview
          activities={activityFeed.activities}
          initialDate={new Date().toISOString()}
        />
      </div>
    </PageShell>
  );
}
