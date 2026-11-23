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
