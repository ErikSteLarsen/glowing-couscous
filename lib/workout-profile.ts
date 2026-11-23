import { formatDurationExact } from './format-duration.ts';
import { intensityColor } from './intensity-color.ts';
import { powerTargetEndpoints } from './planned-power-load.ts';
import type { PerformanceProfile } from './performance-profile.ts';
import { groupSessionStructure, structureBlockLabel, type StructureBlock } from './session-structure.ts';
import type { TempoBlockKind, TempoZone } from './tempo-blocks.ts';
import { zoneForPct } from './workout-catalog/metrics.ts';
import { chartIntensityFraction, ZONE_BANDS } from './workout-zone-intensity.ts';
import type { WorkoutTarget } from './workout-targets.ts';

/** One workout block as written. `reps` repeats only this block; sets of several blocks are consecutive copies. */
export type WorkoutProfileBlock = {
  id: number | string;
  kind: string;
  zone: number;
  durationSec: number;
  reps: number | null;
  target: WorkoutTarget | null;
  skipped?: boolean;
  /** Display-only: the target as the athlete should read it, e.g. "95% FTP · 238 W". */
  targetLabel?: string | null;
  targetBasis?: string | null;
  note?: string | null;
};

/** One ridden step after `reps` and repeated sets are unrolled, positioned in time. */
export type WorkoutProfileStep = {
  key: string;
  /** Index into `WorkoutProfileModel.blocks`. */
  blockIndex: number;
  kind: TempoBlockKind;
  zone: TempoZone;
  startSec: number;
  durationSec: number;
  /** Height in % of FTP, or the zone's %FTP-equivalent when the target is not power. */
  startPct: number;
  endPct: number;
  /** Position on the shared zone ramp, 0–5 (zone − 1 + place inside the zone); drives color, and height on a zone axis. */
  startLevel: number;
  endLevel: number;
  /** "18m zone 4" for this single step. */
  label: string;
  repetition: { index: number; of: number } | null;
};

/** A repeated span drawn with a bracket over every repetition. */
export type WorkoutProfileSet = {
  startSec: number;
  durationSec: number;
  repeats: number;
  /** Longest first: "2 × 18m zone 4 + 3m recovery", "2 × 21m", "2×". */
  labels: string[];
};

/** A labelled stretch of the workout under the profile: Warm-up, Repeat, Endurance, Cool-down. */
export type WorkoutProfilePhase = {
  startSec: number;
  durationSec: number;
  title: string;
  /** "10m · Z1–Z2". */
  detail: string;
  firstStep: number;
};

export type WorkoutProfileModel<B extends WorkoutProfileBlock = WorkoutProfileBlock> = {
  blocks: B[];
  steps: WorkoutProfileStep[];
  sets: WorkoutProfileSet[];
  phases: WorkoutProfilePhase[];
  totalSec: number;
  /** `power` when every active step has a %FTP height; otherwise heights are zone equivalents. */
  axis: 'power' | 'zone';
  maxPct: number;
  /** Blocks marked skipped are kept in `blocks` for inspection but take no time in the profile. */
  skippedCount: number;
};

const ZONE_NAMES: Record<TempoZone, string> = { 1: 'Easy', 2: 'Endurance', 3: 'Tempo', 4: 'Threshold', 5: 'VO2 max' };
const PAUSE_PCT = 22;
/** Pauses sit below Z1 on the zone scale. */
const PAUSE_LEVEL = -0.4;

function toKind(kind: string): TempoBlockKind {
  return kind === 'warmup' || kind === 'recovery' || kind === 'cooldown' || kind === 'pause' ? kind : 'work';
}

function toZone(zone: number): TempoZone {
  return Math.min(5, Math.max(1, Math.round(zone))) as TempoZone;
}

/** Continuous zone position for a %FTP value: 0.5 is the middle of Z1, 4.5 the middle of Z5. */
export function levelForPct(pct: number): number {
  const zone = zoneForPct(pct);
  const band = ZONE_BANDS.power[zone];
  return zone - 1 + Math.min(1, Math.max(0, (pct - band.low) / (band.high - band.low)));
}

/** Fill for a zone level: the shared five-zone ramp. */
export function levelColor(level: number): string {
  const zone = Math.min(5, Math.floor(level) + 1);
  return intensityColor(zone, level - (zone - 1));
}

/** Fill for a %FTP height: the shared five-zone ramp, positioned inside the zone's band. */
export function pctColor(pct: number): string {
  const zone = zoneForPct(pct);
  const band = ZONE_BANDS.power[zone];
  return intensityColor(zone, (pct - band.low) / (band.high - band.low));
}

function powerPct(target: WorkoutTarget | null, ftpWatts: number | null | undefined): { low: number; high: number } | null {
  if (!target || target.metric !== 'power') return null;
  if (target.mode === 'relative' && (target.reference === 'ftp' || target.reference === null)) return { low: target.low, high: target.high };
  if (target.mode === 'absolute' && ftpWatts) return { low: (target.low / ftpWatts) * 100, high: (target.high / ftpWatts) * 100 };
  return null;
}

