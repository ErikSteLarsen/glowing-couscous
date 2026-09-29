import { createEmptySessionEditorDraft, createSessionEditorBlock, deriveSessionEditorMetrics, validateSessionEditorDraft, type SessionEditorDraft } from './session-editor.ts';
import { presetTarget } from './workout-zone-intensity.ts';
import type { PerformanceProfile } from './performance-profile.ts';
import { hasCompleteRunningPaceZones } from './profile-training-zones.ts';
import type { TempoBlockKind, TempoZone } from './tempo-blocks.ts';
import type { WorkoutTargetMetric, WorkoutTargetReference } from './workout-targets.ts';

export const GUIDED_SPORTS = ['RUNNING', 'BIKING', 'SWIMMING'] as const;
export const GUIDED_DURATIONS = [30, 45, 60, 75] as const;
export const GUIDED_INTENSITIES = ['easy', 'steady', 'hard'] as const;

export type GuidedWorkoutInput = {
  sport: (typeof GUIDED_SPORTS)[number];
  durationMinutes: (typeof GUIDED_DURATIONS)[number];
  intensity: (typeof GUIDED_INTENSITIES)[number];
  intervals: boolean;
};

export type GuidedHistory = {
  completedLast7Days: number;
  completedLast28Days: number;
  sameSportLast28Days: number;
  sameSportMedianMinutes: number | null;
  recentHighRpeDaysAgo: number | null;
  importedLast28Days: number;
};

export type GuidedCandidate = {
  id: string;
  label: string;
  rationale: string;
  draft: SessionEditorDraft;
};

export function parseGuidedWorkoutInput(value: unknown): GuidedWorkoutInput | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  if (!GUIDED_SPORTS.includes(input.sport as GuidedWorkoutInput['sport'])) return null;
  if (!GUIDED_DURATIONS.includes(input.durationMinutes as GuidedWorkoutInput['durationMinutes'])) return null;
  if (!GUIDED_INTENSITIES.includes(input.intensity as GuidedWorkoutInput['intensity'])) return null;
  if (typeof input.intervals !== 'boolean') return null;
  return input as GuidedWorkoutInput;
}

function targetForZone(sport: GuidedWorkoutInput['sport'], zone: TempoZone, profile: PerformanceProfile | null) {
  let metric: WorkoutTargetMetric = 'rpe';
  let reference: WorkoutTargetReference | null = null;
  if (sport === 'RUNNING' && hasCompleteRunningPaceZones(profile)) {
    metric = 'pace';
    reference = 'profile-pace';
  } else if (sport === 'BIKING' && profile?.cycling.ftpWatts) {
    metric = 'power';
    reference = 'ftp';
  } else if (sport === 'SWIMMING' && profile?.swimming.cssSecPer100m) {
    metric = 'pace';
    reference = 'css';
  } else if (sport !== 'SWIMMING' && profile?.heartRateMaxBpm) {
    metric = 'hr';
    reference = 'max-hr';
  }
  return presetTarget(sport, zone, profile, metric, reference ? 'relative' : 'absolute', reference);
}

function buildDraft(input: GuidedWorkoutInput, profile: PerformanceProfile | null, id: string, title: string, summary: string, blocks: Array<{ kind: TempoBlockKind; zone: TempoZone; seconds: number; note?: string }>): SessionEditorDraft {
  const draft = createEmptySessionEditorDraft({
    mode: 'create',
    sport: input.sport,
    title,
    summary,
    scheduledDate: null,
    planWeekday: null,
    source: 'athlete-library',
    blocks: blocks.filter((block) => block.seconds > 0).map((block) => createSessionEditorBlock({
      kind: block.kind,
      zone: block.zone,
      durationSec: block.seconds,
      note: block.note ?? '',
      target: targetForZone(input.sport, block.zone, profile),
    })),
  });
  const error = validateSessionEditorDraft(draft);
  if (error || deriveSessionEditorMetrics(draft).durationSec !== input.durationMinutes * 60) {
    throw new Error(`Invalid guided workout ${id}: ${error ?? 'duration mismatch'}`);
  }
  return draft;
}

