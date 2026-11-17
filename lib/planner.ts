import { normalizeWorkoutBlockDrafts, validateWorkoutBlocks, WorkoutBlockDraft } from '@/lib/workout-spec';
import { SPORT_OPTIONS } from '@/lib/sport';

export const BLOCK_OPTIONS = ['WARMUP', 'MAIN_SET', 'COOLDOWN', 'INTERVALS', 'REPS', 'REST', 'NOTE'] as const;

export type SessionDraft = {
  scheduledDate: string;
  sportType: string;
  title: string;
  summary: string;
  durationMinutes: number | null;
  distanceKm: number | null;
  intensity: string;
  blocks: WorkoutBlockDraft[];
};

export function normalizeSessionDraft(input: unknown): SessionDraft {
  const draft = (input ?? {}) as Record<string, unknown>;

  return {
    scheduledDate: typeof draft.scheduledDate === 'string' ? draft.scheduledDate : '',
    sportType: typeof draft.sportType === 'string' ? draft.sportType : 'RUNNING',
    title: typeof draft.title === 'string' ? draft.title.trim() : '',
    summary: typeof draft.summary === 'string' ? draft.summary.trim() : '',
    durationMinutes: toNullableInt(draft.durationMinutes),
    distanceKm: toNullableFloat(draft.distanceKm),
    intensity: typeof draft.intensity === 'string' ? draft.intensity.trim() : '',
    blocks: normalizeWorkoutBlockDrafts(draft.blocks),
  };
}

export function validateSessionDraft(draft: SessionDraft) {
  if (!draft.scheduledDate || Number.isNaN(new Date(draft.scheduledDate).getTime())) {
    return 'A valid scheduled date is required.';
  }
  if (!draft.title) {
    return 'Session title is required.';
  }
  if (!SPORT_OPTIONS.includes(draft.sportType as (typeof SPORT_OPTIONS)[number])) {
    return 'Sport type is invalid.';
  }

  return validateWorkoutBlocks(draft.blocks, BLOCK_OPTIONS);
}

function toNullableInt(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function toNullableFloat(value: unknown) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
