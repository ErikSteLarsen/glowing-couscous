import { createSessionEditorBlock, updateSessionEditorBlock, type SessionEditorBlock, type SessionEditorBlockPatch, type SessionEditorDraft } from './session-editor.ts';
import { groupSessionStructure, type StructureBlock } from './session-structure.ts';
import type { PerformanceProfile } from './performance-profile.ts';
import type { TempoBlockKind, TempoZone } from './tempo-blocks.ts';
import { presetTarget, zoneForTarget } from './workout-zone-intensity.ts';
import { targetOptionReference, type WorkoutTarget } from './workout-targets.ts';

/**
 * Builder rows over the flat block list. Blocks stay flat (the stored contract): a repeated
 * set of two or more steps is stored as consecutive identical copies, and a single repeated
 * step uses its own `reps`. Rows fold the copies into one set so each step is edited once.
 */
export type BuilderStepRow = { type: 'step'; id: string; index: number };
export type BuilderSetRow = {
  type: 'set';
  id: string;
  /** First block of the set and one past its last block. */
  start: number;
  end: number;
  /** Steps in one repetition. */
  width: number;
  repeats: number;
  /** "4 × (effort + recovery)" stored without the final recovery. */
  dropsLastStep: boolean;
};
export type BuilderRow = BuilderStepRow | BuilderSetRow;

function structureOf(block: SessionEditorBlock, index: number): StructureBlock {
  return {
    id: index,
    kind: block.kind,
    zone: block.zone,
    durationSec: block.durationSec,
    reps: block.reps,
    targetLabel: block.target ? JSON.stringify(block.target) : null,
    note: block.note.trim() || null,
    skipped: block.skipped,
  };
}

export function buildBuilderRows(blocks: SessionEditorBlock[]): BuilderRow[] {
  const rows: BuilderRow[] = [];
  let start = 0;
  for (const group of groupSessionStructure(blocks.map(structureOf))) {
    const end = start + group.blocks.length;
    const width = group.pattern.length;
    // Identical single steps stay separate rows so Duplicate never hides a copy inside a set.
    if (group.repeats > 1 && width > 1) {
      rows.push({ type: 'set', id: blocks[start].clientId, start, end, width, repeats: group.repeats, dropsLastStep: end - start < width * group.repeats });
    } else {
      for (let index = start; index < end; index += 1) rows.push({ type: 'step', id: blocks[index].clientId, index });
    }
    start = end;
  }
  return rows;
}

export function rowSpan(row: BuilderRow): { start: number; end: number } {
  return row.type === 'set' ? { start: row.start, end: row.end } : { start: row.index, end: row.index + 1 };
}

/** The row holding a block, and for a set the step's place inside one repetition. */
export function locateBlock(rows: BuilderRow[], blockIndex: number): { row: BuilderRow; rowIndex: number; offset: number } | null {
  const rowIndex = rows.findIndex((row) => {
    const span = rowSpan(row);
    return blockIndex >= span.start && blockIndex < span.end;
  });
  if (rowIndex < 0) return null;
  const row = rows[rowIndex];
  return { row, rowIndex, offset: row.type === 'set' ? (blockIndex - row.start) % row.width : 0 };
}

/** Index of the block that stands for a selection: the first repetition of a set step. */
export function representativeIndex(rows: BuilderRow[], blockIndex: number): number {
  const located = locateBlock(rows, blockIndex);
  if (!located) return blockIndex;
  return located.row.type === 'set' ? located.row.start + located.offset : blockIndex;
}

function copyBlock(block: SessionEditorBlock): SessionEditorBlock {
  return createSessionEditorBlock({ ...block, clientId: '', id: null });
}

function replaceSpan(draft: SessionEditorDraft, start: number, end: number, blocks: SessionEditorBlock[]): SessionEditorDraft {
  return { ...draft, blocks: [...draft.blocks.slice(0, start), ...blocks, ...draft.blocks.slice(end)] };
}

/** Stored blocks for `repeats` repetitions of a pattern, reusing existing blocks where they exist. */
function setBlocks(existing: SessionEditorBlock[], pattern: SessionEditorBlock[], repeats: number, dropsLastStep: boolean) {
  const length = pattern.length * repeats - (dropsLastStep ? 1 : 0);
  return Array.from({ length }, (_, position) => existing[position] ?? copyBlock(pattern[position % pattern.length]));
}

