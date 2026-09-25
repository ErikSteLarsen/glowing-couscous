import { SPORT_OPTIONS } from './sport.ts';
import type { TempoBlock, TempoBlockKind, TempoZone } from './tempo-blocks.ts';
import { isProfilePaceZoneReference, type WorkoutTargetReference } from './workout-targets.ts';

export type PlannerTargetType = 'power' | 'pace' | 'hr' | 'rpe';

export type SessionOwnershipMode = 'coach-library' | 'training-plan' | 'athlete';

export type PlannerSportMetrics = {
  ftp: number | null;
  thresholdPaceSecPerKm: number | null;
  thresholdHr: number | null;
};

export type PlannerBlockDraft = {
  clientId: string;
  id?: number;
  kind: TempoBlockKind;
  zone: TempoZone;
  durationSec: number;
  reps: number | null;
  targetType: PlannerTargetType | null;
  targetMode: 'absolute' | 'relative';
  targetReference: WorkoutTargetReference | null;
  targetLow: number | null;
  targetHigh: number | null;
  targetLowDecimal: string | null;
  targetHighDecimal: string | null;
  note: string;
  skipped?: boolean;
};

export type PlannerSessionDraft = {
  id?: number;
  ownershipMode: SessionOwnershipMode;
  athleteId: number | null;
  scheduledDate: string | null;
  planWeekday: 1 | 2 | 3 | 4 | 5 | 6 | 7 | null;
  sport: string;
  title: string;
  summary: string;
  sourceTemplateId: number | null;
  sportMetrics: PlannerSportMetrics;
  blocks: PlannerBlockDraft[];
};

export type PlannerTemplateRecord = {
  id: number;
  sport: string;
  name: string;
  summary: string | null;
  blocks: Array<{
    id: number;
    kind: string;
    zone: number;
    durationSec: number;
    reps: number | null;
    targetType: string | null;
    targetMode?: string | null;
    targetReference?: string | null;
    targetLow: number | null;
    targetHigh: number | null;
    targetLowDecimal?: string | null;
    targetHighDecimal?: string | null;
    note: string | null;
    sortOrder: number;
  }>;
};

let nextClientId = 0;

function createClientId(prefix = 'block') {
  nextClientId += 1;
  return `${prefix}-${nextClientId}`;
}

export function parseSportMetricsJson(json: string | null | undefined): PlannerSportMetrics {
  const empty: PlannerSportMetrics = { ftp: null, thresholdPaceSecPerKm: null, thresholdHr: null };
  if (!json) return empty;
  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return empty;
    return {
      ftp: typeof parsed.ftp === 'number' ? parsed.ftp : null,
      thresholdPaceSecPerKm: typeof parsed.thresholdPaceSecPerKm === 'number' ? parsed.thresholdPaceSecPerKm : null,
      thresholdHr: typeof parsed.thresholdHr === 'number' ? parsed.thresholdHr : null,
    };
  } catch {
    return empty;
  }
}

export function createPlannerBlockDraft(input: Partial<PlannerBlockDraft> = {}): PlannerBlockDraft {
  return {
    clientId: input.clientId ?? createClientId(),
    id: input.id,
    kind: normalizeKind(input.kind),
    zone: normalizeZone(input.zone),
    durationSec: normalizePositiveInt(input.durationSec, 600),
    reps: normalizeNullablePositiveInt(input.reps),
    targetType: normalizeTargetType(input.targetType),
    targetMode: input.targetMode === 'relative' ? 'relative' : 'absolute',
    targetReference: normalizeTargetReference(input.targetReference),
    targetLow: normalizeNullablePositiveInt(input.targetLow),
    targetHigh: normalizeNullablePositiveInt(input.targetHigh),
    targetLowDecimal: typeof input.targetLowDecimal === 'string' ? input.targetLowDecimal : null,
    targetHighDecimal: typeof input.targetHighDecimal === 'string' ? input.targetHighDecimal : null,
    note: typeof input.note === 'string' ? input.note : '',
    skipped: input.skipped === true,
  };
}

