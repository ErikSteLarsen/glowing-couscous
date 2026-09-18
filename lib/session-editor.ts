import { deriveSessionMetrics } from './session-math.ts';
import { SPORT_OPTIONS, type SportType } from './sport.ts';
import type { TempoBlock, TempoBlockKind, TempoZone } from './tempo-blocks.ts';
import { normalizeWorkoutTarget, serializeDecimal, validateWorkoutTarget, type WorkoutTarget } from './workout-targets.ts';

export type SessionEditorMode = 'create' | 'planned' | 'actual';
export type SessionEditorTarget = WorkoutTarget;
export type SessionEditorSportMetrics = {
  ftp: number | null;
  thresholdPaceSecPerKm: number | null;
  thresholdHr: number | null;
};

export type SessionEditorBlock = {
  clientId: string;
  id: number | null;
  kind: TempoBlockKind;
  zone: TempoZone;
  durationSec: number;
  reps: number | null;
  target: SessionEditorTarget | null;
  note: string;
  skipped: boolean;
};

export type SessionEditorDraft = {
  mode: SessionEditorMode;
  id: number | null;
  athleteId: number | null;
  coachOwnerId: number | null;
  trainingPlanId: number | null;
  planId: number | null;
  templateId: number | null;
  assignedById: number | null;
  scheduledDate: string | null;
  planWeekday: 1 | 2 | 3 | 4 | 5 | 6 | 7 | null;
  timeLabel: string | null;
  sport: string;
  title: string;
  summary: string;
  coachNotes: string;
  athleteNotes: string;
  rpe: number | null;
  sportMetrics: SessionEditorSportMetrics;
  status: string;
  source: string;
  adjusted: boolean;
  blocks: SessionEditorBlock[];
};

export type PersistedSessionBlock = {
  id?: number | null;
  clientId?: string | null;
  kind?: string | null;
  zone?: number | string | null;
  durationSec?: number | string | null;
  reps?: number | string | null;
  target?: Partial<SessionEditorTarget> | null;
  targetType?: string | null;
  targetMode?: string | null;
  targetReference?: string | null;
  targetLow?: number | string | null;
  targetHigh?: number | string | null;
  targetLowDecimal?: string | null;
  targetHighDecimal?: string | null;
  note?: string | null;
  skipped?: boolean | null;
  sortOrder?: number | null;
};

export type PersistedSessionRecord = {
  id?: number | null;
  athleteId?: number | null;
  coachOwnerId?: number | null;
  trainingPlanId?: number | null;
  planId?: number | null;
  templateId?: number | null;
  assignedById?: number | null;
  date?: string | Date | null;
  scheduledDate?: string | Date | null;
  planWeekday?: number | null;
  timeLabel?: string | null;
  sport?: string | null;
  title?: string | null;
  summary?: string | null;
  coachNotes?: string | null;
  athleteNotes?: string | null;
  rpe?: number | null;
  sportMetrics?: Partial<SessionEditorSportMetrics> | null;
  sportMetricsJson?: string | null;
  status?: string | null;
  source?: string | null;
  adjusted?: boolean | null;
  blocks?: PersistedSessionBlock[] | null;
};

export type SessionEditorFieldPatch = Partial<
  Pick<SessionEditorDraft, 'sport' | 'title' | 'summary' | 'coachNotes' | 'athleteNotes' | 'rpe' | 'sportMetrics'>
>;

export type SessionEditorSchedulePatch = Partial<
  Pick<SessionEditorDraft, 'scheduledDate' | 'planWeekday' | 'timeLabel'>
>;

export type SessionEditorBlockPatch = Partial<Omit<SessionEditorBlock, 'clientId' | 'id'>>;
export type SessionEditorBlockReference = number | string;

let nextClientId = 0;

