import type { PerformanceProfile } from './performance-profile.ts';
import {
  createSessionEditorDraftFromPersisted,
  deriveSessionEditorMetrics,
  type PersistedSessionBlock,
  type SessionEditorBlock,
} from './session-editor.ts';
import { durationBucketFor, type DurationBucket } from './workout-catalog/query.ts';
import { groupSessionStructure } from './session-structure.ts';
import { buildWorkoutProfile, levelColor, type WorkoutProfileModel } from './workout-profile.ts';
import { formatResolvedWorkoutTarget, formatWorkoutTarget } from './workout-target-resolution.ts';

export type OwnedWorkoutRecord = {
  id: number;
  sport: string;
  title: string;
  summary: string | null;
  sportMetricsJson?: string | null;
  updatedAt?: string | Date;
  blocks: PersistedSessionBlock[];
};

export type OwnedProfileBlock = Omit<SessionEditorBlock, 'id'> & { id: string; targetLabel: string | null; shortTarget: string | null };

/**
 * One owner for what a saved workout shows on its card and detail page, in the
 * same terms the public library uses: duration, TSS, IF, peak, time in zone and
 * a %FTP profile. IF and normalized power need every effort to have a power
 * target; otherwise they are null and the profile falls back to the zone scale.
 */
export type OwnedWorkoutSummary = {
  durationSec: number;
  tss: number;
  intensityFactor: number | null;
  npPct: number | null;
  /** Highest %FTP target (power) or zone-equivalent height. */
  maxPct: number;
  axis: 'power' | 'zone';
  zoneSec: [number, number, number, number, number];
  /** Hardest zone among efforts (warm-up, cool-down, recovery and pauses ignored unless nothing else). */
  peakZone: number | null;
  workSec: number;
  effortCount: number;
  blockCount: number;
  bucket: DurationBucket;
  profile: WorkoutProfileModel<OwnedProfileBlock>;
  /** First paragraph of the notes, for cards and the page description. */
  lead: string | null;
  /** Remaining paragraphs of the notes, for the detail page. */
  details: string[];
};

function rampPowerMean(a: number, b: number, n: number) {
  if (a === b) return a ** n;
  return (b ** (n + 1) - a ** (n + 1)) / ((n + 1) * (b - a));
}

export function splitWorkoutNotes(summary: string | null | undefined): { lead: string | null; details: string[] } {
  const paragraphs = (summary ?? '').split(/\n\s*\n/).map((paragraph) => paragraph.trim()).filter(Boolean);
  return { lead: paragraphs[0] ?? null, details: paragraphs.slice(1) };
}

export function summarizeOwnedWorkout(workout: OwnedWorkoutRecord, performanceProfile: PerformanceProfile | null = null): OwnedWorkoutSummary {
  const draft = createSessionEditorDraftFromPersisted('create', { ...workout, date: null, scheduledDate: null });
  const ftpWatts = performanceProfile?.cycling.ftpWatts ?? null;
  const metrics = deriveSessionEditorMetrics(draft, ftpWatts);
  const profile = buildWorkoutProfile(draft.blocks.map((block): OwnedProfileBlock => {
    const written = block.target ? formatWorkoutTarget(block.target, draft.sport) : null;
    const resolved = block.target ? formatResolvedWorkoutTarget(block.target, performanceProfile, draft.sport) : null;
    return { ...block, id: block.clientId, targetLabel: [written, resolved].filter(Boolean).join('\u00A0· ') || null, shortTarget: resolved ?? written };
  }), { sport: draft.sport, profile: performanceProfile, ftpWatts });

  const active = profile.steps.filter((step) => step.kind !== 'pause');
  const efforts = active.filter((step) => step.kind !== 'warmup' && step.kind !== 'cooldown' && step.kind !== 'recovery');
  const work = active.filter((step) => step.kind === 'work');
  let npPct: number | null = null;
  if (profile.axis === 'power' && profile.totalSec > 0) {
    const fourth = profile.steps.reduce((sum, step) => sum + rampPowerMean(step.startPct / 100, step.endPct / 100, 4) * step.durationSec, 0);
    npPct = Math.round(((fourth / profile.totalSec) ** 0.25) * 1000) / 10;
  }
  const zoneSec = metrics.zoneDistributionSec.map((seconds) => Math.round(seconds)) as OwnedWorkoutSummary['zoneSec'];
  const zoneSource = efforts.length ? efforts : active;

  return {
    durationSec: metrics.durationSec,
    tss: metrics.tss,
    intensityFactor: npPct === null ? null : Math.round(npPct) / 100,
    npPct,
    maxPct: profile.maxPct,
    axis: profile.axis,
    zoneSec,
    peakZone: zoneSource.length ? Math.max(...zoneSource.map((step) => step.zone)) : null,
    workSec: work.reduce((sum, step) => sum + step.durationSec, 0),
    effortCount: work.length,
    blockCount: draft.blocks.filter((block) => !block.skipped).length,
    bucket: durationBucketFor(metrics.durationSec),
    profile,
    ...splitWorkoutNotes(workout.summary),
  };
}

