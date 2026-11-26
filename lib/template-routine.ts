import { isAssignmentDate, validateTemplateDateRange, validateWeekRange } from './template-period.ts';

export const ROUTINE_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export type RoutineBlock = {
  kind: string; zone: number; durationSec: number; reps: number | null;
  targetType: string | null; targetMode?: string | null; targetReference?: string | null;
  targetLow: number | null; targetHigh: number | null;
  targetLowDecimal?: string | null; targetHighDecimal?: string | null;
  note: string | null; skipped?: boolean; sortOrder: number;
};
/** One planned workout: a saved workout by id, or a public workout by slug. */
export type RoutineSelection = { weekday: number } & (
  | { workoutId: number; catalogWorkoutSlug?: undefined }
  | { workoutId?: undefined; catalogWorkoutSlug: string }
);
export type RoutineEntry = RoutineSelection & {
  title: string; sport: string;
  sourceCatalogWorkoutSlug?: string;
  summary: string | null; sportMetricsJson: string | null;
  blocks: RoutineBlock[];
};
export type TemplateRoutine = { version: 1; entries: RoutineEntry[] };

/** Plain checks rather than zod: client components import this module. */
export function isRoutineSelection(value: unknown): value is RoutineSelection {
  if (typeof value !== 'object' || value === null) return false;
  const { weekday, workoutId, catalogWorkoutSlug } = value as Record<string, unknown>;
  if (!Number.isInteger(weekday) || (weekday as number) < 0 || (weekday as number) > 6) return false;
  return catalogWorkoutSlug === undefined
    ? Number.isSafeInteger(workoutId) && (workoutId as number) > 0
    : workoutId === undefined && typeof catalogWorkoutSlug === 'string' && catalogWorkoutSlug.length > 0 && catalogWorkoutSlug.length <= 160;
}

export function parseTemplateRoutine(json: string | null | undefined): TemplateRoutine | null {
  if (!json) return null;
  try {
    const value = JSON.parse(json) as TemplateRoutine;
    if (value.version !== 1 || !Array.isArray(value.entries) || !value.entries.length || value.entries.length > 70) return null;
    if (value.entries.some(entry => !isRoutineSelection(entry) ||
      (entry.sourceCatalogWorkoutSlug !== undefined && typeof entry.sourceCatalogWorkoutSlug !== 'string') || typeof entry.title !== 'string' ||
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
  // Whole weeks from a Monday, or (older clients) one calendar month.
  return dates.length % 7 === 0 && validateWeekRange(dates) === null ? null : validateTemplateDateRange(dates, dates.length === 7 ? 'week' : 'month');
}

/** Date order, then saved within-day order; empty weekdays produce no sessions. */
export function expandTemplateRoutine(routine: TemplateRoutine, dates: string[]) {
  return dates.flatMap(date => routine.entries.filter(entry => entry.weekday === routineWeekday(date)).map(entry => ({ date, entry })));
}
