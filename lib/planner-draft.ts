import { SPORT_OPTIONS } from './sport.ts';
import type { TempoBlock, TempoBlockKind, TempoZone } from './tempo-blocks.ts';

export type PlannerTargetType = 'power' | 'pace' | 'hr';

export type PlannerBlockDraft = {
  clientId: string;
  id?: number;
  kind: TempoBlockKind;
  zone: TempoZone;
  durationSec: number;
  reps: number | null;
  targetType: PlannerTargetType | null;
  targetLow: number | null;
  targetHigh: number | null;
  note: string;
};

export type PlannerSessionDraft = {
  id?: number;
  athleteId: number;
  scheduledDate: string;
  sport: string;
  title: string;
  summary: string;
  sourceTemplateId: number | null;
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
    targetLow: number | null;
    targetHigh: number | null;
    note: string | null;
    sortOrder: number;
  }>;
};

let nextClientId = 0;

function createClientId(prefix = 'block') {
  nextClientId += 1;
  return `${prefix}-${nextClientId}`;
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
    targetLow: normalizeNullablePositiveInt(input.targetLow),
    targetHigh: normalizeNullablePositiveInt(input.targetHigh),
    note: typeof input.note === 'string' ? input.note : '',
  };
}

export function createEmptyPlannerSessionDraft(input: {
  athleteId: number;
  scheduledDate: string;
  sport?: string;
}): PlannerSessionDraft {
  return {
    athleteId: input.athleteId,
    scheduledDate: input.scheduledDate,
    sport: input.sport ?? 'RUNNING',
    title: '',
    summary: '',
    sourceTemplateId: null,
    blocks: [
      createPlannerBlockDraft({ kind: 'warmup', zone: 1, durationSec: 600, note: 'Easy warmup' }),
      createPlannerBlockDraft({ kind: 'work', zone: 3, durationSec: 1800, note: 'Main work' }),
      createPlannerBlockDraft({ kind: 'cooldown', zone: 1, durationSec: 600, note: 'Cooldown' }),
    ],
  };
}

export function templateToPlannerDraft(
  template: PlannerTemplateRecord,
  input: { athleteId: number; scheduledDate: string },
): PlannerSessionDraft {
  return {
    athleteId: input.athleteId,
    scheduledDate: input.scheduledDate,
    sport: template.sport,
    title: template.name,
    summary: template.summary ?? '',
    sourceTemplateId: template.id,
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
          targetLow: block.targetLow,
          targetHigh: block.targetHigh,
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
        ? { type: block.targetType, low: block.targetLow, high: block.targetHigh }
        : null,
  }));
}

export function serializePlannerDraftForSave(draft: PlannerSessionDraft) {
  return {
    athleteId: draft.athleteId,
    scheduledDate: draft.scheduledDate,
    sport: draft.sport,
    title: draft.title.trim(),
    summary: draft.summary.trim(),
    sourceTemplateId: draft.sourceTemplateId,
    blocks: draft.blocks.map((block, index) => ({
      id: block.id,
      kind: block.kind,
      zone: block.zone,
      durationSec: block.durationSec,
      reps: block.reps,
      targetType: block.targetType,
      targetLow: block.targetLow,
      targetHigh: block.targetHigh,
      note: block.note.trim() || null,
      sortOrder: index,
    })),
  };
}

export function validatePlannerSessionDraft(draft: PlannerSessionDraft) {
  if (!Number.isInteger(draft.athleteId) || draft.athleteId <= 0) {
    return 'Choose an athlete before saving.';
  }
  if (!draft.scheduledDate || Number.isNaN(new Date(draft.scheduledDate).getTime())) {
    return 'A valid scheduled date is required.';
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
  return input === 'warmup' || input === 'work' || input === 'recovery' || input === 'cooldown'
    ? input
    : 'work';
}

function normalizeZone(input: unknown): TempoZone {
  const parsed = Number(input);
  return parsed >= 1 && parsed <= 5 ? (Math.round(parsed) as TempoZone) : 2;
}

function normalizeTargetType(input: unknown): PlannerTargetType | null {
  return input === 'power' || input === 'pace' || input === 'hr' ? input : null;
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
