import { createEmptyWorkoutBlockDraft, mapWorkoutBlockRecordsToDraft, WorkoutBlockDraft, WorkoutBlockRecord } from '@/lib/workout-spec';

export type WorkoutContentDraft = {
  sportType: string;
  summary: string;
  blocks: WorkoutBlockDraft[];
};

export function createEmptyWorkoutContentDraft(defaultSportType = 'RUNNING'): WorkoutContentDraft {
  return {
    sportType: defaultSportType,
    summary: '',
    blocks: [createEmptyWorkoutBlockDraft(0, 'WARMUP')],
  };
}

export function createWorkoutContentDraftFromRecord(input: {
  sportType: string;
  summary: string | null;
  blocks: WorkoutBlockRecord[];
}): WorkoutContentDraft {
  return {
    sportType: input.sportType,
    summary: input.summary ?? '',
    blocks: mapWorkoutBlockRecordsToDraft(input.blocks),
  };
}

export function updateWorkoutContentField<K extends keyof WorkoutContentDraft>(
  draft: WorkoutContentDraft,
  key: K,
  value: WorkoutContentDraft[K],
) {
  return {
    ...draft,
    [key]: value,
  };
}

export function createSessionDraftFromWorkoutContent(input: {
  scheduledDate: string;
  title: string;
  durationMinutes?: number | null;
  distanceKm?: number | null;
  intensity?: string | null;
  sourceTemplateId?: number | null;
  content: WorkoutContentDraft;
}) {
  return {
    scheduledDate: input.scheduledDate,
    title: input.title,
    durationMinutes: input.durationMinutes ?? null,
    distanceKm: input.distanceKm ?? null,
    intensity: input.intensity ?? '',
    sourceTemplateId: input.sourceTemplateId ?? null,
    sportType: input.content.sportType,
    summary: input.content.summary,
    blocks: input.content.blocks,
  };
}

export function createTemplateDraftFromWorkoutContent(input: {
  name: string;
  content: WorkoutContentDraft;
}) {
  return {
    name: input.name,
    sportType: input.content.sportType,
    summary: input.content.summary,
    blocks: input.content.blocks,
  };
}
