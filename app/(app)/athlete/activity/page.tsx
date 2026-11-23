import { SearchField } from '@/components/tempo/SearchField';
import { format } from 'date-fns';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ActionLink, EmptyState, PageShell, TopBar, formLabelClassName, formSelectClassName, secondaryButtonClassName } from '@/components/ui';
import { WorkoutCard, WorkoutCardFooter, WorkoutCardGrid, WorkoutCardHeader, WorkoutCardMeta, WorkoutCardProfile, WorkoutCardSummary } from '@/components/library/WorkoutCard';
import { MetricPair } from '@/components/tempo/MetricPair';
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

const IMPORT_SOURCES = ['tcx-import', 'fit-import', 'gpx-import'];

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
        <SearchField key={filters.query} name="q" defaultValue={filters.query} maxLength={100} placeholder="Search by workout name" label="Find a completed session" visibleLabel labelClassName="min-w-0 flex-1 space-y-2" />
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
        <MetricPair inline label="Completed" value={activityFeed.count} />
        <MetricPair inline label="Duration" value={formatDuration(activityFeed.totals.durationSec)} />
        <MetricPair
          inline
          label="Load"
          value={activityFeed.totals.unknownLoad
            ? `Unavailable for ${activityFeed.totals.unknownLoad} ${activityFeed.totals.unknownLoad === 1 ? 'activity' : 'activities'}`
            : `${activityFeed.totals.tss}\u00A0TSS`}
        />
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
          <div className="@container">
            <WorkoutCardGrid label="Completed sessions">
              {activityFeed.activities.map((activity) => {
                const imported = IMPORT_SOURCES.includes(activity.metricsSource);
                const comparable = !['manual-unplanned', 'manual-paired', ...IMPORT_SOURCES].includes(activity.metricsSource);
                const outcome = imported || activity.metricsSource === 'manual-paired'
                  ? activity.plannedDurationSec > 0 ? `${formatDuration(activity.plannedDurationSec)} planned` : 'No plan'
                  : activity.metricsSource === 'manual-unplanned' ? 'No plan'
                    : activity.compliancePct === null ? 'Unavailable' : `${activity.compliancePct}%`;
                return (
                  <li key={activity.id} className="min-w-0">
                    <WorkoutCard>
                      <WorkoutCardHeader href={`/athlete/session/${activity.sessionId}?from=activity`} aside={formatDuration(activity.durationSec)}>
                        {activity.title}
                      </WorkoutCardHeader>
                      <WorkoutCardMeta>
                        {imported && activity.sourceTimezoneOffsetMinutes !== null
                          ? <>{formatActivityDateTime(activity.completedAt, activity.sourceTimezoneOffsetMinutes)}&nbsp;· {getSportLabel(activity.sport)}&nbsp;· {activity.metricsSource === 'fit-import' ? 'FIT' : activity.metricsSource === 'gpx-import' ? 'GPX' : 'TCX'}</>
                          : <>{format(activity.completedAt, 'EEE\u00A0d\u00A0MMM\u00A0yyyy')}&nbsp;· {getSportLabel(activity.sport)}{activity.metricsSource === 'manual-unplanned' ? ' · Logged' : ''}</>}
                      </WorkoutCardMeta>
                      <WorkoutCardProfile position="inline">
                        {activity.segments.length
                          ? <SessionBlockBar segments={activity.segments} size="card" />
                          : <div aria-hidden="true" className="h-[32px] border-b border-dashed border-[var(--border)]" />}
                      </WorkoutCardProfile>
                      {activity.notes ? <WorkoutCardSummary lines={1}>{activity.notes}</WorkoutCardSummary> : null}
                      <WorkoutCardFooter
                        metrics={[
                          { label: 'TSS', value: activity.tss ?? '—' },
                          ...(activity.distanceMeters === null ? [] : [{ label: 'Distance', value: formatDistance(activity.distanceMeters), hideLabel: true }]),
                          { label: comparable ? 'Compliance' : 'Plan', value: outcome },
                        ]}
                        actions={comparable ? <SessionComparisonDialog sessionId={activity.sessionId} endpoint={`/api/athlete/sessions/${activity.sessionId}/comparison`} label="Compare" /> : null}
                      />
                    </WorkoutCard>
                  </li>
                );
              })}
            </WorkoutCardGrid>
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
