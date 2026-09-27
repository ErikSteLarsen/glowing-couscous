import { format } from 'date-fns';
import { redirect } from 'next/navigation';
import { ActionLink, EmptyState, PageShell, TopBar } from '@/components/ui';
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

      <section aria-label="Activity summary" className="page-content--library grid grid-cols-2 gap-x-6 gap-y-4 border-y border-[var(--border)] py-4 sm:grid-cols-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Completed sessions</p>
          <p className="metric-text mt-1 text-[20px] font-semibold text-[var(--text)]">{activityFeed.activities.length}</p>
          <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">Latest 12</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Duration</p>
          <p className="metric-text mt-1 text-[20px] font-semibold text-[var(--text)]">{formatDuration(activityFeed.totals.durationSec)}</p>
          <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">Latest 12 sessions</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Load</p>
          <p className="metric-text mt-1 text-[20px] font-semibold text-[var(--text)]">{activityFeed.totals.loadUnavailableCount > 0 ? '—' : activityFeed.totals.tss}</p>
          <p className="mt-0.5 text-[12px] text-[var(--text-secondary)]">
            {activityFeed.totals.loadUnavailableCount > 0
              ? `Unavailable for ${activityFeed.totals.loadUnavailableCount} imported ${activityFeed.totals.loadUnavailableCount === 1 ? 'activity' : 'activities'}`
              : 'Latest 12 sessions'}
          </p>
        </div>
      </section>

      {activityFeed.activities.length === 0 ? (
        <div className="page-content--library">
          <EmptyState
            title="No completed sessions yet"
            description="Complete a session to see it here."
          />
        </div>
      ) : (
        <ol aria-label="Latest completed sessions" className="page-content--library divide-y divide-[var(--border)] border-y border-[var(--border)]">
          {activityFeed.activities.map((activity) => (
            <li key={activity.id}>
              <article className="space-y-4 py-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-5">
                  <div className="min-w-0">
                    <p className="break-words text-[15px] font-semibold text-[var(--text)]">{activity.title}</p>
                    <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                      {format(activity.completedAt, 'EEE d MMM')} · {getSportLabel(activity.sport)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1">
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
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-[var(--text-secondary)]">
                  <MetricText>{formatDuration(activity.durationSec)}</MetricText>
                  <MetricText>
                    {activity.metricsSource === 'file-import' && activity.tss === 0 ? 'Load unavailable' : `${activity.tss} TSS`}
                  </MetricText>
                  <MetricText>
                    {activity.compliancePct === null ? 'Compliance unavailable' : `${activity.compliancePct}% compliance`}
                  </MetricText>
                </div>
                {activity.metricsSource === 'manual-planned' || activity.metricsSource === 'manual-actual' ? (
                  <p className="text-[13px] text-[var(--text-secondary)]">Manual outcome; no performed sensor metrics recorded.</p>
                ) : null}
                {activity.notes ? (
                  <p className="whitespace-pre-wrap text-[13px] leading-6 text-[var(--text-secondary)]">{activity.notes}</p>
                ) : null}
              </article>
            </li>
          ))}
        </ol>
      )}
    </PageShell>
  );
}