export function createEmptyPlannerSessionDraft(input: {
  ownershipMode?: SessionOwnershipMode;
  athleteId?: number | null;
  scheduledDate: string | null;
  sport?: string;
}): PlannerSessionDraft {
  return {
    ownershipMode: input.ownershipMode ?? 'athlete',
    athleteId: input.athleteId ?? null,
    scheduledDate: input.scheduledDate,
    planWeekday: null,
    sport: input.sport ?? 'RUNNING',
    title: '',
    summary: '',
    sourceTemplateId: null,
    sportMetrics: {
      ftp: null,
      thresholdPaceSecPerKm: null,
      thresholdHr: null,
    },
    blocks: [
      createPlannerBlockDraft({ kind: 'warmup', zone: 1, durationSec: 600, note: 'Easy warmup' }),
      createPlannerBlockDraft({ kind: 'work', zone: 3, durationSec: 1800, note: 'Main work' }),
      createPlannerBlockDraft({ kind: 'cooldown', zone: 1, durationSec: 600, note: 'Cooldown' }),
    ],
  };
}

export function templateToPlannerDraft(
  template: PlannerTemplateRecord,
  input: { ownershipMode?: SessionOwnershipMode; athleteId?: number | null; scheduledDate: string | null },
): PlannerSessionDraft {
  return {
    ownershipMode: input.ownershipMode ?? 'athlete',
    athleteId: input.athleteId ?? null,
    scheduledDate: input.scheduledDate,
    planWeekday: null,
    sport: template.sport,
    title: template.name,
    summary: template.summary ?? '',
    sourceTemplateId: template.id,
    sportMetrics: {
      ftp: null,
      thresholdPaceSecPerKm: null,
      thresholdHr: null,
    },
    blocks: template.blocks
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((block) =>
        createPlannerBlockDraft({
          id: block.id,
          kind: normalizeKind(block.kind),
          zone: normalizeZone(block.zone),
          durationSec: block.durationSec,
          reps: block.reps,
          targetType: normalizeTargetType(block.targetType),
          targetMode: block.targetMode === 'relative' ? 'relative' : 'absolute',
          targetReference: normalizeTargetReference(block.targetReference),
          targetLow: block.targetLow,
          targetHigh: block.targetHigh,
          targetLowDecimal: block.targetLowDecimal ?? null,
          targetHighDecimal: block.targetHighDecimal ?? null,
          note: block.note ?? '',
        }),
      ),
  };
}

export function addPlannerBlock(draft: PlannerSessionDraft, kind: TempoBlockKind = 'work') {
  return {
    ...draft,
    blocks: [...draft.blocks, createPlannerBlockDraft({ kind, zone: kind === 'recovery' ? 1 : 3 })],
  };
}

export function updatePlannerBlock(
  draft: PlannerSessionDraft,
  index: number,
  patch: Partial<Omit<PlannerBlockDraft, 'clientId' | 'id'>>,
) {
  return {
    ...draft,
    blocks: draft.blocks.map((block, blockIndex) =>
      blockIndex === index
        ? createPlannerBlockDraft({
            ...block,
            ...patch,
            clientId: block.clientId,
            id: block.id,
          })
        : block,
    ),
  };
}

export function duplicatePlannerBlock(draft: PlannerSessionDraft, index: number) {
  const source = draft.blocks[index];
  if (!source) return draft;

  const copy = createPlannerBlockDraft({
    ...source,
    clientId: createClientId('copy'),
    id: undefined,
    note: source.note,
  });
  const blocks = [...draft.blocks.slice(0, index + 1), copy, ...draft.blocks.slice(index + 1)];
  return { ...draft, blocks };
}

export function removePlannerBlock(draft: PlannerSessionDraft, index: number) {
  if (draft.blocks.length <= 1) return draft;
  return { ...draft, blocks: draft.blocks.filter((_, blockIndex) => blockIndex !== index) };
}

export function movePlannerBlock(draft: PlannerSessionDraft, fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex || !draft.blocks[fromIndex]) return draft;
  const next = draft.blocks.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, moved);
  return { ...draft, blocks: next };
}

export function plannerDraftToTempoBlocks(blocks: PlannerBlockDraft[]): TempoBlock[] {
  return blocks.map((block) => ({
    kind: block.kind,
    zone: block.zone,
    durationSec: block.durationSec,
    reps: block.reps,
    target:
      block.targetType && block.targetLow !== null && block.targetHigh !== null
        ? { metric: block.targetType, mode: block.targetMode, reference: block.targetReference, low: Number(block.targetLowDecimal ?? block.targetLow), high: Number(block.targetHighDecimal ?? block.targetHigh) }
        : null,
  }));
}

