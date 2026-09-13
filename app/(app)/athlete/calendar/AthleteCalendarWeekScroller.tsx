'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDays, endOfWeek, format, getISOWeek, startOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ActionLink, compactSecondaryButtonClassName } from '@/components/ui';
import { SessionRow } from '@/components/tempo/SessionRow';
import { getWeekScrollerSearchHref } from '@/lib/calendar-scroller';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type CalendarScrollerSession = {
  id: number;
  title: string;
  sport: string;
  timeLabel: string;
  status: 'planned' | 'completed' | 'adjusted' | 'missed';
  durationSec: number;
  tss: number;
  segments: Array<{
    key: string;
    zone: number;
    durationSec: number;
    label: string;
    color: string;
  }>;
};

type CalendarScrollerDay = {
  label: string;
  dateLabel: string;
  isoDate: string;
  isToday: boolean;
  sessions: CalendarScrollerSession[];
};

type AthleteCalendarWeekScrollerProps = {
  initialDays: CalendarScrollerDay[];
  initialActiveDateIso: string;
  todayIso: string;
};

function toLocalNoonDate(isoDate: string) {
  return new Date(`${isoDate}T12:00:00`);
}

function mergeCalendarDays(current: CalendarScrollerDay[], incoming: CalendarScrollerDay[]) {
  const merged = new Map(current.map((day) => [day.isoDate, day]));
  for (const day of incoming) {
    merged.set(day.isoDate, day);
  }

  return Array.from(merged.values()).sort((left, right) => left.isoDate.localeCompare(right.isoDate));
}