export function createEmptySessionEditorDraft(
  options: Partial<SessionEditorDraft> = {},
): SessionEditorDraft {
  return normalizeSessionEditorDraft({
    mode: options.mode ?? 'create',
    id: options.id ?? null,
    athleteId: options.athleteId ?? null,
    coachOwnerId: options.coachOwnerId ?? null,
    trainingPlanId: options.trainingPlanId ?? null,
    planId: options.planId ?? null,
    templateId: options.templateId ?? null,
    assignedById: options.assignedById ?? null,
    scheduledDate: options.scheduledDate ?? null,
    planWeekday: options.planWeekday ?? null,
    timeLabel: options.timeLabel ?? null,
    sport: options.sport ?? 'RUNNING',
    title: options.title ?? '',
    summary: options.summary ?? '',
    coachNotes: options.coachNotes ?? '',
    athleteNotes: options.athleteNotes ?? '',
    rpe: options.rpe ?? null,
    sportMetrics: options.sportMetrics ?? emptySportMetrics(),
    status: options.status ?? 'planned',
    source: options.source ?? 'coach',
    adjusted: options.adjusted ?? false,
    blocks: options.blocks ?? [],
  });
}

export function createSessionEditorDraftFromPersisted(
  mode: SessionEditorMode,
  input: PersistedSessionRecord,
): SessionEditorDraft {
  const blocks = Array.isArray(input.blocks)
    ? input.blocks
        .map((block, index) => ({ block, index }))
        .sort((left, right) => (left.block.sortOrder ?? left.index) - (right.block.sortOrder ?? right.index))
        .map(({ block }) => ({
          ...block,
          clientId:
            block.clientId ?? (input.id !== null && input.id !== undefined && block.id !== null && block.id !== undefined
              ? `session-${input.id}-block-${block.id}`
              : undefined),
        }))
    : [];

  return normalizeSessionEditorDraft({
    mode,
    id: input.id,
    athleteId: input.athleteId,
    coachOwnerId: input.coachOwnerId,
    trainingPlanId: input.trainingPlanId,
    planId: input.planId,
    templateId: input.templateId,
    assignedById: input.assignedById,
    scheduledDate: input.scheduledDate ?? input.date,
    planWeekday: input.planWeekday,
    timeLabel: input.timeLabel,
    sport: input.sport,
    title: input.title,
    summary: input.summary,
    coachNotes: input.coachNotes,
    athleteNotes: input.athleteNotes,
    rpe: input.rpe,
    sportMetrics: input.sportMetrics ?? parseSportMetricsJson(input.sportMetricsJson),
    status: input.status,
    source: input.source,
    adjusted: input.adjusted,
    blocks,
  });
}

export function normalizeSessionEditorDraft(input: unknown): SessionEditorDraft {
  const value = asRecord(input);
  const blocks = Array.isArray(value.blocks) ? value.blocks : [];

  return {
    mode: normalizeMode(value.mode),
    id: toNullableInteger(value.id),
    athleteId: toNullableInteger(value.athleteId),
    coachOwnerId: toNullableInteger(value.coachOwnerId),
    trainingPlanId: toNullableInteger(value.trainingPlanId),
    planId: toNullableInteger(value.planId),
    templateId: toNullableInteger(value.templateId),
    assignedById: toNullableInteger(value.assignedById),
    scheduledDate: normalizeDateValue(value.scheduledDate),
    planWeekday: normalizeWeekday(value.planWeekday),
    timeLabel: normalizeNullableText(value.timeLabel),
    sport: typeof value.sport === 'string' ? value.sport : 'RUNNING',
    title: normalizeText(value.title),
    summary: normalizeText(value.summary),
    coachNotes: normalizeText(value.coachNotes),
    athleteNotes: normalizeText(value.athleteNotes),
    rpe: normalizeRpe(value.rpe),
    sportMetrics: normalizeSportMetrics(value.sportMetrics),
    status: typeof value.status === 'string' && value.status ? value.status : 'planned',
    source: typeof value.source === 'string' && value.source ? value.source : 'coach',
    adjusted: value.adjusted === true,
    blocks: blocks.map((block, index) => normalizeSessionEditorBlock(block, index)),
  };
}

export function createSessionEditorBlock(input: Partial<SessionEditorBlock> = {}): SessionEditorBlock {
  return normalizeSessionEditorBlock(input, 0, createClientId());
}

export function addSessionEditorBlock(
  draft: SessionEditorDraft,
  input: Partial<SessionEditorBlock> = {},
): SessionEditorDraft {
  return {
    ...draft,
    blocks: [...draft.blocks, createSessionEditorBlock(input)],
  };
}