export function serializePlannerDraftForSave(draft: PlannerSessionDraft) {
  return {
    ownershipMode: draft.ownershipMode,
    athleteId: draft.athleteId,
    scheduledDate: draft.scheduledDate,
    planWeekday: draft.planWeekday,
    sport: draft.sport,
    title: draft.title.trim(),
    summary: draft.summary.trim(),
    sourceTemplateId: draft.sourceTemplateId,
    sportMetrics: draft.sportMetrics,
    blocks: draft.blocks.map((block, index) => ({
      id: block.id,
      kind: block.kind,
      zone: block.zone,
      durationSec: block.durationSec,
      reps: block.reps,
        targetType: block.targetType,
        targetMode: block.targetMode,
        targetReference: block.targetReference,
        targetLow: block.targetLow,
        targetHigh: block.targetHigh,
        targetLowDecimal: block.targetLowDecimal ?? (block.targetLow === null ? null : String(block.targetLow)),
        targetHighDecimal: block.targetHighDecimal ?? (block.targetHigh === null ? null : String(block.targetHigh)),
      note: block.note.trim() || null,
      skipped: block.skipped === true,
      sortOrder: index,
    })),
  };
}

export function validatePlannerSessionDraft(draft: PlannerSessionDraft) {
  if (draft.ownershipMode === 'coach-library') {
    if (!draft.scheduledDate) return 'A coach session date is required.';
    if (draft.planWeekday !== null) return 'Standalone coach sessions cannot have a training-plan weekday.';
  }

  if (draft.ownershipMode === 'training-plan') {
    if (draft.planWeekday === null) return 'Choose a weekday for the training-plan session.';
    if (draft.scheduledDate) return 'Training-plan sessions use a weekday instead of a fixed date.';
  }

  if (draft.ownershipMode === 'athlete') {
    if (!Number.isInteger(draft.athleteId) || (draft.athleteId ?? 0) <= 0) {
      return 'Choose an athlete before saving.';
    }
    if (!draft.scheduledDate || Number.isNaN(new Date(draft.scheduledDate).getTime())) {
      return 'A valid scheduled date is required.';
    }
  }

  if (!draft.title.trim()) {
    return 'Session title is required.';
  }
  if (!SPORT_OPTIONS.includes(draft.sport as (typeof SPORT_OPTIONS)[number])) {
    return 'Sport is required.';
  }
  if (draft.blocks.length === 0) {
    return 'At least one block is required.';
  }
  for (const block of draft.blocks) {
    if (block.durationSec <= 0) {
      return 'Every block needs a positive duration.';
    }
    if (block.targetType && (block.targetLow === null || block.targetHigh === null)) {
      return 'Target range needs both low and high values.';
    }
    if (block.targetLow !== null && block.targetHigh !== null && block.targetLow > block.targetHigh) {
      return 'Target range low must be less than or equal to target high.';
    }
  }
  return null;
}

function normalizeKind(input: unknown): TempoBlockKind {
  return input === 'warmup' || input === 'work' || input === 'recovery' || input === 'cooldown' || input === 'pause'
    ? input
    : 'work';
}

function normalizeZone(input: unknown): TempoZone {
  const parsed = Number(input);
  return parsed >= 1 && parsed <= 5 ? (Math.round(parsed) as TempoZone) : 2;
}

function normalizeTargetType(input: unknown): PlannerTargetType | null {
  return input === 'power' || input === 'pace' || input === 'hr' || input === 'rpe' ? input : null;
}

function normalizeTargetReference(input: unknown): PlannerBlockDraft['targetReference'] {
  return input === 'ftp' || input === 'threshold-pace' || input === 'css' || input === 'threshold-hr' || input === 'max-hr' || input === 'profile-pace' || isProfilePaceZoneReference(input) ? input as WorkoutTargetReference : null;
}

function normalizePositiveInt(input: unknown, fallback: number) {
  const parsed = Number(input);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

function normalizeNullablePositiveInt(input: unknown) {
  if (input === null || input === undefined || input === '') return null;
  const parsed = Number(input);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
}
