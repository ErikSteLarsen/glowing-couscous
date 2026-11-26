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

/** Header eyebrow such as "Week 46, 9–15 Nov" or "November 2026, Weeks 44–48". */
export function getCalendarPeriodLabel(view: CalendarView, day: DayKey): string {
  if (view === 'month') {
    const { start, end } = getCalendarRange('month', day);
    const firstWeek = getISOWeek(fromDayKey(start));
    const lastWeek = getISOWeek(fromDayKey(addDayKeys(end, -6)));
    return `${format(fromDayKey(day), 'MMMM\u00A0yyyy')}, Weeks\u00A0${firstWeek}–${lastWeek}`;
  }
  const start = fromDayKey(weekStartOf(day));
  const end = fromDayKey(addDayKeys(weekStartOf(day), 6));
  const range = start.getMonth() === end.getMonth()
    ? `${format(start, 'd')}–${format(end, 'd\u00A0MMM')}`
    : `${format(start, 'd\u00A0MMM')}–${format(end, 'd\u00A0MMM')}`;
  return `Week\u00A0${getISOWeek(start)}, ${range}`;
}

/** Which source list the Calendar's placement flow opens on. */
export type CalendarPlacement = 'workout' | 'template';

const PLACEMENT_SOURCE_PATTERN = /^(workout|template):\d+$/;

export function parseCalendarPlacement(value: unknown): CalendarPlacement | null {
  return value === 'workout' || value === 'template' ? value : null;
}

/** The "Show load totals" view setting, kept in a cookie so it survives visits. */
export const CALENDAR_TOTALS_COOKIE = 'tempo-calendar-totals';

export function parseCalendarTotals(value: unknown): boolean {
  return value === 'show';
}

/**
 * `back` is the page an add dialog returns to when it is cancelled, e.g. Home
 * or the workout it was opened from. Only app paths outside Calendar count.
 */
export function parseCalendarReturn(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 512) return null;
  const isAthletePage = /^\/athlete(?:[/?]|$)/.test(value);
  const isCalendar = /^\/athlete\/calendar(?:[/?]|$)/.test(value);
  // `//`, backslashes and whitespace could make a browser read it as another origin.
  const isAmbiguous = /\/\/|\\|\s/.test(value);
  return isAthletePage && !isCalendar && !isAmbiguous ? value : null;
}

/** `href` with `back` set, so cancelling the add dialog it opens returns to `back`. */
export function withCalendarReturn(href: string, back: string) {
  const url = new URL(href, 'http://app.local');
  if (parseCalendarReturn(back)) url.searchParams.set('back', back);
  return `${url.pathname}${url.search}`;
}

export function getCalendarHref(view: CalendarView, day: DayKey, options: { place?: CalendarPlacement; back?: string } = {}) {
  const params = new URLSearchParams({ view, date: day });
  if (options.place) params.set('place', options.place);
  const href = `/athlete/calendar?${params.toString()}`;
  return options.back ? withCalendarReturn(href, options.back) : href;
}

/** Opens a Calendar add dialog with a workout or plan already chosen, on `date` when given. */
export function getCalendarPlacementHref(
  source: `${CalendarPlacement}:${number}` | `built-in-plan:${string}` | `catalog:${string}`,
  options: { date?: DayKey; back?: string } = {},
) {
  const place = source.startsWith('workout:') || source.startsWith('catalog:') ? 'workout' : 'template';
  const params = new URLSearchParams({ place, source });
  if (options.date) params.set('date', options.date);
  const href = `/athlete/calendar?${params.toString()}`;
  return options.back ? withCalendarReturn(href, options.back) : href;
}

/**
 * Maps a retired /athlete/planner URL to the same state on Calendar: the
 * month around `date`, with placement open on the preselected source.
 */
export function getPlannerRedirectHref(params: { date?: string | string[]; source?: string | string[] }) {
  const date = parseCalendarDay(params.date);
  const source = typeof params.source === 'string' && PLACEMENT_SOURCE_PATTERN.test(params.source) ? params.source : null;
  const next = new URLSearchParams({ view: 'month' });
  if (date) next.set('date', date);
  next.set('place', source?.startsWith('template:') ? 'template' : 'workout');
  if (source) next.set('source', source);
  return `/athlete/calendar?${next.toString()}`;
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