function continuousBlocks(input: GuidedWorkoutInput, mainZone: TempoZone, progression: boolean) {
  const total = input.durationMinutes * 60;
  const warmup = Math.min(10, Math.round(input.durationMinutes * .2)) * 60;
  const cooldown = Math.min(10, Math.round(input.durationMinutes * .16)) * 60;
  const main = total - warmup - cooldown;
  if (mainZone === 4) {
    const strongFinish = Math.min(18, Math.max(6, Math.round(input.durationMinutes * .25))) * 60;
    return [
      { kind: 'warmup' as const, zone: 1 as const, seconds: warmup },
      { kind: 'work' as const, zone: (progression ? 2 : 3) as TempoZone, seconds: main - strongFinish },
      { kind: 'work' as const, zone: 4 as const, seconds: strongFinish, note: 'Controlled strong finish; do not chase an unsustainable target.' },
      { kind: 'cooldown' as const, zone: 1 as const, seconds: cooldown },
    ];
  }
  if (!progression) return [
    { kind: 'warmup' as const, zone: 1 as const, seconds: warmup },
    { kind: 'work' as const, zone: mainZone, seconds: main },
    { kind: 'cooldown' as const, zone: 1 as const, seconds: cooldown },
  ];
  const first = Math.round(main * .55 / 60) * 60;
  return [
    { kind: 'warmup' as const, zone: 1 as const, seconds: warmup },
    { kind: 'work' as const, zone: Math.max(1, mainZone - 1) as TempoZone, seconds: first },
    { kind: 'work' as const, zone: mainZone, seconds: main - first },
    { kind: 'cooldown' as const, zone: 1 as const, seconds: cooldown },
  ];
}

function intervalBlocks(input: GuidedWorkoutInput, workZone: TempoZone, short: boolean) {
  const total = input.durationMinutes * 60;
  const warmup = Math.min(10, Math.round(input.durationMinutes * .2)) * 60;
  const cooldown = Math.min(10, Math.round(input.durationMinutes * .16)) * 60;
  const available = total - warmup - cooldown;
  const reps = input.durationMinutes <= 30 ? 3 : input.durationMinutes <= 45 ? 4 : input.durationMinutes <= 60 ? 5 : 6;
  const work = (short ? 2 : workZone >= 4 ? 3 : 4) * 60;
  const recovery = (short ? 1 : 2) * 60;
  const intervalSeconds = reps * work + (reps - 1) * recovery;
  const easyBefore = Math.max(0, available - intervalSeconds);
  const blocks: Array<{ kind: TempoBlockKind; zone: TempoZone; seconds: number; note?: string }> = [
    { kind: 'warmup', zone: 1, seconds: warmup },
    { kind: 'work', zone: 2, seconds: easyBefore, note: 'Settle into a comfortable rhythm before the efforts.' },
  ];
  for (let index = 0; index < reps; index += 1) {
    blocks.push({ kind: 'work', zone: workZone, seconds: work, note: `Effort ${index + 1} of ${reps}. Keep the effort controlled.` });
    if (index < reps - 1) blocks.push({ kind: 'recovery', zone: 1, seconds: recovery, note: 'Move easily before the next effort.' });
  }
  blocks.push({ kind: 'cooldown', zone: 1, seconds: cooldown });
  return blocks;
}