export function setRepeatCount(draft: SessionEditorDraft, row: BuilderSetRow, repeats: number): SessionEditorDraft {
  const count = Math.max(1, Math.min(50, Math.round(repeats)));
  if (count === row.repeats) return draft;
  const existing = draft.blocks.slice(row.start, row.end);
  const pattern = existing.slice(0, row.width);
  return replaceSpan(draft, row.start, row.end, setBlocks(existing, pattern, count, row.dropsLastStep && count > 1));
}

/** Indexes of one step in every repetition of a set. */
function setStepIndexes(row: BuilderSetRow, offset: number): number[] {
  return Array.from({ length: row.repeats }, (_, repeat) => row.start + repeat * row.width + offset).filter((index) => index < row.end);
}

export function patchSetStep(draft: SessionEditorDraft, row: BuilderSetRow, offset: number, patch: SessionEditorBlockPatch): SessionEditorDraft {
  return setStepIndexes(row, offset).reduce((next, index) => updateSessionEditorBlock(next, index, patch), draft);
}

/** Rebuild a set from an edited pattern. A one-step pattern becomes a single step with `reps`. */
function rebuildSet(draft: SessionEditorDraft, row: BuilderSetRow, pattern: SessionEditorBlock[], dropsLastStep: boolean): SessionEditorDraft {
  if (pattern.length === 1) {
    const [step] = pattern;
    return replaceSpan(draft, row.start, row.end, [createSessionEditorBlock({ ...step, reps: row.repeats > 1 ? row.repeats : null })]);
  }
  // The first repetition keeps its stored blocks; later repetitions are fresh copies of the pattern.
  const repetitions = Array.from({ length: row.repeats }, (_, repeat) => repeat === 0 ? pattern : pattern.map(copyBlock)).flat();
  return replaceSpan(draft, row.start, row.end, dropsLastStep ? repetitions.slice(0, -1) : repetitions);
}

export function removeSetStep(draft: SessionEditorDraft, row: BuilderSetRow, offset: number): SessionEditorDraft {
  const pattern = draft.blocks.slice(row.start, row.start + row.width).filter((_, position) => position !== offset);
  return rebuildSet(draft, row, pattern, row.dropsLastStep && offset !== row.width - 1);
}

export function moveSetStep(draft: SessionEditorDraft, row: BuilderSetRow, offset: number, direction: -1 | 1): SessionEditorDraft {
  const target = offset + direction;
  if (target < 0 || target >= row.width) return draft;
  const pattern = draft.blocks.slice(row.start, row.start + row.width);
  [pattern[offset], pattern[target]] = [pattern[target], pattern[offset]];
  return rebuildSet(draft, row, pattern, row.dropsLastStep);
}

export function addStepToSet(draft: SessionEditorDraft, row: BuilderSetRow, step: SessionEditorBlock): SessionEditorDraft {
  const pattern = [...draft.blocks.slice(row.start, row.start + row.width), step];
  return rebuildSet(draft, row, pattern, false);
}

/** Turn a step and the step after it into a set of two repetitions. */
export function repeatWithNext(draft: SessionEditorDraft, index: number): SessionEditorDraft {
  const pair = draft.blocks.slice(index, index + 2);
  if (pair.length < 2) return draft;
  return replaceSpan(draft, index + 2, index + 2, pair.map(copyBlock));
}

export function insertBlocks(draft: SessionEditorDraft, at: number, blocks: SessionEditorBlock[]): SessionEditorDraft {
  return replaceSpan(draft, at, at, blocks);
}

export function duplicateRow(draft: SessionEditorDraft, row: BuilderRow): { draft: SessionEditorDraft; firstId: string } {
  const { start, end } = rowSpan(row);
  const copies = draft.blocks.slice(start, end).map(copyBlock);
  return { draft: insertBlocks(draft, end, copies), firstId: copies[0].clientId };
}

export function removeRow(draft: SessionEditorDraft, row: BuilderRow): SessionEditorDraft {
  const { start, end } = rowSpan(row);
  return replaceSpan(draft, start, end, []);
}

