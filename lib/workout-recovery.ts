import { createSessionEditorDraftFromPersisted, normalizeSessionEditorDraft, serializeSessionEditorDraft, type SessionEditorDraft } from './session-editor.ts';
import type { RecoveryDraft } from './draft-recovery.ts';

export function parseWorkoutRecovery(payload: string) {
  try {
    const value = JSON.parse(payload);
    if (!value || !value.draft || typeof value.draft.title !== 'string' || typeof value.draft.sport !== 'string' || !Array.isArray(value.draft.blocks) || value.draft.blocks.length > 1000 || typeof value.requestKey !== 'string' || (value.requestKey !== '' && !/^[a-zA-Z0-9-]{16,80}$/.test(value.requestKey))) return null;
    const source = value.catalogSource;
    const catalogSource = typeof source?.slug === 'string' && typeof source.name === 'string' ? { slug: source.slug as string, name: source.name as string } : null;
    return { draft: normalizeSessionEditorDraft(value.draft), requestKey: value.requestKey, catalogSource };
  } catch { return null; }
}

type SavedWorkout = Parameters<typeof createSessionEditorDraftFromPersisted>[1] & { id: number; title: string; updatedAt?: string | Date };

function savedRevision(workout: SavedWorkout) {
  return workout.updatedAt ? new Date(workout.updatedAt).toISOString() : '';
}

function comparable(draft: SessionEditorDraft) {
  return JSON.stringify({ ...serializeSessionEditorDraft(draft), id: null, scheduledDate: null, planWeekday: null });
}

/** The name a person recognises a workout draft by: its own title, else the saved workout's. */
export function describeWorkoutDraft(record: Pick<RecoveryDraft, 'resource' | 'payload'>, workouts: SavedWorkout[]) {
  const recovered = parseWorkoutRecovery(record.payload);
  const original = record.resource === 'new' ? null : workouts.find((workout) => String(workout.id) === record.resource) ?? null;
  const name = recovered?.draft.title.trim() || original?.title.trim() || 'Untitled workout';
  const kind = record.resource === 'new' ? 'New workout' : original ? 'Unsaved changes' : 'Changes to a deleted workout';
  return { name, kind };
}

/** A draft of a saved workout is redundant when it was taken from the current version and changes nothing. */
export function isWorkoutDraftRedundant(record: Pick<RecoveryDraft, 'resource' | 'payload' | 'baseline'>, workouts: SavedWorkout[]) {
  if (record.resource === 'new') return false;
  const original = workouts.find((workout) => String(workout.id) === record.resource);
  const recovered = parseWorkoutRecovery(record.payload);
  if (!original || !recovered || record.baseline !== savedRevision(original)) return false;
  return comparable(recovered.draft) === comparable(createSessionEditorDraftFromPersisted('create', { ...original, date: null, scheduledDate: null }));
}
