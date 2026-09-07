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
