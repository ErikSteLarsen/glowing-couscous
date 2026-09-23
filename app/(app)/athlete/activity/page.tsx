import { format } from 'date-fns';
import { redirect } from 'next/navigation';
import { ActionLink, EmptyState, PageShell, Surface, StatTile, TopBar } from '@/components/ui';
import { MetricText } from '@/components/tempo/MetricText';
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';
import { getCurrentUser, hasAppRole } from '@/lib/auth-session';
import { athleteService } from '@/lib/athlete-service';
import { formatDuration } from '@/lib/format-duration';
import { getSportLabel } from '@/lib/sport';
import { SessionComparisonDialog } from '@/components/SessionComparisonDialog';

export default async function AthleteActivityPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (!hasAppRole(user)) redirect('/setup');

  const activityFeed = await athleteService.loadActivityFeed(user.id);
  if (!activityFeed) redirect('/login');

  return (
    <PageShell>
      <TopBar
        title="Completed work"
        description="Review completed sessions and compare results with your plan."
      />

      <div className="page-content--library grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatTile label="Completed sessions" value={String(activityFeed.activities.length)} detail="Latest 12" />
        <StatTile label="Duration" value={formatDuration(activityFeed.totals.durationSec)} detail="Latest 12 sessions" />
        <StatTile label="Load" value={`${activityFeed.totals.tss}`} detail="Latest 12 sessions" />
      </div>

      {activityFeed.activities.length === 0 ? (
        <div className="page-content--library">
          <EmptyState
            title="No completed sessions yet"
            description="Complete a session to see it here."
          />
        </div>
      ) : (
        <div className="page-content--library grid gap-4 lg:grid-cols-2">
          {activityFeed.activities.map((activity) => (
            <Surface key={activity.id} className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[15px] font-semibold text-[var(--text)]">{activity.title}</p>
                  <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                    {format(activity.completedAt, 'EEE d MMM')} · {getSportLabel(activity.sport)}
                   </p>
                  </div>
                   <div className="flex flex-wrap items-center gap-3">
                    <ActionLink href={`/athlete/session/${activity.sessionId}?from=activity`} tone="ghost">
                     Review outcome
                  </ActionLink>
                  <SessionComparisonDialog
                    sessionId={activity.sessionId}
                    endpoint={`/api/athlete/sessions/${activity.sessionId}/comparison`}
                    label="Compare"
                  />
                </div>
              </div>
              <SessionBlockBar segments={activity.segments} />
              <div className="flex flex-wrap gap-4 text-[13px] text-[var(--text-secondary)]">
                <MetricText>{formatDuration(activity.durationSec)}</MetricText>
                <MetricText>{activity.tss} TSS</MetricText>
                <MetricText>
                  {activity.compliancePct === null ? 'Compliance unavailable' : `${activity.compliancePct}% compliance`}
                </MetricText>
              </div>
              {activity.metricsSource === 'manual-planned' || activity.metricsSource === 'manual-actual' ? (
                <p className="text-[13px] text-[var(--text-secondary)]">Manual outcome; no performed sensor metrics recorded.</p>
              ) : null}
              {activity.notes ? (
                <div className="rounded-[10px] bg-[var(--brand-tint)] px-4 py-3 text-[13px] text-[var(--text)]">
                  {activity.notes}
                </div>
              ) : null}
            </Surface>
          ))}
        </div>
      )}
    </PageShell>
  );
}