function stepEndpoints(block: WorkoutProfileBlock, kind: TempoBlockKind, zone: TempoZone, sport: string, profile: PerformanceProfile | null, ftpWatts: number | null | undefined) {
  if (kind === 'pause') return { startPct: PAUSE_PCT, endPct: PAUSE_PCT, startLevel: PAUSE_LEVEL, endLevel: PAUSE_LEVEL, power: true };
  const power = powerPct(block.target, ftpWatts);
  if (power) {
    const { start, end } = powerTargetEndpoints(kind, power.low, power.high);
    return { startPct: start, endPct: end, startLevel: levelForPct(start), endLevel: levelForPct(end), power: true };
  }
  const band = ZONE_BANDS.power[zone];
  const fraction = Math.min(0.98, chartIntensityFraction(block.target, zone, sport, profile));
  const pct = band.low + fraction * (band.high - band.low);
  const level = zone - 1 + fraction;
  return { startPct: pct, endPct: pct, startLevel: level, endLevel: level, power: false };
}

function structureOf(block: WorkoutProfileBlock, index: number): StructureBlock {
  return {
    id: index,
    kind: toKind(block.kind),
    zone: toZone(block.zone),
    durationSec: block.durationSec,
    reps: block.reps,
    // Grouping compares instructions, so the raw target stands in for its label.
    targetLabel: block.target ? JSON.stringify(block.target) : null,
    note: block.note ?? null,
    skipped: false,
  };
}

function zoneRange(zones: TempoZone[]): string {
  if (!zones.length) return '';
  const low = Math.min(...zones);
  const high = Math.max(...zones);
  return low === high ? `Z${low}` : `Z${low}–Z${high}`;
}

/** A set is named by its efforts; recoveries only count when the set has nothing else. */
function setZones(steps: WorkoutProfileStep[]): TempoZone[] {
  const efforts = steps.filter((step) => step.kind !== 'pause' && step.kind !== 'recovery');
  return (efforts.length ? efforts : steps.filter((step) => step.kind !== 'pause')).map((step) => step.zone);
}

function setLabels(pattern: StructureBlock[], repeats: number, recoveryBetweenOnly: boolean, durationSec: number): string[] {
  const parts = pattern.map(structureBlockLabel);
  const full = recoveryBetweenOnly && parts.length === 2
    ? `${repeats} × ${parts[0]}, ${parts[1]} between`
    : `${repeats} × ${parts.join(' + ')}`;
  const patternSec = Math.round(durationSec / repeats);
  return [full, `${repeats} × ${formatDurationExact(patternSec)}`, `${repeats}×`];
}

/**
 * Unroll a workout into a gap-free profile: every repetition is drawn in time, repeated
 * spans become brackets, and consecutive blocks become labelled phases.
 */