export function createGuidedCandidates(input: GuidedWorkoutInput, profile: PerformanceProfile | null, history: GuidedHistory): GuidedCandidate[] {
  const sport = input.sport === 'RUNNING' ? 'run' : input.sport === 'BIKING' ? 'ride' : 'swim';
  const sparse = history.sameSportLast28Days < 3;
  const recentHard = history.recentHighRpeDaysAgo !== null && history.recentHighRpeDaysAgo <= 2;
  const candidates: GuidedCandidate[] = [];
  function add(id: string, label: string, rationale: string, title: string, summary: string, blocks: Array<{ kind: TempoBlockKind; zone: TempoZone; seconds: number; note?: string }>) {
    candidates.push({ id, label, rationale, draft: buildDraft(input, profile, id, title, summary, blocks) });
  }
  if (!input.intervals) {
    const zone: TempoZone = input.intensity === 'easy' ? 2 : input.intensity === 'steady' ? 3 : 4;
    add('even', input.intensity === 'hard' ? 'Controlled finish' : 'Even effort', input.intensity === 'hard' ? 'Steady preparation followed by a limited strong finish.' : 'A simple, predictable session.', `${input.durationMinutes}-minute ${input.intensity} ${sport}`, `A ${input.intensity} continuous ${sport}. Use the targets as guides and adjust for how you feel.`, continuousBlocks(input, zone, false));
    add('progressive', 'Build gently', 'Starts below the selected effort, then settles into it.', `Progressive ${input.intensity} ${sport}`, `Begin gently, then move toward a controlled ${input.intensity} effort.`, continuousBlocks(input, zone, true));
  } else {
    const zone: TempoZone = input.intensity === 'easy' ? 2 : input.intensity === 'steady' ? 3 : 4;
    add('regular', 'Longer efforts', 'More time at the chosen effort with easy movement between repetitions.', `${input.intensity} intervals · ${input.durationMinutes} min`, `Controlled ${input.intensity} intervals with active recovery. Short interval heart-rate targets can lag behind effort.`, intervalBlocks(input, zone, false));
    add('short', 'Shorter efforts', 'Short repeats make the session easier to pace and adjust.', `Short ${input.intensity} intervals · ${input.durationMinutes} min`, `Short controlled efforts with active recovery. Keep each repetition repeatable.`, intervalBlocks(input, zone, true));
  }
  if (sparse || recentHard) return candidates.slice().reverse();
  return candidates;
}

export function fallbackGuidedChoice(candidates: GuidedCandidate[], history: GuidedHistory): GuidedCandidate {
  const requestedMinutes = candidates[0] ? deriveSessionEditorMetrics(candidates[0].draft).durationSec / 60 : 0;
  const longerThanRecent = history.sameSportLast28Days >= 3 && history.sameSportMedianMinutes !== null && requestedMinutes > history.sameSportMedianMinutes * 1.25;
  const recentHard = history.recentHighRpeDaysAgo !== null && history.recentHighRpeDaysAgo <= 2;
  if (recentHard || longerThanRecent || history.completedLast7Days >= 5) return candidates.find((candidate) => candidate.id === 'short' || candidate.id === 'progressive') ?? candidates[0];
  return candidates.find((candidate) => candidate.id === 'regular' || candidate.id === 'even') ?? candidates[0];
}

export function guidedContextExplanation(history: GuidedHistory, input: GuidedWorkoutInput): string {
  if (history.completedLast28Days === 0) return 'No completed training is recorded in the last four weeks. This is a general starting draft; review the effort before saving.';
  if (history.sameSportLast28Days === 0) return `You have ${history.completedLast28Days} completed session${history.completedLast28Days === 1 ? '' : 's'} in the last four weeks, but none in this sport. Review the targets before saving.`;
  const details = [`${history.sameSportLast28Days} completed ${input.sport === 'RUNNING' ? 'runs' : input.sport === 'BIKING' ? 'rides' : 'swims'} in the last four weeks`];
  if (history.sameSportMedianMinutes !== null) details.push(`typical recorded duration ${history.sameSportMedianMinutes} minutes`);
  if (history.sameSportMedianMinutes !== null && input.durationMinutes > history.sameSportMedianMinutes * 1.25) details.push('the requested length is longer than your recent typical session');
  if (history.recentHighRpeDaysAgo !== null && history.recentHighRpeDaysAgo <= 2) details.push('a high-effort session was recorded recently');
  return `${details.join('; ')}. Training history may be incomplete, so review this draft before saving.`;
}
