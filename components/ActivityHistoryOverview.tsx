'use client';

import { addDays, addMonths, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ActionLink, EmptyState, formSelectClassName, getSegmentedChoiceClassName } from '@/components/ui';
import { formatDuration } from '@/lib/format-duration';
import { getSportLabel } from '@/lib/sport';

type ActivityHistoryItem = {
  id: number;
  sessionId: number;
  title: string;
  plannedTitle: string | null;
  sport: string;
  completedAt: Date | string;
  durationSec: number;
  tss: number;
  loadAvailable: boolean;
  metricsSource: string;
  notes: string | null;
  distanceMeters: number | null;
};

type Period = 'week' | 'month';
type SportFilter = string;
type SortOrder = 'newest' | 'oldest' | 'sport';

const coreSports = ['RUNNING', 'SWIMMING', 'BIKING', 'STRENGTH'];

export function ActivityHistoryOverview({
  activities,
  initialDate,
}: {
  activities: ActivityHistoryItem[];
  initialDate: string;
}) {
  const [period, setPeriod] = useState<Period>('week');
  const [anchorDate, setAnchorDate] = useState(() => new Date(initialDate));
  const [sportFilter, setSportFilter] = useState<SportFilter>('ALL');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');

  const range = period === 'week'
    ? { start: startOfWeek(anchorDate, { weekStartsOn: 1 }), end: endOfWeek(anchorDate, { weekStartsOn: 1 }) }
    : { start: startOfMonth(anchorDate), end: endOfMonth(anchorDate) };
  const currentRangeStart = period === 'week'
    ? startOfWeek(new Date(initialDate), { weekStartsOn: 1 })
    : startOfMonth(new Date(initialDate));
  const canAdvance = range.start.getTime() < currentRangeStart.getTime();
  const periodActivities = activities.filter((activity) => {
    const completedAt = new Date(activity.completedAt);
    return completedAt >= range.start && completedAt <= range.end;
  });

  const sportOptions = useMemo(() => {
    const additionalSports = [...new Set(activities.map((activity) => activity.sport))]
      .filter((sport) => !coreSports.includes(sport))
      .sort((left, right) => getSportLabel(left).localeCompare(getSportLabel(right)));
    return [...coreSports, ...additionalSports];
  }, [activities]);

  const scopedActivities = periodActivities.filter((activity) => sportFilter === 'ALL' || activity.sport === sportFilter);
  const sortedActivities = [...scopedActivities].sort((left, right) => {
    const leftDate = new Date(left.completedAt).getTime();
    const rightDate = new Date(right.completedAt).getTime();
    if (sortOrder === 'oldest') return leftDate - rightDate || left.id - right.id;
    if (sortOrder === 'sport') {
      return getSportLabel(left.sport).localeCompare(getSportLabel(right.sport)) || rightDate - leftDate;
    }
    return rightDate - leftDate || right.id - left.id;
  });

  const summarySports = sportFilter === 'ALL'
    ? [...coreSports, ...sportOptions.filter((sport) => !coreSports.includes(sport))]
    : [sportFilter];
  const summaryRows = summarySports.map((sport) => ({
    sport,
    ...summarize(scopedActivities.filter((activity) => activity.sport === sport)),
  }));
  const total = summarize(scopedActivities);

  function movePeriod(amount: -1 | 1) {
    setAnchorDate((current) => period === 'week'
      ? addDays(startOfWeek(current, { weekStartsOn: 1 }), amount * 7)
      : addMonths(startOfMonth(current), amount));
  }

  const periodLabel = period === 'month'
    ? format(range.start, 'MMMM yyyy')
    : isSameMonth(range.start, range.end)
      ? `${format(range.start, 'd')}–${format(range.end, 'd MMM yyyy')}`
      : `${format(range.start, 'd MMM')}–${format(range.end, 'd MMM yyyy')}`;

  if (activities.length === 0) {
    return (
      <EmptyState
        title="No completed sessions yet"
        description="Complete a planned session or import an activity to start your history."
        action={<ActionLink href="/athlete/import" tone="secondary">Import activity</ActionLink>}
      />
    );
  }

  return (
    <div className="space-y-8">
      <section aria-label="Activity filters" className="space-y-4 border-b border-[var(--border)] pb-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label="Summary period" className="flex min-w-0">
            {(['week', 'month'] as const).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={period === option}
                className={getSegmentedChoiceClassName(period === option, 'compact')}
                onClick={() => setPeriod(option)}
              >
                {option === 'week' ? 'Week' : 'Month'}
              </button>
            ))}
          </div>
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              aria-label={`Previous ${period}`}
              className="inline-flex h-10 w-10 items-center justify-center rounded-[3px] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--brand-tint)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
              onClick={() => movePeriod(-1)}
            >
              <ChevronLeft aria-hidden="true" size={17} />
            </button>
            <h2 aria-live="polite" className="min-w-[145px] text-center text-[14px] font-semibold text-[var(--text)] sm:min-w-[190px]">
              {periodLabel}
            </h2>
            <button
              type="button"
              aria-label={`Next ${period}`}
              disabled={!canAdvance}
              className="inline-flex h-10 w-10 items-center justify-center rounded-[3px] border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--brand-tint)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)] disabled:cursor-not-allowed disabled:opacity-40"
              onClick={() => movePeriod(1)}
            >
              <ChevronRight aria-hidden="true" size={17} />
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-[12px] font-medium text-[var(--text-secondary)]" htmlFor="activity-sport-filter">
            Sport
            <select
              id="activity-sport-filter"
              className={`${formSelectClassName} mt-1 block`}
              value={sportFilter}
              onChange={(event) => setSportFilter(event.target.value)}
            >
              <option value="ALL">All sports</option>
              {sportOptions.map((sport) => <option key={sport} value={sport}>{getSportLabel(sport)}</option>)}
            </select>
          </label>
          <label className="block text-[12px] font-medium text-[var(--text-secondary)]" htmlFor="activity-sort-order">
            Sort sessions
            <select
              id="activity-sort-order"
              className={`${formSelectClassName} mt-1 block`}
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value as SortOrder)}
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="sport">Group by sport</option>
            </select>
          </label>
        </div>
      </section>

      <section aria-label="Training summary" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[var(--text)]">Training summary</h2>
          <p className="text-[12px] text-[var(--text-secondary)]">{sportFilter === 'ALL' ? 'All sports' : getSportLabel(sportFilter)} · {periodLabel}</p>
        </div>
        <div className="border-y border-[var(--border)]">
          <table className="w-full table-fixed text-[11px] sm:text-[13px]" aria-label="Completed sessions, time, and recorded distance by sport">
            <thead className="border-b border-[var(--border)] text-[10px] font-semibold uppercase tracking-[0.04em] text-[var(--text-muted)] sm:text-[11px]">
              <tr>
                <th scope="col" className="w-[34%] py-2 text-left">Sport</th>
                <th scope="col" className="w-[22%] py-2 text-right">Sessions</th>
                <th scope="col" className="w-[22%] py-2 text-right">Time</th>
                <th scope="col" className="w-[22%] py-2 text-right">Distance</th>
              </tr>
            </thead>
            <tbody>
              {summaryRows.map((row) => (
                <tr key={row.sport} className="border-b border-[var(--border)] last:border-b-0">
                  <th scope="row" className="py-2.5 text-left font-medium text-[var(--text)]">{getSportLabel(row.sport)}</th>
                  <td className="metric-text py-2.5 text-right text-[var(--text-secondary)]">{row.count}</td>
                  <td className="metric-text py-2.5 text-right text-[var(--text-secondary)]">{formatDuration(row.durationSec)}</td>
                  <td className="metric-text py-2.5 text-right text-[var(--text-secondary)]">{row.distanceMeters === null ? '—' : formatDistance(row.distanceMeters)}</td>
                </tr>
              ))}
              {sportFilter === 'ALL' ? (
                <tr className="font-semibold text-[var(--text)]">
                  <th scope="row" className="py-2.5 text-left">Total</th>
                  <td className="metric-text py-2.5 text-right">{total.count}</td>
                  <td className="metric-text py-2.5 text-right">{formatDuration(total.durationSec)}</td>
                  <td className="metric-text py-2.5 text-right">{total.distanceMeters === null ? '—' : formatDistance(total.distanceMeters)}</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-[var(--text-muted)]">Distance includes activities where it was recorded.</p>
      </section>

      <section aria-label="Completed sessions" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--border)] pb-2">
          <h2 className="text-[18px] font-semibold tracking-[-0.02em] text-[var(--text)]">Completed sessions</h2>
          <p aria-live="polite" className="text-[12px] text-[var(--text-secondary)]">{scopedActivities.length} {scopedActivities.length === 1 ? 'session' : 'sessions'}</p>
        </div>
        {sortedActivities.length === 0 ? (
          <EmptyState title="No sessions in this period" description="Try another week or month, or choose a different sport." />
        ) : (
          <ol className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {sortedActivities.map((activity) => (
              <li key={activity.id}>
                <article className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
                  <div className="min-w-0">
                    <h3 className="break-words text-[14px] font-semibold text-[var(--text)]">{activity.title}</h3>
                    <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
                      {format(new Date(activity.completedAt), 'EEE d MMM yyyy')} · {getSportLabel(activity.sport)} · {getSourceLabel(activity.metricsSource)}
                    </p>
                    {activity.plannedTitle ? <p className="mt-1 text-[12px] text-[var(--text-secondary)]">Planned session: {activity.plannedTitle}</p> : null}
                    {activity.notes ? <p className="mt-2 line-clamp-2 whitespace-pre-wrap text-[13px] leading-5 text-[var(--text-secondary)]">{activity.notes}</p> : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 sm:justify-end">
                    <p className="metric-text text-[12px] text-[var(--text-secondary)]">
                      {formatDuration(activity.durationSec)}
                      {activity.distanceMeters === null ? '' : ` · ${formatDistance(activity.distanceMeters)}`}
                      {activity.loadAvailable ? ` · ${activity.tss} TSS` : ' · Load unavailable'}
                    </p>
                    <ActionLink href={`/athlete/session/${activity.sessionId}?from=activity`} tone="ghost" size="compact">
                      View outcome
                    </ActionLink>
                  </div>
                </article>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

function summarize(activities: ActivityHistoryItem[]) {
  const recordedDistances = activities.flatMap((activity) => activity.distanceMeters === null ? [] : [activity.distanceMeters]);
  return {
    count: activities.length,
    durationSec: activities.reduce((total, activity) => total + activity.durationSec, 0),
    distanceMeters: recordedDistances.length === 0 ? null : recordedDistances.reduce((total, meters) => total + meters, 0),
  };
}

function formatDistance(distanceMeters: number) {
  return `${new Intl.NumberFormat('en-GB', { maximumFractionDigits: 1 }).format(distanceMeters / 1000)} km`;
}

function getSourceLabel(metricsSource: string) {
  if (metricsSource === 'strava-import') return 'Strava';
  if (metricsSource === 'file-import') return 'File import';
  return 'Tempo';
}