/** Move a whole row (a step or a set) to the position of another row. */
export function moveRow(draft: SessionEditorDraft, rows: BuilderRow[], fromRow: number, toRow: number): SessionEditorDraft {
  if (fromRow === toRow || !rows[fromRow] || !rows[toRow]) return draft;
  const moving = rowSpan(rows[fromRow]);
  const target = rowSpan(rows[toRow]);
  const blocks = draft.blocks.slice(moving.start, moving.end);
  const rest = [...draft.blocks.slice(0, moving.start), ...draft.blocks.slice(moving.end)];
  const insertion = toRow > fromRow ? target.end - blocks.length : target.start;
  return { ...draft, blocks: [...rest.slice(0, insertion), ...blocks, ...rest.slice(insertion)] };
}

/** Accepts "10", "10m", "90s", "1:30", "1h 5m", "2m30s"; a bare number is minutes. */
export function parseDuration(input: string): number | null {
  const text = input.trim().toLowerCase().replace(/\s+/g, '');
  if (!text) return null;
  let seconds: number;
  const clock = /^(?:(\d+):)?(\d+):(\d{1,2})$/.exec(text);
  if (/^\d+(?:[.,]\d+)?$/.test(text)) {
    seconds = Number(text.replace(',', '.')) * 60;
  } else if (clock) {
    seconds = Number(clock[1] ?? 0) * 3600 + Number(clock[2]) * 60 + Number(clock[3]);
    if (Number(clock[3]) > 59) return null;
  } else {
    const units = /^(?:(\d+(?:[.,]\d+)?)h)?(?:(\d+(?:[.,]\d+)?)(?:m|min))?(?:(\d+)(?:s|sec))?$/.exec(text);
    if (!units || (!units[1] && !units[2] && !units[3])) return null;
    seconds = Number((units[1] ?? '0').replace(',', '.')) * 3600 + Number((units[2] ?? '0').replace(',', '.')) * 60 + Number(units[3] ?? 0);
  }
  const rounded = Math.round(seconds);
  return rounded > 0 && rounded <= 24 * 3600 ? rounded : null;
}

function nudgeStep(durationSec: number, direction: -1 | 1, large: boolean): number {
  if (large) return 300;
  const short = durationSec < 120 || (direction < 0 && durationSec === 120);
  return short ? 15 : 60;
}

/** Arrow-key nudge: whole minutes (five with Shift), or 15 seconds below two minutes. */
export function nudgeDuration(durationSec: number, direction: -1 | 1, large = false): number {
  const step = nudgeStep(durationSec, direction, large);
  const next = direction > 0 ? Math.floor(durationSec / step) * step + step : Math.ceil(durationSec / step) * step - step;
  return Math.max(15, Math.min(24 * 3600, next));
}

/** A new step's target: cycling gets %FTP so it draws on the power profile; other sports start on the zone alone. */
export function defaultStepTarget(sport: string, zone: TempoZone, profile: PerformanceProfile | null): WorkoutTarget | null {
  return sport === 'BIKING' ? presetTarget(sport, zone, profile, 'power', 'relative', 'ftp') : null;
}

/** Changing a step's zone moves an existing target to the same system's preset for that zone. */
export function zonePatch(block: SessionEditorBlock, zone: TempoZone, sport: string, profile: PerformanceProfile | null): SessionEditorBlockPatch {
  if (!block.target) return { zone };
  const { metric, mode, reference } = block.target;
  return { zone, target: presetTarget(sport, zone, profile, metric, mode, targetOptionReference(reference)) };
}

/** After a target nudge the zone follows the target when it can be classified. */
export function targetPatch(target: WorkoutTarget, zone: TempoZone, sport: string, profile: PerformanceProfile | null): SessionEditorBlockPatch {
  return { target, zone: zoneForTarget(target, sport, profile) ?? zone };
}

export type AddStepOption = { id: string; label: string; detail: string };

export const ADD_STEP_OPTIONS: readonly AddStepOption[] = [
  { id: 'warmup', label: 'Warm-up', detail: '10m – Z2' },
  { id: 'steady', label: 'Steady', detail: '10m – Z2' },
  { id: 'intervals', label: 'Intervals', detail: '5 × (3m Z4 + 2m Z1)' },
  { id: 'recovery', label: 'Recovery', detail: '3m – Z1' },
  { id: 'cooldown', label: 'Cool-down', detail: '10m – Z1' },
];

