/**
 * Pure rules for the Calendar placement flow ("Add workout", "Apply a routine").
 *
 * Dates are local calendar day keys (yyyy-MM-dd). Routine ranges follow the
 * planner service contract: a Monday-first week (7 days) or a whole calendar month.
 */
import { format } from 'date-fns';

import { getCalendarHref, parseCalendarDay, type CalendarView } from './calendar-navigation.ts';
import { templateDatesForSelection } from './template-period.ts';
import { fromDayKey } from './training-load.ts';

export type PlacementKind = 'workout' | 'template';
export type RoutinePeriod = 'week' | 'month';
export type ExistingSessionsByDate = Record<string, Array<{ title: string; sport: string }>>;

export function formatPlacementDate(day: string) {
  return format(fromDayKey(day), 'EEE\u00A0d\u00A0MMM');
}

/** The dates a routine fills: the Monday week or the calendar month around `referenceDate`. */
export function getRoutineDates(period: RoutinePeriod, referenceDate: string): string[] {
  if (!parseCalendarDay(referenceDate)) return [];
  return templateDatesForSelection(period, referenceDate);
}

export function getRoutineRangeLabel(dates: string[]) {
  if (!dates.length) return '';
  return `${formatPlacementDate(dates[0])}–${formatPlacementDate(dates[dates.length - 1])}`;
}

export function getPlacementButtonLabel(kind: PlacementKind, dates: string[], period: RoutinePeriod = 'week') {
  if (!dates.length) return 'Choose a date';
  if (kind === 'template') {
    return period === 'month'
      ? `Apply to ${format(fromDayKey(dates[0]), 'MMMM')}`
      : `Apply to week of ${format(fromDayKey(dates[0]), 'd\u00A0MMM')}`;
  }
  return dates.length === 1 ? `Add to ${formatPlacementDate(dates[0])}` : `Add to ${dates.length} days`;
}

export function addPlacementDate(dates: string[], day: string) {
  if (!parseCalendarDay(day) || dates.includes(day)) return dates;
  return [...dates, day].sort();
}

export function removePlacementDate(dates: string[], day: string) {
  return dates.filter((entry) => entry !== day);
}

/** Dates that already hold a session with the same title and sport as one being placed. */
export function findRepeatedPlacementDates(
  placements: Array<{ date: string; title: string; sport: string }>,
  existing: ExistingSessionsByDate,
) {
  const repeated = placements
    .filter(({ date, title, sport }) => existing[date]?.some((session) => session.title === title && session.sport === sport))
    .map(({ date }) => date);
  return [...new Set(repeated)].sort();
}

/** Back to Calendar on the first placed date; a month routine opens the month view. */
export function getPlacementReturnHref(view: CalendarView, dates: string[], placedCount: number, period?: RoutinePeriod) {
  const first = [...dates].sort()[0];
  const href = getCalendarHref(period === 'month' ? 'month' : view, first);
  return `${href}&placed=${placedCount}`;
}

export function parsePlacedCount(value: unknown) {
  if (typeof value !== 'string' || !/^\d{1,4}$/.test(value)) return null;
  const count = Number(value);
  return count > 0 ? count : null;
}
