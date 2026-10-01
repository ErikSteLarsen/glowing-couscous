import { isAssignmentDate, validateTemplateDateRange } from './template-period.ts';

export const ROUTINE_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export type RoutineBlock = {
  kind: string; zone: number; durationSec: number; reps: number | null;
  targetType: string | null; targetMode?: string | null; targetReference?: string | null;
  targetLow: number | null; targetHigh: number | null;
  targetLowDecimal?: string | null; targetHighDecimal?: string | null;
  note: string | null; skipped?: boolean; sortOrder: number;
};
export type RoutineEntry = {
  weekday: number; workoutId: number; title: string; sport: string;
  summary: string | null; sportMetricsJson: string | null;
  blocks: RoutineBlock[];
};
export type TemplateRoutine = { version: 1; entries: RoutineEntry[] };

export function parseTemplateRoutine(json: string | null | undefined): TemplateRoutine | null {
  if (!json) return null;
  try {
    const value = JSON.parse(json) as TemplateRoutine;
    if (value.version !== 1 || !Array.isArray(value.entries) || !value.entries.length || value.entries.length > 70) return null;
    if (value.entries.some(entry => !Number.isInteger(entry.weekday) || entry.weekday < 0 || entry.weekday > 6 ||
      !Number.isSafeInteger(entry.workoutId) || entry.workoutId <= 0 || typeof entry.title !== 'string' ||
      typeof entry.sport !== 'string' || !Array.isArray(entry.blocks) || !entry.blocks.length ||
      entry.blocks.some(block => !Number.isFinite(block.durationSec) || block.durationSec <= 0 || !Number.isInteger(block.sortOrder)))) return null;
    return value;
  } catch { return null; }
}

export function routineWeekday(date: string) {
  return (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
}

export function validateRoutineDates(dates: string[]) {
  if (!dates.length || dates.some(date => !isAssignmentDate(date))) return 'Choose valid calendar dates.';
  return validateTemplateDateRange(dates, dates.length === 7 ? 'week' : 'month');
}

/** Date order, then saved within-day order; empty weekdays produce no sessions. */
export function expandTemplateRoutine(routine: TemplateRoutine, dates: string[]) {
  return dates.flatMap(date => routine.entries.filter(entry => entry.weekday === routineWeekday(date)).map(entry => ({ date, entry })));
}
