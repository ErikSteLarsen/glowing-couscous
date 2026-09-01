import { format } from 'date-fns';
import { redirect } from 'next/navigation';
import { ActionLink, EmptyState, PageShell, Surface, StatTile, TopBar } from '@/components/ui';
import { MetricText } from '@/components/tempo/MetricText';
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';
import { getCurrentUser } from '@/lib/auth-session';
import { athleteService } from '@/lib/athlete-service';
import { formatDuration } from '@/lib/format-duration';
import { getSportLabel } from '@/lib/sport';
import { SessionComparisonDialog } from '@/components/SessionComparisonDialog';

export default async function AthleteActivityPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect('/login');

  const activityFeed = await athleteService.loadActivityFeed(user.id);
  if (!activityFeed) redirect('/athlete/find-coach');

  return (
    <PageShell size="wide">
      <TopBar
        eyebrow="Activity"
        title="Completed work"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatTile label="Completed sessions" value={String(activityFeed.activities.length)} detail="Recent history" />
        <StatTile label="Duration" value={formatDuration(activityFeed.totals.durationSec)} detail="Across recent activities" />
        <StatTile label="Load" value={`${activityFeed.totals.tss}`} detail="Accumulated TSS" />
      </div>

      {activityFeed.activities.length === 0 ? (
        <EmptyState
          title="No completed sessions yet"
          description="Complete a session to see it here."
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
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
                  <ActionLink href={`/athlete/session/${activity.sessionId}`} tone="ghost">
                    Open
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