export function AthleteCalendarWeekScroller({
  initialDays,
  initialActiveDateIso,
  todayIso,
}: AthleteCalendarWeekScrollerProps) {
  const [days, setDays] = useState(initialDays);
  const [activeDateIso, setActiveDateIso] = useState(initialActiveDateIso);
  const [loadingBefore, setLoadingBefore] = useState(false);
  const [loadingAfter, setLoadingAfter] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [retryDirection, setRetryDirection] = useState<'before' | 'after' | null>(null);
  const daysRef = useRef(initialDays);
  const requestedWeekStarts = useRef(new Set<string>());
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();

  useEffect(() => {
    daysRef.current = days;
  }, [days]);

  useEffect(() => {
    const nextHref = getWeekScrollerSearchHref(pathname, searchParamsString, activeDateIso);
    if (!nextHref) {
      return;
    }

    router.replace(nextHref, { scroll: false });
  }, [activeDateIso, pathname, router, searchParamsString]);

  const activeDay = days.find((day) => day.isoDate === activeDateIso) ?? days[0];
  const activeWeekStart = startOfWeek(toLocalNoonDate(activeDay.isoDate), { weekStartsOn: 1 });
  const activeWeekEnd = endOfWeek(toLocalNoonDate(activeDay.isoDate), { weekStartsOn: 1 });
  const weekDays = days.filter((day) => {
    const date = toLocalNoonDate(day.isoDate);
    return date >= activeWeekStart && date <= activeWeekEnd;
  });
  const showBackToToday = !weekDays.some((day) => day.isoDate === todayIso);
  const weekLabel = useMemo(
    () => `Week ${getISOWeek(toLocalNoonDate(activeDay.isoDate))} · ${format(activeWeekStart, 'd MMM')} - ${format(activeWeekEnd, 'd MMM')}`,
    [activeDay.isoDate, activeWeekEnd, activeWeekStart],
  );

  const loadAdjacentWeek = useCallback(async (direction: 'before' | 'after') => {
    const currentDays = daysRef.current;
    const boundaryIsoDate = direction === 'before' ? currentDays[0]?.isoDate : currentDays[currentDays.length - 1]?.isoDate;
    if (!boundaryIsoDate) {
      return currentDays;
    }

    const boundaryWeekStart = startOfWeek(toLocalNoonDate(boundaryIsoDate), { weekStartsOn: 1 });
    const requestedWeekStart = format(addDays(boundaryWeekStart, direction === 'before' ? -7 : 7), 'yyyy-MM-dd');
    if (requestedWeekStarts.current.has(requestedWeekStart)) {
      return currentDays;
    }

    requestedWeekStarts.current.add(requestedWeekStart);
    setRetryDirection(null);
    if (direction === 'before') setLoadingBefore(true);
    if (direction === 'after') setLoadingAfter(true);
    setRequestError(null);

    try {
      const response = await fetch(`/api/athlete/calendar?view=week&date=${requestedWeekStart}`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error('Failed to load more days.');
      }

      const payload = (await response.json()) as { days: CalendarScrollerDay[] };
      const mergedDays = mergeCalendarDays(daysRef.current, payload.days);
      daysRef.current = mergedDays;
      setDays(mergedDays);
      return mergedDays;
    } catch (error) {
      requestedWeekStarts.current.delete(requestedWeekStart);
      setRequestError(error instanceof Error ? error.message : 'Failed to load more days.');
      setRetryDirection(direction);
      return currentDays;
    } finally {
      if (direction === 'before') setLoadingBefore(false);
      if (direction === 'after') setLoadingAfter(false);
    }
  }, []);

  const moveFocus = useCallback(
    async (direction: -1 | 1) => {
      const currentIndex = Math.max(
        0,
        daysRef.current.findIndex((day) => day.isoDate === activeDateIso),
      );
      const existingTarget = daysRef.current[currentIndex + direction];
      if (existingTarget) {
        setActiveDateIso(existingTarget.isoDate);
        return;
      }

      const mergedDays = await loadAdjacentWeek(direction < 0 ? 'before' : 'after');
      const refreshedIndex = Math.max(
        0,
        mergedDays.findIndex((day) => day.isoDate === activeDateIso),
      );
      const loadedTarget = mergedDays[refreshedIndex + direction];
      if (loadedTarget) {
        setActiveDateIso(loadedTarget.isoDate);
      }
    },
    [activeDateIso, loadAdjacentWeek],
  );

  return (
    <section aria-labelledby="calendar-week-heading" className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 id="calendar-week-heading" className="text-[22px] font-semibold tracking-[-0.02em] text-[var(--text)]">{weekLabel}</h2>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">Monday-first · {weekDays.reduce((count, day) => count + day.sessions.length, 0)} sessions</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ActionLink href={`/athlete/calendar?view=week&date=${todayIso}`} tone={showBackToToday ? 'secondary' : 'ghost'} size="compact">
            Today
          </ActionLink>
          <button type="button" aria-label="Previous day" disabled={loadingBefore} className={compactSecondaryButtonClassName} onClick={() => void moveFocus(-1)}>
            <ChevronLeft aria-hidden="true" className="mr-1 h-4 w-4" />
            Previous
          </button>
          <button type="button" aria-label="Next day" disabled={loadingAfter} className={compactSecondaryButtonClassName} onClick={() => void moveFocus(1)}>
            Next
            <ChevronRight aria-hidden="true" className="ml-1 h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="grid gap-x-3 gap-y-6 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-7">
          {weekDays.map((day) => {
            const isFocused = day.isoDate === activeDateIso;

            return (
              <section
                key={day.isoDate}
                aria-labelledby={`calendar-day-${day.isoDate}`}
                className={`min-w-0 border-t pt-3 transition 2xl:border-t-0 2xl:border-l 2xl:pl-3 ${
                  isFocused
                    ? 'border-[var(--brand)] bg-[var(--brand-tint)] px-3 2xl:rounded-[8px]'
                    : 'border-[var(--border)]'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    aria-current={isFocused ? 'date' : undefined}
                    aria-label={`Focus ${day.label} ${day.dateLabel}`}
                    className="inline-flex min-h-11 min-w-11 flex-col justify-center rounded-[8px] px-2 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
                    onClick={() => setActiveDateIso(day.isoDate)}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--text-muted)]">{day.label}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span id={`calendar-day-${day.isoDate}`} className="metric-text text-[20px] font-semibold text-[var(--text)]">{day.dateLabel}</span>
                      {day.isToday ? <span className="rounded-full bg-[var(--brand)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white">Today</span> : null}
                    </div>
                  </button>
                  <span className="rounded-full border border-[var(--field-border)] bg-[var(--field-surface)] px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)]">{day.sessions.length}</span>
                </div>

                {day.sessions.length > 0 ? (
                  day.sessions.map((session) => (
                    <SessionRow
                      key={session.id}
                      session={session}
                      href={`/athlete/session/${session.id}?from=calendar`}
                      variant="compact"
                      muted={session.status === 'completed'}
                      showTime={false}
                    />
                  ))
                ) : (
                  <p className="py-2 text-[13px] text-[var(--text-muted)]">Rest</p>
                )}
              </section>
            );
          })}
        </div>

        {requestError ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-[8px] border border-[var(--danger-border)] bg-[var(--danger-tint)] px-3 py-2 text-sm text-[var(--status-danger)]">
            <span>{requestError}</span>
            {retryDirection ? <button type="button" className="font-semibold underline underline-offset-2" onClick={() => void loadAdjacentWeek(retryDirection)}>Try again</button> : null}
          </div>
        ) : null}

        {loadingBefore || loadingAfter ? (
          <div role="status" aria-live="polite" className="flex items-center justify-between text-[13px] text-[var(--text-muted)]">
            {loadingBefore ? <span>Loading earlier days…</span> : null}
            {loadingAfter ? <span>Loading more days…</span> : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
