import {
  createSessionEditorDraftFromPersisted,
  deriveSessionEditorMetrics,
  type PersistedSessionBlock,
  type PersistedSessionRecord,
  type SessionEditorDraft,
  type SessionEditorTarget,
} from './session-editor.ts';

export const SHARED_WORKOUT_SNAPSHOT_VERSION = 1 as const;

export type SharedWorkoutBlock = {
  kind: 'warmup' | 'work' | 'recovery' | 'cooldown';
  zone: 1 | 2 | 3 | 4 | 5;
  durationSec: number;
  reps: number | null;
  target: SessionEditorTarget | null;
  note: string;
  skipped: boolean;
};

export type SharedWorkoutProjection = {
  snapshotVersion: typeof SHARED_WORKOUT_SNAPSHOT_VERSION;
  sourceKind: 'session' | 'template';
  sport: string;
  title: string;
  summary: string;
  blocks: SharedWorkoutBlock[];
  metrics: {
    durationSec: number;
    tss: number;
    segments: ReturnType<typeof deriveSessionEditorMetrics>['segments'];
  };
};

export type SharedWorkoutSource = {
  sourceKind: SharedWorkoutProjection['sourceKind'];
  sport?: string | null;
  title?: string | null;
  name?: string | null;
  summary?: string | null;
  blocks?: PersistedSessionBlock[] | null;
};

export function createSharedWorkoutProjection(source: SharedWorkoutSource): SharedWorkoutProjection {
  const draft = createSessionEditorDraftFromPersisted('create', {
    sport: source.sport ?? 'RUNNING',
    title: source.title ?? source.name ?? '',
    summary: source.summary ?? '',
    blocks: source.blocks ?? [],
  });
  const metrics = deriveSessionEditorMetrics(draft);

  return {
    snapshotVersion: SHARED_WORKOUT_SNAPSHOT_VERSION,
    sourceKind: source.sourceKind,
    sport: draft.sport,
    title: draft.title.trim(),
    summary: draft.summary.trim(),
    blocks: draft.blocks.map(({ kind, zone, durationSec, reps, target, note, skipped }) => ({
      kind,
      zone,
      durationSec,
      reps,
      target,
      note: note.trim(),
      skipped,
    })),
    metrics: {
      durationSec: metrics.durationSec,
      tss: metrics.tss,
      segments: metrics.segments,
    },
  };
}

export function createSessionEditorDraftFromSharedProjection(
  projection: SharedWorkoutProjection,
): SessionEditorDraft {
  return createSessionEditorDraftFromPersisted('create', {
    sport: projection.sport,
    title: projection.title,
    summary: projection.summary,
    blocks: projection.blocks,
    source: 'share',
  });
}

export function isSharedWorkoutProjection(input: unknown): input is SharedWorkoutProjection {
  if (!input || typeof input !== 'object') return false;
  const value = input as Record<string, unknown>;
  return (
    value.snapshotVersion === SHARED_WORKOUT_SNAPSHOT_VERSION &&
    (value.sourceKind === 'session' || value.sourceKind === 'template') &&
    typeof value.sport === 'string' &&
    typeof value.title === 'string' &&
    typeof value.summary === 'string' &&
    Array.isArray(value.blocks) &&
    Boolean(value.metrics && typeof value.metrics === 'object')
  );
}

export function parseSharedWorkoutProjection(input: string | null | undefined): SharedWorkoutProjection | null {
  if (!input) return null;
  try {
    const parsed: unknown = JSON.parse(input);
    return isSharedWorkoutProjection(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function createSharedProjectionSourceFromSession(
  session: PersistedSessionRecord,
  baseline?: PersistedSessionRecord | null,
) {
  const source = baseline ?? session;
  return createSharedWorkoutProjection({
    sourceKind: 'session',
    sport: source.sport,
    title: source.title,
    summary: source.summary,
    blocks: source.blocks,
  });
}
