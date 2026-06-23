import { format } from 'date-fns';
import { redirect } from 'next/navigation';
import { ActionLink, EmptyState, PageShell, Surface, StatTile, TopBar } from '@/components/ui';
import { MetricText } from '@/components/tempo/MetricText';
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';
import { getCurrentUser } from '@/lib/auth-session';
import { athleteService } from '@/lib/athlete-service';
import { formatDuration } from '@/lib/format-duration';
import { getSportLabel } from '@/lib/sport';

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
        description="Recent completed sessions with duration, load, and coach notes."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatTile label="Completed sessions" value={String(activityFeed.activities.length)} detail="Recent history" />
        <StatTile label="Duration" value={formatDuration(activityFeed.totals.durationSec)} detail="Across recent activities" />
        <StatTile label="Load" value={`${activityFeed.totals.tss}`} detail="Accumulated TSS" />
      </div>

      {activityFeed.activities.length === 0 ? (
        <EmptyState
          title="No completed sessions yet"
          description="Finish a workout from the Session screen and your activity feed will appear here."
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
                <ActionLink href={`/athlete/session/${activity.sessionId}`} tone="ghost">
                  Open
                </ActionLink>
              </div>
              <SessionBlockBar segments={activity.segments} />
              <div className="flex flex-wrap gap-4 text-[13px] text-[var(--text-secondary)]">
                <MetricText>{formatDuration(activity.durationSec)}</MetricText>
                <MetricText>{activity.tss} TSS</MetricText>
                <MetricText>{activity.compliancePct}% compliance</MetricText>
              </div>
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