export const INTERVAL_PRESETS: readonly AddStepOption[] = [
  { id: 'strides', label: 'Strides', detail: '8 × (30s Z5 + 1m Z1)' },
  { id: 'vo2', label: 'VO2 max', detail: '5 × (3m Z5 + 3m Z1)' },
  { id: 'threshold', label: 'Threshold', detail: '3 × (8m Z4 + 3m Z1)' },
  { id: 'tempo', label: 'Tempo', detail: '2 × (15m Z3 + 5m Z1)' },
];

type StepSpec = { kind: TempoBlockKind; zone: TempoZone; durationSec: number };
const SINGLE_STEPS: Record<string, StepSpec> = {
  warmup: { kind: 'warmup', zone: 2, durationSec: 600 },
  steady: { kind: 'work', zone: 2, durationSec: 600 },
  recovery: { kind: 'recovery', zone: 1, durationSec: 180 },
  cooldown: { kind: 'cooldown', zone: 1, durationSec: 600 },
};
const SETS: Record<string, { repeats: number; effort: StepSpec; recovery: StepSpec }> = {
  intervals: { repeats: 5, effort: { kind: 'work', zone: 4, durationSec: 180 }, recovery: { kind: 'recovery', zone: 1, durationSec: 120 } },
  strides: { repeats: 8, effort: { kind: 'work', zone: 5, durationSec: 30 }, recovery: { kind: 'recovery', zone: 1, durationSec: 60 } },
  vo2: { repeats: 5, effort: { kind: 'work', zone: 5, durationSec: 180 }, recovery: { kind: 'recovery', zone: 1, durationSec: 180 } },
  threshold: { repeats: 3, effort: { kind: 'work', zone: 4, durationSec: 480 }, recovery: { kind: 'recovery', zone: 1, durationSec: 180 } },
  tempo: { repeats: 2, effort: { kind: 'work', zone: 3, durationSec: 900 }, recovery: { kind: 'recovery', zone: 1, durationSec: 300 } },
};

function stepBlock(spec: StepSpec, sport: string, profile: PerformanceProfile | null): SessionEditorBlock {
  const target = defaultStepTarget(sport, spec.zone, profile);
  // Warm-ups and cool-downs with a power range draw as ramps on the profile.
  const ramp = target && (spec.kind === 'warmup' || spec.kind === 'cooldown') ? { ...target, low: spec.kind === 'warmup' ? 50 : 45, high: spec.kind === 'warmup' ? 70 : 60 } : target;
  return createSessionEditorBlock({ ...spec, reps: null, target: ramp, note: '' });
}

/** Blocks for an Add option. Interval sets are stored as consecutive copies. */
export function createStepBlocks(optionId: string, sport: string, profile: PerformanceProfile | null): SessionEditorBlock[] {
  const single = SINGLE_STEPS[optionId];
  if (single) return [stepBlock(single, sport, profile)];
  const set = SETS[optionId];
  if (!set) return [];
  const effort = stepBlock(set.effort, sport, profile);
  const recovery = stepBlock(set.recovery, sport, profile);
  return Array.from({ length: set.repeats }, (_, repeat) => repeat === 0 ? [effort, recovery] : [copyBlock(effort), copyBlock(recovery)]).flat();
}

const ZONE_NAMES: Record<TempoZone, string> = { 1: 'Recovery', 2: 'Endurance', 3: 'Tempo', 4: 'Threshold', 5: 'VO2 max' };

/** A step's row name: its phase, or for work the zone it trains. */
export function stepName(block: Pick<SessionEditorBlock, 'kind' | 'zone'>): string {
  if (block.kind === 'warmup') return 'Warm-up';
  if (block.kind === 'cooldown') return 'Cool-down';
  if (block.kind === 'recovery') return 'Recovery';
  if (block.kind === 'pause') return 'Pause';
  return ZONE_NAMES[block.zone];
}

/** Total time per zone, Z1 first, from the unrolled active blocks. */
export function zoneTotals(blocks: SessionEditorBlock[]): Array<{ zone: TempoZone; durationSec: number }> {
  const totals = ([1, 2, 3, 4, 5] as TempoZone[]).map((zone) => ({ zone, durationSec: 0 }));
  for (const block of blocks) {
    if (block.skipped || block.kind === 'pause') continue;
    totals[block.zone - 1].durationSec += block.durationSec * (block.reps ?? 1);
  }
  return totals;
}
