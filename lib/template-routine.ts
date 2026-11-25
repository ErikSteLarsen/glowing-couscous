import { z } from 'zod';

import { isAssignmentDate, validateTemplateDateRange } from './template-period.ts';

export const ROUTINE_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export type RoutineBlock = {
  kind: string; zone: number; durationSec: number; reps: number | null;
  targetType: string | null; targetMode?: string | null; targetReference?: string | null;
  targetLow: number | null; targetHigh: number | null;
  targetLowDecimal?: string | null; targetHighDecimal?: string | null;
  note: string | null; skipped?: boolean; sortOrder: number;
};
export const routineSelectionSchema = z.union([
  z.object({ weekday: z.number().int().min(0).max(6), workoutId: z.number().int().positive(), catalogWorkoutSlug: z.never().optional() }),
  z.object({ weekday: z.number().int().min(0).max(6), workoutId: z.never().optional(), catalogWorkoutSlug: z.string().min(1).max(160) }),
]);
export type RoutineSelection = z.infer<typeof routineSelectionSchema>;
export type RoutineEntry = RoutineSelection & {
  title: string; sport: string;
  sourceCatalogWorkoutSlug?: string;
  summary: string | null; sportMetricsJson: string | null;
  blocks: RoutineBlock[];
};
export type TemplateRoutine = { version: 1; entries: RoutineEntry[] };

export function parseTemplateRoutine(json: string | null | undefined): TemplateRoutine | null {
  if (!json) return null;
  try {
    const value = JSON.parse(json) as TemplateRoutine;
    if (value.version !== 1 || !Array.isArray(value.entries) || !value.entries.length || value.entries.length > 70) return null;
    if (value.entries.some(entry => !routineSelectionSchema.safeParse(entry).success ||
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
  return validateTemplateDateRange(dates, dates.length === 7 ? 'week' : 'month');
}

/** Date order, then saved within-day order; empty weekdays produce no sessions. */
export function expandTemplateRoutine(routine: TemplateRoutine, dates: string[]) {
  return dates.flatMap(date => routine.entries.filter(entry => entry.weekday === routineWeekday(date)).map(entry => ({ date, entry })));
}
