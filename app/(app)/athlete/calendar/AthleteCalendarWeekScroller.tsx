'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { addDays, endOfWeek, format, getISOWeek, startOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ActionLink, Surface, secondaryButtonClassName } from '@/components/ui';
import { MetricText } from '@/components/tempo/MetricText';
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';
import { StatusBadge } from '@/components/tempo/StatusBadge';
import {
  getVisibleDayCount,
  getVisibleDayWindow,
  getWeekScrollerSearchHref,
  shouldExtendCalendarRange,
} from '@/lib/calendar-scroller';
import { formatDuration } from '@/lib/format-duration';
import { getSportLabel } from '@/lib/sport';
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
  const [visibleCount, setVisibleCount] = useState(3);
  const [loadingBefore, setLoadingBefore] = useState(false);
  const [loadingAfter, setLoadingAfter] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const daysRef = useRef(initialDays);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const requestedWeekStarts = useRef(new Set<string>());
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsString = searchParams.toString();

  useEffect(() => {
    daysRef.current = days;
  }, [days]);

  useEffect(() => {
    if (!containerRef.current) return;

    const observer = new ResizeObserver(([entry]) => {
      setVisibleCount(getVisibleDayCount(entry.contentRect.width));
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const nextHref = getWeekScrollerSearchHref(pathname, searchParamsString, activeDateIso);
    if (!nextHref) {
      return;
    }

    router.replace(nextHref, { scroll: false });
  }, [activeDateIso, pathname, router, searchParamsString]);

  const activeIndex = Math.max(
    0,
    days.findIndex((day) => day.isoDate === activeDateIso),
  );
  const activeDay = days[activeIndex] ?? days[0];
  const visibleWindow = getVisibleDayWindow(activeIndex, visibleCount, days.length);
  const visibleDays = days.slice(visibleWindow.start, visibleWindow.end);
  const activeWeekStart = startOfWeek(toLocalNoonDate(activeDay.isoDate), { weekStartsOn: 1 });
  const activeWeekEnd = endOfWeek(toLocalNoonDate(activeDay.isoDate), { weekStartsOn: 1 });
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
      return currentDays;
    } finally {
      if (direction === 'before') setLoadingBefore(false);
      if (direction === 'after') setLoadingAfter(false);
    }
  }, []);

  useEffect(() => {
    const extension = shouldExtendCalendarRange(activeIndex, visibleCount, days.length);
    const timers: number[] = [];
    if (extension.before && !loadingBefore) {
      timers.push(window.setTimeout(() => void loadAdjacentWeek('before'), 0));
    }
    if (extension.after && !loadingAfter) {
      timers.push(window.setTimeout(() => void loadAdjacentWeek('after'), 0));
    }
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [activeIndex, days.length, loadAdjacentWeek, loadingAfter, loadingBefore, visibleCount]);

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
    <Surface className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--text-muted)]">
            Day scroller
          </p>
          <p className="mt-1 text-[22px] font-semibold tracking-[-0.02em] text-[var(--text)]">{weekLabel}</p>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
            Today stays centered while you move day by day through the plan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={secondaryButtonClassName} onClick={() => void moveFocus(-1)}>
            <ChevronLeft className="mr-1 h-4 w-4" />
            Earlier
          </button>
          <button type="button" className={secondaryButtonClassName} onClick={() => void moveFocus(1)}>
            Later
            <ChevronRight className="ml-1 h-4 w-4" />
          </button>
        </div>
      </div>

      <div ref={containerRef} className="space-y-3">
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${visibleDays.length}, minmax(0, 1fr))` }}>
          {visibleDays.map((day) => {
            const isFocused = day.isoDate === activeDateIso;
            const isPast = day.isoDate < todayIso;

            return (
              <Surface
                key={day.isoDate}
                className={`space-y-3 transition ${
                  isFocused
                    ? 'border-[var(--field-focus)] shadow-[0_12px_30px_rgba(32,44,23,0.12)]'
                    : isPast
                      ? 'opacity-70'
                      : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.09em] text-[var(--text-muted)]">
                      {day.label}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <p className="metric-text text-[20px] font-semibold text-[var(--text)]">{day.dateLabel}</p>
                      {day.isToday ? (
                        <span className="rounded-full bg-[var(--brand-tint)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--field-selected-text)]">
                          Today
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span className="rounded-full border border-[var(--field-border)] bg-[#FBFAF7] px-2 py-1 text-[11px] font-medium text-[var(--text-secondary)]">
                    {day.sessions.length}
                  </span>
                </div>

                {day.sessions.length > 0 ? (
                  day.sessions.map((session) => (
                    <div key={session.id} className="space-y-2 rounded-[10px] border border-[var(--border)] bg-[#FBFAF7] p-3">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-semibold text-[var(--text)]">{session.title}</p>
                        <div className="ml-auto">
                          <StatusBadge status={session.status} />
                        </div>
                      </div>
                      <p className="text-[12px] text-[var(--text-secondary)]">
                        {session.timeLabel} · {getSportLabel(session.sport)}
                      </p>
                      <SessionBlockBar segments={session.segments} compact />
                      <div className="flex flex-wrap gap-3 text-[12px] text-[var(--text-secondary)]">
                        <MetricText>{formatDuration(session.durationSec)}</MetricText>
                        <MetricText>{session.tss} TSS</MetricText>
                      </div>
                      <ActionLink href={`/athlete/session/${session.id}`} tone="ghost">
                        Open session
                      </ActionLink>
                    </div>
                  ))
                ) : (
                  <p className="text-[13px] text-[var(--text-muted)]">No session planned.</p>
                )}
              </Surface>
            );
          })}
        </div>

        {requestError ? <p className="text-sm text-[var(--status-danger)]">{requestError}</p> : null}

        <div className="flex items-center justify-between text-[12px] text-[var(--text-muted)]">
          <span>{loadingBefore ? 'Loading earlier days…' : 'Earlier days stay available as you scroll back.'}</span>
          <span>{loadingAfter ? 'Loading more days…' : 'Keep moving later to continue into the next weeks.'}</span>
        </div>
      </div>
    </Surface>
  );
}
