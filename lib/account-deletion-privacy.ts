import { createSharedWorkoutProjection, parseSharedWorkoutProjection } from './share-link.ts';
import { deserializeSessionSnapshot, serializeSessionSnapshot } from './session-snapshot-service.ts';
import { SPORT_OPTIONS } from './sport.ts';

// Retained content uses an allowlist; free text cannot reliably be classified as personal.
export function anonymizeSharedWorkout(snapshotJson: string) {
  const source = parseSharedWorkoutProjection(snapshotJson);
  return JSON.stringify(createSharedWorkoutProjection({
    sourceKind: source?.sourceKind ?? 'session',
    sport: safeRetainedSport(source?.sport),
    title: 'Shared workout',
    summary: '',
    blocks: (source?.blocks ?? []).map((block) => ({ ...block, note: '' })),
  }));
}

export function safeRetainedSport(sport: string | undefined) {
  return sport && SPORT_OPTIONS.includes(sport as typeof SPORT_OPTIONS[number]) ? sport : 'RUNNING';
}

export function anonymizeAssignedSnapshot(input: string | null, actual: boolean) {
  const draft = deserializeSessionSnapshot(actual ? 'actual' : 'planned', input);
  if (!draft) return null;
  return serializeSessionSnapshot({
    ...draft,
    coachOwnerId: null, assignedById: null, trainingPlanId: null, templateId: null,
    sport: safeRetainedSport(draft.sport), title: 'Workout', summary: '', coachNotes: '',
    timeLabel: null,
    source: 'assigned', status: actual ? 'completed' : 'planned',
    athleteNotes: actual ? draft.athleteNotes : '',
    blocks: draft.blocks.map((block) => ({ ...block, note: '' })),
  });
}

export function accountShareScope(userId: number) {
  return { OR: [
    { createdById: userId },
    { session: { is: { OR: [{ athleteId: userId }, { coachOwnerId: userId, athleteId: null }] } } },
  ] };
}