export function updateSessionEditorBlock(
  draft: SessionEditorDraft,
  reference: SessionEditorBlockReference,
  patch: SessionEditorBlockPatch,
): SessionEditorDraft {
  const index = findBlockIndex(draft, reference);
  if (index < 0) return draft;

  return {
    ...draft,
    blocks: draft.blocks.map((block, blockIndex) =>
      blockIndex === index
        ? normalizeSessionEditorBlock({ ...block, ...patch }, blockIndex, block.clientId)
        : block,
    ),
  };
}

export function removeSessionEditorBlock(
  draft: SessionEditorDraft,
  reference: SessionEditorBlockReference,
): SessionEditorDraft {
  const index = findBlockIndex(draft, reference);
  if (index < 0) return draft;

  return {
    ...draft,
    blocks: draft.blocks.filter((_, blockIndex) => blockIndex !== index),
  };
}

export function moveSessionEditorBlock(
  draft: SessionEditorDraft,
  fromIndex: number,
  toIndex: number,
): SessionEditorDraft {
  if (!Number.isInteger(fromIndex) || !draft.blocks[fromIndex]) return draft;

  const blocks = draft.blocks.slice();
  const [moved] = blocks.splice(fromIndex, 1);
  const destination = Math.max(0, Math.min(toIndex, blocks.length));
  blocks.splice(destination, 0, moved);
  return { ...draft, blocks };
}

export function reorderSessionEditorBlocks(
  draft: SessionEditorDraft,
  fromIndex: number,
  toIndex: number,
): SessionEditorDraft {
  return moveSessionEditorBlock(draft, fromIndex, toIndex);
}

export function updateSessionEditorFields(
  draft: SessionEditorDraft,
  patch: SessionEditorFieldPatch,
): SessionEditorDraft {
  return normalizeSessionEditorDraft({
    ...draft,
    ...patch,
    mode: draft.mode,
    id: draft.id,
    athleteId: draft.athleteId,
    coachOwnerId: draft.coachOwnerId,
    trainingPlanId: draft.trainingPlanId,
    planId: draft.planId,
    templateId: draft.templateId,
    assignedById: draft.assignedById,
    scheduledDate: draft.scheduledDate,
    planWeekday: draft.planWeekday,
    timeLabel: draft.timeLabel,
    status: draft.status,
    source: draft.source,
    adjusted: draft.adjusted,
    blocks: draft.blocks,
  });
}

export function updateSessionEditorSchedule(
  draft: SessionEditorDraft,
  patch: SessionEditorSchedulePatch,
): SessionEditorDraft {
  return normalizeSessionEditorDraft({
    ...draft,
    ...patch,
    mode: draft.mode,
    id: draft.id,
    athleteId: draft.athleteId,
    coachOwnerId: draft.coachOwnerId,
    trainingPlanId: draft.trainingPlanId,
    planId: draft.planId,
    templateId: draft.templateId,
    assignedById: draft.assignedById,
    status: draft.status,
    source: draft.source,
    adjusted: draft.adjusted,
    blocks: draft.blocks,
  });
}

export function sessionEditorDraftToTempoBlocks(draft: SessionEditorDraft): TempoBlock[] {
  return draft.blocks
    .filter((block) => !block.skipped)
    .map((block) => ({
      kind: block.kind,
      zone: block.zone,
      durationSec: block.durationSec,
      reps: block.reps,
      target: block.target,
    }));
}

export function deriveSessionEditorMetrics(draft: SessionEditorDraft) {
  return deriveSessionMetrics(sessionEditorDraftToTempoBlocks(draft));
}