const KIND_LABEL: Record<string, string> = { warmup: 'Warm-up', work: 'Effort', recovery: 'Recovery', cooldown: 'Cool-down', pause: 'Pause' };

export type OwnedDetailBlock = { label: string; note: string | null; durationSec: number; target: string | null; unit: string | null; color: string };
export type OwnedDetailItem = { repeat: number | null; blocks: OwnedDetailBlock[] };

/**
 * The block list for the detail page, in the same shape as a public workout's:
 * single blocks, and repeats folded from identical consecutive blocks (or a block's
 * own repeat count). A repeat that ends without its last recovery keeps that block
 * on its own row after the repeat, so the list never adds work that isn't there.
 */
export function ownedWorkoutDetailItems(profile: WorkoutProfileModel<OwnedProfileBlock>, ftpWatts: number | null = null): OwnedDetailItem[] {
  const pct = (value: number) => ftpWatts ? String(Math.round((value / 100) * ftpWatts)) : String(Math.round(value));
  const active = profile.blocks.map((block, index) => ({ block, index })).filter(({ block }) => !block.skipped && block.durationSec > 0);
  const row = (index: number): OwnedDetailBlock => {
    const block = profile.blocks[index];
    const step = profile.steps.find((entry) => entry.blockIndex === index);
    // Power targets read like a public workout's: watts (or % FTP), with ramps as start → end.
    const power = step && profile.axis === 'power' && block.target?.metric === 'power' && block.kind !== 'pause';
    const powerTarget = power
      ? step.startPct !== step.endPct ? `${pct(step.startPct)} → ${pct(step.endPct)}`
        : block.target!.low !== block.target!.high && !(block.kind === 'warmup' || block.kind === 'cooldown')
          ? `${pct(block.target!.mode === 'absolute' && ftpWatts ? (block.target!.low / ftpWatts) * 100 : block.target!.low)}–${pct(block.target!.mode === 'absolute' && ftpWatts ? (block.target!.high / ftpWatts) * 100 : block.target!.high)}`
          : pct(step.startPct)
      : null;
    return {
      label: KIND_LABEL[block.kind] ?? 'Block',
      note: block.note?.trim() || null,
      durationSec: block.durationSec,
      target: powerTarget ?? block.shortTarget ?? (block.kind === 'pause' ? null : `Z${block.zone}`),
      unit: powerTarget ? (ftpWatts ? 'W' : '% FTP') : null,
      color: step ? levelColor((step.startLevel + step.endLevel) / 2) : 'var(--border-strong)',
    };
  };
  const groups = groupSessionStructure(active.map(({ block, index }) => ({
    id: index, kind: block.kind, zone: block.zone, durationSec: block.durationSec, reps: block.reps,
    targetLabel: block.target ? JSON.stringify(block.target) : null, note: block.note ?? null, skipped: false,
  })));
  const items: OwnedDetailItem[] = [];
  for (const group of groups) {
    if (group.repeats > 1) {
      const width = group.pattern.length;
      const full = Math.floor(group.blocks.length / width);
      items.push({ repeat: full, blocks: group.pattern.map((block) => row(block.id)) });
      for (const rest of group.blocks.slice(full * width)) items.push({ repeat: null, blocks: [row(rest.id)] });
      continue;
    }
    for (const block of group.blocks) {
      items.push({ repeat: block.reps && block.reps > 1 ? block.reps : null, blocks: [row(block.id)] });
    }
  }
  return items;
}
