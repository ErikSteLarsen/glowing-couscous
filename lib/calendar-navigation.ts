/**
 * Calendar period math on local calendar day keys (yyyy-MM-dd).
 *
 * Weeks start on Monday. Day keys are parsed as local dates so a URL date
 * never shifts a day through UTC parsing.
 */
import { addMonths, endOfMonth, format, getISOWeek, isValid, startOfMonth } from 'date-fns';

import { addDayKeys, fromDayKey, toDayKey, weekStartOf, type DayKey } from './training-load.ts';

export type CalendarView = 'week' | 'month';

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Reads a yyyy-MM-dd query value as a local day key, or null when it is not a real date. */
export function parseCalendarDay(value: unknown): DayKey | null {
  if (typeof value !== 'string' || !DAY_KEY_PATTERN.test(value)) return null;
  const date = fromDayKey(value);
  return isValid(date) && toDayKey(date) === value ? value : null;
}

export function parseCalendarView(value: unknown): CalendarView {
  return value === 'month' ? 'month' : 'week';
}

/** The day one period before or after `day`, keeping the day of month where it exists. */
export function stepCalendarPeriod(view: CalendarView, day: DayKey, direction: -1 | 1): DayKey {
  if (view === 'week') return addDayKeys(day, direction * 7);
  return toDayKey(addMonths(fromDayKey(day), direction));
}

/** The Monday-first day range a view shows around `day`. */
export function getCalendarRange(view: CalendarView, day: DayKey): { start: DayKey; end: DayKey } {
  if (view === 'week') {
    const start = weekStartOf(day);
    return { start, end: addDayKeys(start, 6) };
  }
  const date = fromDayKey(day);
  const start = weekStartOf(toDayKey(startOfMonth(date)));
  const end = addDayKeys(weekStartOf(toDayKey(endOfMonth(date))), 6);
  return { start, end };
}

/** Header eyebrow such as "Week 46 · 9–15 Nov" or "November 2026 · Weeks 44–48". */
export function getCalendarPeriodLabel(view: CalendarView, day: DayKey): string {
  if (view === 'month') {
    const { start, end } = getCalendarRange('month', day);
    const firstWeek = getISOWeek(fromDayKey(start));
    const lastWeek = getISOWeek(fromDayKey(addDayKeys(end, -6)));
    return `${format(fromDayKey(day), 'MMMM yyyy')} · Weeks ${firstWeek}–${lastWeek}`;
  }
  const start = fromDayKey(weekStartOf(day));
  const end = fromDayKey(addDayKeys(weekStartOf(day), 6));
  const range = start.getMonth() === end.getMonth()
    ? `${format(start, 'd')}–${format(end, 'd MMM')}`
    : `${format(start, 'd MMM')} – ${format(end, 'd MMM')}`;
  return `Week ${getISOWeek(start)} · ${range}`;
}

export function getCalendarHref(view: CalendarView, day: DayKey) {
  return `/athlete/calendar?${new URLSearchParams({ view, date: day }).toString()}`;
}

export type CalendarShortcut = { type: 'step'; direction: -1 | 1 } | { type: 'today' } | { type: 'view'; view: CalendarView };

/**
 * Maps a key press to a calendar command. Keys typed into fields, or chorded
 * with a modifier, are left alone.
 */
export function getCalendarShortcut(event: {
  key: string;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  defaultPrevented?: boolean;
  targetTagName?: string | null;
  targetIsEditable?: boolean;
}): CalendarShortcut | null {
  if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return null;
  const tag = event.targetTagName?.toUpperCase();
  if (event.targetIsEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return null;

  switch (event.key) {
    case 'ArrowLeft':
      return { type: 'step', direction: -1 };
    case 'ArrowRight':
      return { type: 'step', direction: 1 };
    case 't':
    case 'T':
      return { type: 'today' };
    case 'w':
    case 'W':
      return { type: 'view', view: 'week' };
    case 'm':
    case 'M':
      return { type: 'view', view: 'month' };
    default:
      return null;
  }
}
