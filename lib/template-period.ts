import { addDays, endOfMonth, format, getDaysInMonth, isValid, parseISO, startOfMonth, startOfWeek } from 'date-fns';

export type TemplatePeriod = 'week' | 'month';

export function getTemplateDurationDays(period: TemplatePeriod, dateInput: string) {
  if (period === 'week') return 7;
  return getDaysInMonth(parseISO(`${dateInput}T00:00:00`));
}

export function validateTemplateDateRange(dates: string[], period: TemplatePeriod) {
  if (!dates.length || dates.some((date) => !isAssignmentDate(date))) return 'Choose valid calendar dates.';
  const expectedDays = getTemplateDurationDays(period, dates[0]);
  if (dates.length !== expectedDays) {
    return `Choose ${expectedDays} days in a row for a ${period}.`;
  }

  const first = parseISO(`${dates[0]}T00:00:00`);
  const expectedDates = dates.map((_, index) => format(addDays(first, index), 'yyyy-MM-dd'));
  if (expectedDates.some((date, index) => date !== dates[index])) {
    return `Choose days in a row for a ${period}.`;
  }
  if (period === 'week' && first.getDay() !== 1) {
    return 'A week starts on Monday. Choose a Monday.';
  }
  if (period === 'month' && (first.getDate() !== 1 || startOfMonth(first).getTime() !== first.getTime() || endOfMonth(first).getDate() !== dates.length)) {
    return 'Choose a whole calendar month.';
  }
  return null;
}

/** Most workouts one placement adds, so it stays inside the transaction deadline; 12 weeks of the largest built-in week fit. */
export const MAX_PLACEMENTS_PER_REQUEST = 150;

/** Longest run of weeks a training plan can be added for in one go. */
export const MAX_PLAN_WEEKS = 12;

/** `dates` must be whole Monday-first weeks in a row, 1 to MAX_PLAN_WEEKS of them. */
export function validateWeekRange(dates: string[]) {
  if (!dates.length || dates.some((date) => !isAssignmentDate(date))) return 'Choose valid calendar dates.';
  if (dates.length % 7 !== 0 || dates.length / 7 > MAX_PLAN_WEEKS) {
    return `Choose 1 to ${MAX_PLAN_WEEKS} whole weeks.`;
  }
  const first = parseISO(`${dates[0]}T00:00:00`);
  if (first.getDay() !== 1) return 'A week starts on Monday. Choose a Monday.';
  if (dates.some((date, index) => date !== format(addDays(first, index), 'yyyy-MM-dd'))) {
    return 'Choose weeks in a row.';
  }
  return null;
}

/** Strict transport validation: never silently drop malformed members. */
export function isAssignmentDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(`${value}T00:00:00`));
}

export function templateDatesForSelection(period: TemplatePeriod, referenceDate: string): string[] {
  if (!isAssignmentDate(referenceDate)) return [];
  const date = parseISO(`${referenceDate}T00:00:00`);
  const start = period === 'week' ? startOfWeek(date, { weekStartsOn: 1 }) : startOfMonth(date);
  return Array.from({ length: getTemplateDurationDays(period, format(start, 'yyyy-MM-dd')) }, (_, index) => format(addDays(start, index), 'yyyy-MM-dd'));
}
