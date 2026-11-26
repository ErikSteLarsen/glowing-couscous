import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { format } from 'date-fns';
import { Bike, CircleCheck, Cloud, FileUp, PencilLine, PlayCircle, Radio, type LucideIcon } from 'lucide-react';

import { UnsavedRidesNotice } from '@/components/UnsavedRidesNotice';
import { ActionLink, EmptyState, getSwitchOptionClassName, PageShell, secondaryButtonClassName, switchTrackClassName, TopBar } from '@/components/ui';
import { WorkoutCard, WorkoutCardFooter, WorkoutCardGrid, WorkoutCardHeader, WorkoutCardMeta, WorkoutCardProfile, WorkoutCardSummary } from '@/components/library/WorkoutCard';
import { MetricPair } from '@/components/tempobuilder/MetricPair';
import { SessionBlockBar } from '@/components/tempobuilder/SessionBlockBar';
import { SessionComparisonDialog } from '@/components/SessionComparisonDialog';
import { getCurrentUser } from '@/lib/auth-session';
import { getRequestTimeZone } from '@/lib/request-time-zone';
import { todayInZone } from '@/lib/user-time';
import { athleteService } from '@/lib/athlete-service';
import { formatDuration } from '@/lib/format-duration';
import { formatDistance } from '@/lib/format-distance';
import { formatActivityDateTime } from '@/lib/tcx-time';
import { getSportLabel } from '@/lib/sport';
import { ACTIVITY_PAGE_SIZE, getActivityHref, parseActivityFilters } from '@/lib/activity-navigation';
import { ACTIVITY_SOURCE_GROUPS, type ActivitySource, type ActivitySourceGroup } from '@/lib/activity-source';
import { ActivityFilterBar } from './ActivityFilterBar';
import { AddActivity } from './AddActivity';

export const metadata: Metadata = { title: 'My activities' };

const IMPORT_SOURCES = ['tcx-import', 'fit-import', 'gpx-import'];

/** What each source tab holds, said once under the tabs. */
const SOURCE_NOTES: Record<ActivitySourceGroup | 'all', string> = {
  all: 'Everything you’ve trained, newest first. Each card says where it came from.',
  recorded: 'Rides recorded with TempoBuilder Ride and workouts you followed in the guided player.',
  imported: 'Activity files you imported and activities from Strava.',
  manual: 'Activities you logged yourself and planned workouts you marked as done.',
};

const SOURCE_ICONS: Record<ActivitySourceGroup, LucideIcon> = { recorded: Radio, imported: FileUp, manual: PencilLine };
const KIND_ICONS: Record<ActivitySource['kind'], LucideIcon> = { ride: Bike, live: PlayCircle, strava: Cloud, file: FileUp, logged: PencilLine, done: CircleCheck };