export function validateSessionEditorDraft(draft: SessionEditorDraft): string | null {
  if (!draft.title.trim()) return 'Session title is required.';
  if (!SPORT_OPTIONS.includes(draft.sport as SportType)) return 'Sport is required.';
  if (draft.scheduledDate !== null && !isCalendarDate(draft.scheduledDate)) {
    return 'Scheduled date must be a valid calendar date.';
  }
  if (draft.planWeekday !== null && (!Number.isInteger(draft.planWeekday) || draft.planWeekday < 1 || draft.planWeekday > 7)) {
    return 'Plan weekday must be an integer from 1 through 7.';
  }
  if (draft.blocks.length === 0) return 'At least one block is required.';

  for (const block of draft.blocks) {
    if (!Number.isInteger(block.durationSec) || block.durationSec <= 0) {
      return 'Every block needs a positive integer duration.';
    }
    if (block.reps !== null && (!Number.isInteger(block.reps) || block.reps <= 0)) {
      return 'Repetitions must be a positive integer when provided.';
    }
    if (block.target !== null) {
      const targetError = validateWorkoutTarget(block.target, draft.sport);
      if (targetError) return targetError;
    }
  }

  if (draft.rpe !== null && (!Number.isInteger(draft.rpe) || draft.rpe < 1 || draft.rpe > 10)) {
    return 'RPE must be an integer from 1 through 10.';
  }

  return null;
}

export function serializeSessionEditorDraft(draft: SessionEditorDraft) {
  return {
    id: draft.id,
    athleteId: draft.athleteId,
    coachOwnerId: draft.coachOwnerId,
    trainingPlanId: draft.trainingPlanId,
    planId: draft.planId,
    templateId: draft.templateId,
    assignedById: draft.assignedById,
    scheduledDate: draft.scheduledDate,
    planWeekday: draft.planWeekday,
    timeLabel: normalizeNullableText(draft.timeLabel),
    sport: draft.sport,
    title: draft.title.trim(),
    summary: draft.summary.trim() || null,
    coachNotes: draft.coachNotes.trim() || null,
    athleteNotes: draft.athleteNotes.trim() || null,
    rpe: draft.rpe,
    sportMetrics: draft.sportMetrics,
    status: draft.status,
    source: draft.source,
    adjusted: draft.adjusted,
    blocks: draft.blocks.map((block, sortOrder) => ({
      id: block.id,
      kind: block.kind,
      zone: block.zone,
      durationSec: block.durationSec,
       reps: block.reps,
       targetType: block.target?.metric ?? null,
       targetMode: block.target?.mode ?? 'absolute',
       targetReference: block.target?.reference ?? null,
       targetLow: block.target?.low ?? null,
       targetHigh: block.target?.high ?? null,
       targetLowDecimal: block.target ? serializeDecimal(block.target.low) : null,
       targetHighDecimal: block.target ? serializeDecimal(block.target.high) : null,
      note: block.note.trim() || null,
      skipped: block.skipped,
      sortOrder,
    })),
  };
}

export function hasBaselineActualDifference(
  baseline: SessionEditorDraft,
  actual: SessionEditorDraft,
): boolean {
  return JSON.stringify(sessionDifferenceIdentity(baseline)) !== JSON.stringify(sessionDifferenceIdentity(actual));
}

function sessionDifferenceIdentity(draft: SessionEditorDraft) {
  return {
    sport: draft.sport,
    title: draft.title.trim(),
    summary: normalizeNullableText(draft.summary),
    coachNotes: normalizeNullableText(draft.coachNotes),
    athleteNotes: normalizeNullableText(draft.athleteNotes),
    rpe: draft.rpe,
    sportMetrics: draft.sportMetrics,
    schedule: {
      scheduledDate: draft.scheduledDate,
      planWeekday: draft.planWeekday,
      timeLabel: normalizeNullableText(draft.timeLabel),
    },
    blocks: draft.blocks.map((block) => ({
      kind: block.kind,
      zone: block.zone,
      durationSec: block.durationSec,
      reps: block.reps,
      target: block.target,
      note: block.note.trim(),
      skipped: block.skipped,
    })),
  };
}

function normalizeSessionEditorBlock(input: unknown, index: number, fallbackClientId?: string): SessionEditorBlock {
  const value = asRecord(input);
  const rawTarget = value.target;
  const target = rawTarget === null ? null : normalizeTarget(value);

  return {
    clientId:
      typeof value.clientId === 'string' && value.clientId
        ? value.clientId
        : fallbackClientId ?? createClientId(),
    id: toNullableInteger(value.id),
    kind: normalizeKind(value.kind),
    zone: normalizeZone(value.zone),
    durationSec: normalizePositiveInteger(value.durationSec, 900),
    reps: normalizePositiveIntegerOrNull(value.reps),
    target,
    note: normalizeText(value.note),
    skipped: value.skipped === true,
  };
}

