/**
 * Pure rules for the Calendar's two add flows: Add workout (one workout on one
 * or more days) and Add training plan (a weekly plan over whole weeks).
 *
 * Dates are local calendar day keys (yyyy-MM-dd). Plan ranges follow the
 * planner service contract: 1 to MAX_PLAN_WEEKS Monday-first weeks in a row.
 */
import { format } from 'date-fns';

import { getCalendarHref, parseCalendarDay, type CalendarView } from './calendar-navigation.ts';
import { MAX_PLAN_WEEKS } from './template-period.ts';
import { addDayKeys, fromDayKey, weekStartOf } from './training-load.ts';

/** Week counts offered for a plan, shortest first. */
export const PLAN_WEEK_CHOICES = [1, 2, 4, 8, 12] as const;

export function formatPlacementDate(day: string) {
  return format(fromDayKey(day), 'EEE d MMM');
}

/** Every day of `weeks` Monday-first weeks, starting with the week that holds `startDay`. */
export function getPlanDates(startDay: string, weeks: number): string[] {
  if (!parseCalendarDay(startDay) || !Number.isInteger(weeks) || weeks < 1 || weeks > MAX_PLAN_WEEKS) return [];
  const monday = weekStartOf(startDay);
  return Array.from({ length: weeks * 7 }, (_, index) => addDayKeys(monday, index));
}

/**
 * The Monday a plan starts on by default: the week of the day the person was
 * looking at, unless that week has already begun; then the next whole week.
 */
export function getDefaultPlanStart(today: string, picked: string | null) {
  const thisMonday = weekStartOf(today);
  const monday = weekStartOf(picked ?? today);
  if (monday > thisMonday || (monday === thisMonday && today === thisMonday)) return monday;
  return addDayKeys(thisMonday, 7);
}

/** "Mon 30 Nov–Sun 27 Dec", from the first and last date. */
export function getDateRangeLabel(dates: string[]) {
  if (!dates.length) return '';
  return `${formatPlacementDate(dates[0])}–${formatPlacementDate(dates[dates.length - 1])}`;
}

/** `catalog:long-ride` → `['catalog', 'long-ride']`; source keys are `<kind>:<id>`. */
export function splitSourceKey(key: string): [string, string] {
  const at = key.indexOf(':');
  return [key.slice(0, at), key.slice(at + 1)];
}

export function getWorkoutButtonLabel(dates: string[]) {
  if (!dates.length) return 'Choose a date';
  return dates.length === 1 ? `Add to ${formatPlacementDate(dates[0])}` : `Add to ${dates.length} days`;
}

export function getPlanButtonLabel(workoutCount: number) {
  return workoutCount === 1 ? 'Add 1 workout to Calendar' : `Add ${workoutCount} workouts to Calendar`;
}

export function addPlacementDate(dates: string[], day: string) {
  if (!parseCalendarDay(day) || dates.includes(day)) return dates;
  return [...dates, day].sort();
}

export function removePlacementDate(dates: string[], day: string) {
  return dates.filter((entry) => entry !== day);
}

/**
 * Back to Calendar with a count, on the first placed date. Plans longer than a
 * week open the month view of their first Sunday, so a plan starting on the
 * last Monday of a month opens on the month it mostly fills.
 */
export function getPlacementReturnHref(view: CalendarView, dates: string[], placedCount: number) {
  const sorted = [...dates].sort();
  const href = sorted.length > 7 ? getCalendarHref('month', sorted[6]) : getCalendarHref(view, sorted[0]);
  return `${href}&placed=${placedCount}`;
}

export function parsePlacedCount(value: unknown) {
  if (typeof value !== 'string' || !/^\d{1,4}$/.test(value)) return null;
  const count = Number(value);
  return count > 0 ? count : null;
}
