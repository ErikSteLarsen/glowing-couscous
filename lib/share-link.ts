import {
  createSessionEditorDraftFromPersisted,
  deriveSessionEditorMetrics,
  type PersistedSessionBlock,
  type PersistedSessionRecord,
  type SessionEditorDraft,
  type SessionEditorTarget,
} from './session-editor.ts';

export const SHARED_WORKOUT_SNAPSHOT_VERSION = 1 as const;
export const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;

export type ShareLinkAction = 'planner' | 'template';

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

export function isShareAction(input: unknown): input is ShareLinkAction {
  return input === 'planner' || input === 'template';
}

export function isShareToken(input: unknown): input is string {
  return typeof input === 'string' && SHARE_TOKEN_PATTERN.test(input);
}

export function createSharePath(token: string, action?: ShareLinkAction) {
  return `/share/${token}${action ? `?action=${action}` : ''}`;
}

export function getSafeShareCallbackPath(input: unknown): string | null {
  if (typeof input !== 'string' || !input) return null;
  try {
    const url = new URL(input, 'https://share.invalid');
    if (url.origin !== 'https://share.invalid' || !url.pathname.startsWith('/share/')) return null;
    const token = url.pathname.slice('/share/'.length);
    if (!isShareToken(token)) return null;
    const action = url.searchParams.get('action');
    if (action !== null && !isShareAction(action)) return null;
    if (action !== null && url.searchParams.getAll('action').length !== 1) return null;
    for (const key of url.searchParams.keys()) {
      if (key !== 'action') return null;
    }
    return createSharePath(token, action === null ? undefined : action);
  } catch {
    return null;
  }
}

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
    if (!isSharedWorkoutProjection(parsed) || !isValidSharedWorkoutBlocks(parsed.blocks)) return null;
    const metrics = parsed.metrics as Record<string, unknown>;
    if (
      !Number.isSafeInteger(metrics.durationSec) ||
      Number(metrics.durationSec) < 0 ||
      !Number.isSafeInteger(metrics.tss) ||
      Number(metrics.tss) < 0 ||
      !Array.isArray(metrics.segments)
    ) {
      return null;
    }

    const sanitized = createSharedWorkoutProjection({
      sourceKind: parsed.sourceKind,
      sport: parsed.sport,
      title: parsed.title,
      summary: parsed.summary,
      blocks: parsed.blocks,
    });
    return JSON.stringify(sanitized.metrics) === JSON.stringify(parsed.metrics) ? sanitized : null;
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

function isValidSharedWorkoutBlocks(input: unknown): input is SharedWorkoutBlock[] {
  return Array.isArray(input) && input.length > 0 && input.every((block) => {
    if (!block || typeof block !== 'object') return false;
    const value = block as Record<string, unknown>;
    if (
      !['warmup', 'work', 'recovery', 'cooldown'].includes(String(value.kind)) ||
      !Number.isSafeInteger(value.zone) ||
      Number(value.zone) < 1 ||
      Number(value.zone) > 5 ||
      !Number.isSafeInteger(value.durationSec) ||
      Number(value.durationSec) <= 0 ||
      (value.reps !== null && (!Number.isSafeInteger(value.reps) || Number(value.reps) <= 0)) ||
      typeof value.note !== 'string' ||
      typeof value.skipped !== 'boolean'
    ) {
      return false;
    }

    if (value.target === null) return true;
    if (!value.target || typeof value.target !== 'object') return false;
    const target = value.target as Record<string, unknown>;
    return (
      ['power', 'pace', 'hr'].includes(String(target.type)) &&
      Number.isSafeInteger(target.low) &&
      Number.isSafeInteger(target.high) &&
      Number(target.low) >= 0 &&
      Number(target.high) >= Number(target.low)
    );
  });
}