function normalizeTarget(value: Record<string, unknown>): SessionEditorTarget | null {
  const raw = asRecord(value.target);
  return normalizeWorkoutTarget({
    metric: raw.metric ?? raw.type ?? value.targetType,
    mode: raw.mode ?? value.targetMode ?? 'absolute',
    reference: raw.reference ?? value.targetReference ?? null,
    low: raw.low ?? value.targetLowDecimal ?? value.targetLow,
    high: raw.high ?? value.targetHighDecimal ?? value.targetHigh,
  });
}

function parseSportMetricsJson(json: string | null | undefined): SessionEditorSportMetrics {
  if (!json) return emptySportMetrics();
  try {
    const parsed: unknown = JSON.parse(json);
    return normalizeSportMetrics(parsed);
  } catch {
    return emptySportMetrics();
  }
}

function normalizeSportMetrics(input: unknown): SessionEditorSportMetrics {
  const value = asRecord(input);
  return {
    ftp: toNullableNumber(value.ftp),
    thresholdPaceSecPerKm: toNullableNumber(value.thresholdPaceSecPerKm),
    thresholdHr: toNullableNumber(value.thresholdHr),
  };
}

function emptySportMetrics(): SessionEditorSportMetrics {
  return { ftp: null, thresholdPaceSecPerKm: null, thresholdHr: null };
}

function findBlockIndex(draft: SessionEditorDraft, reference: SessionEditorBlockReference) {
  return typeof reference === 'number' ? reference : draft.blocks.findIndex((block) => block.clientId === reference);
}

function normalizeMode(input: unknown): SessionEditorMode {
  return input === 'create' || input === 'planned' || input === 'actual' ? input : 'create';
}

function normalizeKind(input: unknown): TempoBlockKind {
  return input === 'warmup' || input === 'work' || input === 'recovery' || input === 'cooldown' ? input : 'work';
}

function normalizeZone(input: unknown): TempoZone {
  const zone = Number(input);
  return Number.isFinite(zone) && zone >= 1 && zone <= 5 ? (Math.round(zone) as TempoZone) : 2;
}

function normalizeWeekday(input: unknown): SessionEditorDraft['planWeekday'] {
  const weekday = Number(input);
  return Number.isInteger(weekday) && weekday >= 1 && weekday <= 7
    ? (weekday as SessionEditorDraft['planWeekday'])
    : null;
}

function normalizeRpe(input: unknown) {
  const rpe = toNullableInteger(input);
  return rpe !== null && rpe >= 1 && rpe <= 10 ? rpe : null;
}

function normalizePositiveInteger(input: unknown, fallback: number) {
  const value = Number(input);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

function normalizePositiveIntegerOrNull(input: unknown) {
  const value = toNullableInteger(input);
  return value !== null && value > 0 ? value : null;
}

function toNullableInteger(input: unknown) {
  if (input === null || input === undefined || input === '') return null;
  const value = Number(input);
  return Number.isFinite(value) ? Math.round(value) : null;
}

function toNullableNumber(input: unknown) {
  if (input === null || input === undefined || input === '') return null;
  const value = Number(input);
  return Number.isFinite(value) ? value : null;
}

function normalizeDateValue(input: unknown): string | null {
  if (input === null || input === undefined || input === '') return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input.toISOString().slice(0, 10);
  if (typeof input !== 'string') return null;
  return input.trim() || null;
}

function normalizeText(input: unknown) {
  return typeof input === 'string' ? input : '';
}

function normalizeNullableText(input: unknown) {
  const text = normalizeText(input).trim();
  return text || null;
}

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
}

function createClientId() {
  nextClientId += 1;
  return `session-block-${nextClientId}`;
}

function isCalendarDate(input: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return (
    date.getUTCFullYear() === Number(match[1]) &&
    date.getUTCMonth() === Number(match[2]) - 1 &&
    date.getUTCDate() === Number(match[3])
  );
}