export default async function AthleteActivityPage({ searchParams }: {
  searchParams: Promise<{ q?: string | string[]; sport?: string | string[]; source?: string | string[]; page?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ATHLETE') redirect('/login');

  const filters = parseActivityFilters(await searchParams);
  const activityFeed = await athleteService.loadActivityFeed(user.id, filters);
  if (!activityFeed) redirect('/login');
  const isFiltered = Boolean(filters.query || filters.sport);
  const allCount = Object.values(activityFeed.sourceCounts).reduce((sum, count) => sum + count, 0);
  const firstResult = (activityFeed.page - 1) * ACTIVITY_PAGE_SIZE + 1;
  const lastResult = firstResult + activityFeed.activities.length - 1;
  const months = groupByMonth(activityFeed.activities);
  const tabs: Array<{ id: ActivitySourceGroup | null; label: string; count: number }> = [
    { id: null, label: 'All', count: allCount },
    ...ACTIVITY_SOURCE_GROUPS.map((group) => ({ id: group.id, label: group.label, count: activityFeed.sourceCounts[group.id] })),
  ];

  return (
    <PageShell size="wide">
      <TopBar
        title="My activities"
        description="Your training history: what you recorded with TempoBuilder, imported, or logged yourself."
        actions={<AddActivity today={todayInZone(await getRequestTimeZone())} />}
      />
      <UnsavedRidesNotice userId={user.id} />

      <div className="flex flex-col gap-3">
        <nav aria-label="Where activities came from" className="-mx-5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0">
          <div className={`${switchTrackClassName} w-max`}>
            {tabs.map((tab) => {
              const active = filters.source === tab.id;
              const Icon = tab.id ? SOURCE_ICONS[tab.id] : null;
              return (
                <Link
                  key={tab.label}
                  href={getActivityHref({ ...filters, source: tab.id }, 1)}
                  aria-current={active ? 'page' : undefined}
                  scroll={false}
                  className={`${getSwitchOptionClassName(active)} gap-1.5 max-md:min-h-11`}
                >
                  {Icon ? <Icon aria-hidden="true" size={14} strokeWidth={1.8} /> : null}
                  {tab.label}
                  <span className="data text-[12px] text-[var(--text-muted)]">{tab.count}</span>
                </Link>
              );
            })}
          </div>
        </nav>
        <p className="text-[13px] text-[var(--text-secondary)]">{SOURCE_NOTES[filters.source ?? 'all']}</p>
        <ActivityFilterBar filters={filters} />
      </div>

      <dl aria-label="Totals" className="flex flex-wrap gap-x-6 gap-y-2 border-y border-[var(--border)] py-3 text-sm">
        <MetricPair inline label="Activities" value={activityFeed.count} />
        <MetricPair inline label="Time" value={formatDuration(activityFeed.totals.durationSec)} />
        <MetricPair
          inline
          label="Load"
          value={activityFeed.totals.unknownLoad
            ? `No TSS for ${activityFeed.totals.unknownLoad} ${activityFeed.totals.unknownLoad === 1 ? 'activity' : 'activities'}`
            : `${activityFeed.totals.tss} TSS`}
        />
        {filters.source === null && allCount > 0 ? <MetricPair inline label="Recorded here" value={`${activityFeed.sourceCounts.recorded} of ${allCount}`} /> : null}
      </dl>

      {activityFeed.activities.length === 0 ? (
        <SourceEmptyState source={filters.source} isFiltered={isFiltered} clearHref={getActivityHref({ ...filters, query: '', sport: null }, 1)} />
      ) : (
        <>
          {activityFeed.totalPages > 1 ? <p className="data text-sm text-[var(--text-secondary)]">Showing {firstResult}–{lastResult} of {activityFeed.count}</p> : null}
          {months.map((month) => (
            <section key={month.key} aria-labelledby={`month-${month.key}`} className="@container flex flex-col gap-3">
              <h2 id={`month-${month.key}`} className="flex items-baseline gap-2 text-sm font-medium text-[var(--text)]">
                {month.label}<span className="data text-[13px] font-normal text-[var(--text-muted)]">{month.activities.length}</span>
              </h2>
              <WorkoutCardGrid label={`Activities in ${month.label}`}>
                {month.activities.map((activity) => {
                  const imported = IMPORT_SOURCES.includes(activity.metricsSource);
                  const comparable = !['manual-unplanned', 'manual-paired', ...IMPORT_SOURCES].includes(activity.metricsSource);
                  const outcome = imported || activity.metricsSource === 'manual-paired'
                    ? activity.plannedDurationSec > 0 ? `${formatDuration(activity.plannedDurationSec)} planned` : 'No plan'
                    : activity.metricsSource === 'manual-unplanned' ? 'No plan'
                      : activity.compliancePct === null ? 'No data' : `${activity.compliancePct}%`;
                  const when = imported && activity.sourceTimezoneOffsetMinutes !== null
                    ? formatActivityDateTime(activity.completedAt, activity.sourceTimezoneOffsetMinutes)
                    : format(activity.completedAt, 'EEE d MMM');
                  return (
                    <li key={activity.id} className="min-w-0">
                      <WorkoutCard>
                        <WorkoutCardHeader href={`/athlete/session/${activity.sessionId}?from=activity`} aside={formatDuration(activity.durationSec)}>
                          {activity.title}
                        </WorkoutCardHeader>
                        <WorkoutCardMeta>
                          <span>{when}&nbsp;– {getSportLabel(activity.sport)}</span>
                        </WorkoutCardMeta>
                        <p className="mt-2"><SourceBadge source={activity.source} /></p>
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
            </section>
          ))}
          {activityFeed.totalPages > 1 ? (
            <nav aria-label="Activity pages" className="flex flex-wrap items-center justify-between gap-3 max-md:[&>a]:min-h-11">
              {activityFeed.page > 1 ? <ActionLink href={getActivityHref(filters, activityFeed.page - 1)} tone="secondary">Newer</ActionLink> : <span />}
              <span className="data text-sm text-[var(--text-secondary)]">Page {activityFeed.page} of {activityFeed.totalPages}</span>
              {activityFeed.page < activityFeed.totalPages ? <ActionLink href={getActivityHref(filters, activityFeed.page + 1)} tone="secondary">Older</ActionLink> : <span />}
            </nav>
          ) : null}
        </>
      )}
    </PageShell>
  );
}

/** Where the activity came from; recorded-here ones carry the brand tint so they stand out. */
function SourceBadge({ source }: { source: ActivitySource }) {
  const Icon = KIND_ICONS[source.kind];
  const tone = source.group === 'recorded'
    ? 'border-[var(--status-planned-border)] bg-[var(--brand-tint)] text-[var(--brand)]'
    : 'border-[var(--border)] text-[var(--text-secondary)]';
  return (
    <span className={`inline-flex min-h-6 items-center gap-1.5 rounded-full border px-2.5 text-[12px] font-medium ${tone}`}>
      <Icon aria-hidden="true" size={12} strokeWidth={2} />{source.label}
    </span>
  );
}

function SourceEmptyState({ source, isFiltered, clearHref }: { source: ActivitySourceGroup | null; isFiltered: boolean; clearHref: string }) {
  if (isFiltered) {
    return (
      <EmptyState
        title="No activities match"
        description="Try a different name or sport."
        action={<Link href={clearHref} className={`${secondaryButtonClassName} max-md:min-h-11`}>Clear search and sport</Link>}
      />
    );
  }
  const states: Record<ActivitySourceGroup | 'all', { title: string; description: string; href: string; label: string }> = {
    all: { title: 'No activities yet', description: 'Record a workout with TempoBuilder, import a file, or use Add activity to log one.', href: '/athlete/workouts', label: 'Start a workout' },
    recorded: { title: 'Nothing recorded here yet', description: 'Start a workout from Workouts or your Calendar. Rides record power, heart rate and cadence; guided workouts count when you finish them.', href: '/athlete/workouts', label: 'Start a workout' },
    imported: { title: 'No imports yet', description: 'Import FIT, TCX or GPX files from your watch or bike computer, or connect Strava.', href: '/athlete/import?from=activity', label: 'Import activities' },
    manual: { title: 'Nothing logged by hand', description: 'Use Add activity to log training you did without a device, or mark a planned workout as done.', href: '/athlete/calendar', label: 'Open Calendar' },
  };
  const state = states[source ?? 'all'];
  return (
    <EmptyState
      title={state.title}
      description={state.description}
      action={<Link href={state.href} className={`${secondaryButtonClassName} max-md:min-h-11`}>{state.label}</Link>}
    />
  );
}

function groupByMonth<T extends { completedAt: Date }>(activities: T[]) {
  const months: Array<{ key: string; label: string; activities: T[] }> = [];
  for (const activity of activities) {
    const key = format(activity.completedAt, 'yyyy-MM');
    const last = months.at(-1);
    if (last?.key === key) last.activities.push(activity);
    else months.push({ key, label: format(activity.completedAt, 'MMMM yyyy'), activities: [activity] });
  }
  return months;
}
