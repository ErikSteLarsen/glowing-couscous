import { addDays, endOfMonth, format, getDaysInMonth, isValid, parseISO, startOfMonth, startOfWeek } from 'date-fns';

export const TEMPLATE_CADENCES = ['day', 'week', 'month'] as const;

export type TemplateCadence = (typeof TEMPLATE_CADENCES)[number];

export const templateCadenceMeta: Record<TemplateCadence, {
  label: string;
  shortLabel: string;
  description: string;
  assignment: string;
}> = {
  day: {
    label: 'Single day',
    shortLabel: 'Day',
    description: 'One workout placed on one day.',
    assignment: 'Assign to a specific day.',
  },
  week: {
    label: 'Training week',
    shortLabel: 'Week',
    description: 'A repeatable Monday-to-Sunday pattern.',
    assignment: 'Assign to a Monday-starting week.',
  },
  month: {
    label: 'Training month',
    shortLabel: 'Month',
    description: 'A larger rhythm made from several weeks.',
    assignment: 'Assign to a calendar month.',
  },
};

export function isTemplateCadence(value: unknown): value is TemplateCadence {
  return typeof value === 'string' && TEMPLATE_CADENCES.includes(value as TemplateCadence);
}

export function getTemplateCadence(value: unknown): TemplateCadence {
  return isTemplateCadence(value) ? value : 'day';
}

export function getTemplateDurationDays(cadence: TemplateCadence, dateInput: string) {
  if (cadence === 'day') return 1;
  if (cadence === 'week') return 7;
  return getDaysInMonth(parseISO(`${dateInput}T00:00:00`));
}

export function validateTemplateDateRange(dates: string[], cadence: TemplateCadence) {
  if (!dates.length || dates.some((date) => !isAssignmentDate(date))) return 'Choose valid calendar dates.';
  const expectedDays = getTemplateDurationDays(cadence, dates[0]);
  if (dates.length !== expectedDays) {
    return `${templateCadenceMeta[cadence].label} templates require exactly ${expectedDays} consecutive days.`;
  }

  const first = parseISO(`${dates[0]}T00:00:00`);
  const expectedDates = dates.map((_, index) => format(addDays(first, index), 'yyyy-MM-dd'));
  if (expectedDates.some((date, index) => date !== dates[index])) {
    return `${templateCadenceMeta[cadence].label} templates require consecutive dates.`;
  }
  if (cadence === 'week' && first.getDay() !== 1) {
    return 'Week templates must start on a Monday.';
  }
  if (cadence === 'month' && (first.getDate() !== 1 || startOfMonth(first).getTime() !== first.getTime() || endOfMonth(first).getDate() !== dates.length)) {
    return 'Month templates must cover the full calendar month.';
  }
  return null;
}

/** Strict transport validation: never silently drop malformed members. */
export function isAssignmentDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(`${value}T00:00:00`));
}

export function templateDatesForSelection(cadence: TemplateCadence, referenceDate: string): string[] {
  if (!isAssignmentDate(referenceDate)) return [];
  const date = parseISO(`${referenceDate}T00:00:00`);
  const start = cadence === 'week' ? startOfWeek(date, { weekStartsOn: 1 }) : cadence === 'month' ? startOfMonth(date) : date;
  return Array.from({ length: getTemplateDurationDays(cadence, format(start, 'yyyy-MM-dd')) }, (_, index) => format(addDays(start, index), 'yyyy-MM-dd'));
}
