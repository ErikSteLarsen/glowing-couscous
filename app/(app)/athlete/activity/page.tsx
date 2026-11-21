import { format } from 'date-fns';
import { redirect } from 'next/navigation';
import { ActionLink, EmptyState, PageShell, TopBar, formFieldClassName, formLabelClassName, formSelectClassName, secondaryButtonClassName } from '@/components/ui';
import { MetricText } from '@/components/tempo/MetricText';
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';
import { getCurrentUser } from '@/lib/auth-session';
import { getRequestTimeZone } from '@/lib/request-time-zone';
import { todayInZone } from '@/lib/user-time';
import { athleteService } from '@/lib/athlete-service';
import { formatDuration } from '@/lib/format-duration';
import { formatDistance } from '@/lib/format-distance';
import { formatActivityDateTime } from '@/lib/tcx-time';
import { getSportLabel, SPORT_OPTIONS } from '@/lib/sport';
import { ACTIVITY_PAGE_SIZE, getActivityHref, parseActivityFilters } from '@/lib/activity-navigation';
import { SessionComparisonDialog } from '@/components/SessionComparisonDialog';
import { AddActivity } from './AddActivity';

export default async function AthleteActivityPage({ searchParams }: {
  searchParams: Promise<{ q?: string | string[]; sport?: string | string[]; page?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect('/login');

  const filters = parseActivityFilters(await searchParams);
  const activityFeed = await athleteService.loadActivityFeed(user.id, filters);
  if (!activityFeed) redirect('/login');
  const isFiltered = Boolean(filters.query || filters.sport);
  const totalsLabel = isFiltered ? 'Matching history' : 'All completed work';
  const firstResult = (activityFeed.page - 1) * ACTIVITY_PAGE_SIZE + 1;
  const lastResult = firstResult + activityFeed.activities.length - 1;

  return (
    <PageShell size="wide">
      <TopBar
        title="Completed work"
        description="Find past sessions, review planned outcomes, and log completed work from outside your plan."
        actions={<AddActivity today={todayInZone(await getRequestTimeZone())} />}
      />

      <form action="/athlete/activity" className="flex flex-col gap-3 sm:flex-row sm:items-end max-md:[&_:is(input,select,button,a)]:min-h-11">
        <label className="min-w-0 flex-1 space-y-2">
          <span className={formLabelClassName}>Find a completed session</span>
          <input key={filters.query} type="search" name="q" defaultValue={filters.query} maxLength={100} placeholder="Search by workout name" className={formFieldClassName} />
        </label>
        <label className="space-y-2 sm:w-44">
          <span className={formLabelClassName}>Sport</span>
          <select key={filters.sport ?? ''} name="sport" defaultValue={filters.sport ?? ''} className={formSelectClassName}>
            <option value="">All sports</option>
            {SPORT_OPTIONS.map((sport) => <option key={sport} value={sport}>{getSportLabel(sport)}</option>)}
          </select>
        </label>
        <button type="submit" className={secondaryButtonClassName}>Apply filters</button>
        {isFiltered && activityFeed.activities.length > 0 ? <ActionLink href="/athlete/activity" tone="ghost">Clear filters</ActionLink> : null}
      </form>

      <dl aria-label={totalsLabel} className="flex flex-wrap gap-x-6 gap-y-2 border-y border-[var(--border)] py-3 text-sm">
        <div className="flex items-baseline gap-2">
          <dt className="text-[var(--text-muted)]">Completed</dt>
          <dd><MetricText>{activityFeed.count}</MetricText></dd>
        </div>
        <div className="flex items-baseline gap-2">
          <dt className="text-[var(--text-muted)]">Duration</dt>
          <dd><MetricText>{formatDuration(activityFeed.totals.durationSec)}</MetricText></dd>
        </div>
        <div className="flex items-baseline gap-2">
          <dt className="text-[var(--text-muted)]">Load</dt>
          <dd>
            {activityFeed.totals.unknownLoad
              ? <span>Unavailable for {activityFeed.totals.unknownLoad} {activityFeed.totals.unknownLoad === 1 ? 'activity' : 'activities'}</span>
              : <MetricText>{activityFeed.totals.tss} TSS</MetricText>}
          </dd>
        </div>
      </dl>

      {activityFeed.activities.length === 0 ? (
        <EmptyState
          title={isFiltered ? 'No activities match these filters' : 'No completed activities yet'}
          description={isFiltered ? 'Try a different name or sport.' : 'Use Add activity to log or import a workout you’ve completed.'}
          action={
            <Link href={isFiltered ? '/athlete/activity' : '/athlete/calendar'} className={`${secondaryButtonClassName} max-md:min-h-11`}>
              {isFiltered ? 'Clear filters' : 'Open Calendar'}
            </Link>
          }
        />
      ) : (
        <>
          <p className="data text-sm text-[var(--text-secondary)]">Showing {firstResult}–{lastResult} of {activityFeed.count} completed sessions</p>
          <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {activityFeed.activities.map((activity) => (
              <article key={activity.id} className="min-w-0 space-y-3 py-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="break-words text-base font-medium text-[var(--text)] [overflow-wrap:anywhere]">{activity.title}</h2>
                    <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                      {['tcx-import', 'fit-import', 'gpx-import'].includes(activity.metricsSource) && activity.sourceTimezoneOffsetMinutes !== null
                        ? <>{activity.metricsSource === 'tcx-import' ? 'Estimated finish' : 'Recorded finish'} {formatActivityDateTime(activity.completedAt, activity.sourceTimezoneOffsetMinutes)} · {getSportLabel(activity.sport)} · Imported {activity.metricsSource === 'fit-import' ? 'FIT' : activity.metricsSource === 'gpx-import' ? 'GPX' : 'TCX'}</>
                        : <>{format(activity.completedAt, 'EEE d MMM yyyy')} · {getSportLabel(activity.sport)}{activity.metricsSource === 'manual-unplanned' ? ' · Logged activity' : ''}</>}
                    </p>
                    {['tcx-import', 'fit-import', 'gpx-import'].includes(activity.metricsSource) && activity.startedAt && activity.sourceTimezoneOffsetMinutes !== null ? (
                      <p className="mt-1 text-xs text-[var(--text-muted)]">Started {formatActivityDateTime(activity.startedAt, activity.sourceTimezoneOffsetMinutes)}{activity.metricsSource === 'tcx-import' ? ' · finish estimated from duration' : activity.metricsSource === 'fit-import' ? ' · timezone from FIT Activity local timestamp' : ' · timed trackpoints; coordinates not stored'}</p>
                    ) : null}
                    </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-3 max-md:[&>:is(a,button)]:min-h-11">
                      <ActionLink href={`/athlete/session/${activity.sessionId}?from=activity`} tone="ghost">
                    Review outcome
                    </ActionLink>
                    {['manual-unplanned', 'manual-paired', 'tcx-import', 'fit-import', 'gpx-import'].includes(activity.metricsSource) ? null : <SessionComparisonDialog
                      sessionId={activity.sessionId}
                      endpoint={`/api/athlete/sessions/${activity.sessionId}/comparison`}
                      label="Compare"
                    />}
                  </div>
                </div>
                <SessionBlockBar segments={activity.segments} />
                <div className="flex flex-wrap gap-4 text-[13px] text-[var(--text-secondary)]">
                  <MetricText>{formatDuration(activity.durationSec)}</MetricText>
                  {activity.distanceMeters === null ? null : <MetricText>{formatDistance(activity.distanceMeters)}</MetricText>}
                  <MetricText>{activity.tss === null ? 'Load unavailable' : `${activity.tss} TSS`}</MetricText>
                  <MetricText>
                  {['tcx-import', 'fit-import', 'gpx-import', 'manual-paired'].includes(activity.metricsSource)
                    ? activity.plannedDurationSec > 0
                      ? `Actual ${formatDuration(activity.durationSec)} · planned ${formatDuration(activity.plannedDurationSec)}`
                      : 'No planned comparison'
                    : activity.metricsSource === 'manual-unplanned'
                      ? 'No planned comparison'
                      : activity.compliancePct === null ? 'Compliance unavailable' : `${activity.compliancePct}% compliance`}
                  </MetricText>
                </div>
                {activity.metricsSource === 'gpx-import' && activity.distanceMeters !== null ? (
                  <p className="text-[13px] text-[var(--text-secondary)]">Distance summed from timed trackpoints; GPS coordinates are not stored.</p>
                ) : null}
                {activity.metricsSource === 'manual-planned' || activity.metricsSource === 'manual-actual' ? (
                  <p className="text-[13px] text-[var(--text-secondary)]">Manual outcome; no performed sensor metrics recorded.</p>
                ) : null}
                {activity.notes ? (
                  <p className="whitespace-pre-wrap break-words text-sm text-[var(--text-secondary)] [overflow-wrap:anywhere]">
                    {activity.notes}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
          {activityFeed.totalPages > 1 ? (
            <nav aria-label="Activity pages" className="flex flex-wrap items-center justify-between gap-3 max-md:[&>a]:min-h-11">
              {activityFeed.page > 1 ? <ActionLink href={getActivityHref(filters, activityFeed.page - 1)} tone="secondary">Newer sessions</ActionLink> : <span />}
              <span className="data text-sm text-[var(--text-secondary)]">Page {activityFeed.page} of {activityFeed.totalPages}</span>
              {activityFeed.page < activityFeed.totalPages ? <ActionLink href={getActivityHref(filters, activityFeed.page + 1)} tone="secondary">Older sessions</ActionLink> : <span />}
            </nav>
          ) : null}
        </>
      )}
    </PageShell>
  );
}