export function buildWorkoutProfile<B extends WorkoutProfileBlock>(
  blocks: B[],
  { sport = 'BIKING', profile = null, ftpWatts = null }: { sport?: string; profile?: PerformanceProfile | null; ftpWatts?: number | null } = {},
): WorkoutProfileModel<B> {
  const active = blocks.map((block, index) => ({ block, index })).filter(({ block }) => !block.skipped && block.durationSec > 0);
  const groups = groupSessionStructure(active.map(({ block, index }) => structureOf(block, index)));
  const steps: WorkoutProfileStep[] = [];
  const sets: WorkoutProfileSet[] = [];
  type RawPhase = { title: string; set: boolean; startSec: number; durationSec: number; zones: TempoZone[]; firstStep: number };
  const rawPhases: RawPhase[] = [];
  let clock = 0;
  let allPower = true;

  for (const group of groups) {
    const groupStart = clock;
    const firstStep = steps.length;
    const width = group.pattern.length;
    const singleReps = group.repeats === 1 && group.blocks.length === 1 ? group.blocks[0].reps ?? 1 : 1;
    group.blocks.forEach((structure, position) => {
      const blockIndex = Number(structure.id);
      const block = blocks[blockIndex];
      const kind = toKind(block.kind);
      const zone = toZone(block.zone);
      const occurrences = Math.max(1, block.reps ?? 1);
      const endpoints = stepEndpoints(block, kind, zone, sport, profile, ftpWatts);
      if (kind !== 'pause' && !endpoints.power) allPower = false;
      const label = structureBlockLabel({ ...structure, reps: null });
      for (let occurrence = 0; occurrence < occurrences; occurrence += 1) {
        const repetition = group.repeats > 1
          ? { index: Math.floor(position / width) + 1, of: group.repeats }
          : occurrences > 1 ? { index: occurrence + 1, of: occurrences } : null;
        steps.push({
          key: `${blockIndex}-${occurrence}`,
          blockIndex,
          kind,
          zone,
          startSec: clock,
          durationSec: block.durationSec,
          startPct: endpoints.startPct,
          endPct: endpoints.endPct,
          startLevel: endpoints.startLevel,
          endLevel: endpoints.endLevel,
          label,
          repetition,
        });
        clock += block.durationSec;
      }
    });

    const repeats = group.repeats > 1 ? group.repeats : singleReps;
    const groupSec = clock - groupStart;
    if (repeats > 1) {
      const pattern = group.repeats > 1 ? group.pattern : [{ ...group.blocks[0], reps: null }];
      const betweenOnly = group.recoveryCount > 0 && group.recoveryCount < group.repeats;
      sets.push({ startSec: groupStart, durationSec: groupSec, repeats, labels: setLabels(pattern, repeats, betweenOnly, groupSec) });
      rawPhases.push({ title: 'Repeat', set: true, startSec: groupStart, durationSec: groupSec, zones: setZones(steps.slice(firstStep)), firstStep });
      continue;
    }
    steps.slice(firstStep).forEach((step, offset) => {
      const title = step.kind === 'warmup' ? 'Warm-up' : step.kind === 'cooldown' ? 'Cool-down' : step.kind === 'pause' ? 'Pause' : step.kind === 'recovery' ? 'Recovery' : ZONE_NAMES[step.zone];
      const previous = rawPhases.at(-1);
      if (previous && !previous.set && previous.title === title && previous.startSec + previous.durationSec === step.startSec) {
        previous.durationSec += step.durationSec;
        if (step.kind !== 'pause') previous.zones.push(step.zone);
        return;
      }
      rawPhases.push({ title, set: false, startSec: step.startSec, durationSec: step.durationSec, zones: step.kind === 'pause' ? [] : [step.zone], firstStep: firstStep + offset });
    });
  }

  const setPhases = rawPhases.filter((phase) => phase.set);
  const phases = rawPhases.map((phase): WorkoutProfilePhase => ({
    startSec: phase.startSec,
    durationSec: phase.durationSec,
    title: phase.set && setPhases.length > 1 ? `Repeat ${setPhases.indexOf(phase) + 1}` : phase.title,
    detail: [formatDurationExact(phase.durationSec), zoneRange(phase.zones)].filter(Boolean).join(' · '),
    firstStep: phase.firstStep,
  }));

  const activeSteps = steps.filter((step) => step.kind !== 'pause');
  return {
    blocks,
    steps,
    sets,
    phases,
    totalSec: clock,
    axis: allPower && activeSteps.length > 0 ? 'power' : 'zone',
    maxPct: Math.max(0, ...steps.map((step) => Math.max(step.startPct, step.endPct))),
    skippedCount: blocks.length - active.length,
  };
}

/** Accessible name for a step: "Rep 2 of 3, 18m zone 4, 95% FTP". */
export function describeProfileStep(model: WorkoutProfileModel, step: WorkoutProfileStep): string {
  const block = model.blocks[step.blockIndex];
  return [
    step.repetition ? `Rep ${step.repetition.index} of ${step.repetition.of}` : null,
    step.label,
    block.targetLabel ?? null,
  ].filter(Boolean).join(', ');
}

/** One sentence for screen readers that lists the workout in time order. */
export function describeWorkoutProfile(model: WorkoutProfileModel): string {
  if (!model.steps.length) return 'No timed blocks.';
  const parts: string[] = [];
  let setIndex = 0;
  for (const phase of model.phases) {
    const set = model.sets[setIndex];
    if (set && set.startSec === phase.startSec) {
      parts.push(set.labels[0]);
      setIndex += 1;
    } else {
      parts.push(`${phase.title} ${phase.detail}`);
    }
  }
  return `${formatDurationExact(model.totalSec)}: ${parts.join('; ')}.`;
}

/**
 * Pick, for each time span, the longest label option whose widest line fits the span's
 * width in pixels; -1 means no text fits and the span keeps only its tick and tooltip.
 * Options are ordered longest first; each option is one or more lines.
 */
export function fitSpanLabels(
  spans: Array<{ startSec: number; durationSec: number; options: string[][] }>,
  totalSec: number,
  widthPx: number,
  { charPx = 6.6, paddingPx = 8 }: { charPx?: number; paddingPx?: number } = {},
): number[] {
  return spans.map((span) => {
    const available = (span.durationSec / Math.max(1, totalSec)) * widthPx - paddingPx;
    return span.options.findIndex((lines) => Math.max(...lines.map((line) => line.length)) * charPx <= available);
  });
}

/** Time-axis ticks at a round interval, at most seven, never crowding the end label. */
export function profileTimeTicks(totalSec: number): number[] {
  const steps = [300, 600, 900, 1200, 1800, 3600];
  const interval = steps.find((candidate) => totalSec / candidate <= 7) ?? 3600;
  const ticks: number[] = [];
  for (let tick = interval; tick < totalSec - interval * 0.9; tick += interval) ticks.push(tick);
  return ticks;
}
