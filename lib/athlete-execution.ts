import type { SessionEditorBlock } from './session-editor.ts';
import type { PerformanceProfile } from './performance-profile.ts';
import { getTempoZoneMeta } from './tempo-blocks.ts';
import { expandRepeatedBlocks } from './workout-blocks.ts';
import { formatResolvedWorkoutTarget, formatWorkoutTarget } from './workout-target-resolution.ts';

export type ExecutionStep = {
  id: string;
  label: string;
  durationSec: number;
  targetLabel: string | null;
  /** The target as written (e.g. "75% FTP"), without any profile-resolved value. */
  prescribedTarget: string | null;
  note: string;
};

export function hasExecutionSteps(blocks: ReadonlyArray<{ skipped?: boolean }>): boolean {
  return blocks.some((block) => !block.skipped);
}

/** The same ordered repetitions as the workout timeline, omitting skipped work. */
export function createExecutionSteps(blocks: SessionEditorBlock[], sport: string, profile?: PerformanceProfile | null): ExecutionStep[] {
  return expandRepeatedBlocks(blocks.filter((block) => !block.skipped).map((block) => ({ ...block, repetitionCount: block.reps ?? 1 }))).map((block) => {
    const meta = getTempoZoneMeta(block.zone);
    const genericTarget = block.target ? formatWorkoutTarget(block.target) : null;
    const resolvedTarget = block.target?.mode === 'relative' ? formatResolvedWorkoutTarget(block.target, profile, sport) : null;
    return {
      id: `${block.clientId}:${block.occurrence}`,
      label: `${block.kind === 'warmup' ? 'Warm-up' : block.kind === 'cooldown' ? 'Cool-down' : `${meta.label} ${meta.name}`}${block.repetitionCount > 1 ? ` · Rep ${block.occurrence + 1} of ${block.repetitionCount}` : ''}`,
      durationSec: block.durationSec,
      targetLabel: resolvedTarget ? `${genericTarget} · ${resolvedTarget}` : genericTarget,
      prescribedTarget: genericTarget,
      note: block.note,
    };
  });
}

export type ExecutionState = {
  currentIndex: number;
  completed: boolean[];
  skipped: boolean[];
};

type SavedExecutionProgress = {
  version: 2;
  steps: string;
  state: ExecutionState;
  timer: ExecutionTimer;
};

export type ExecutionTimer =
  | { kind: 'idle' }
  | { kind: 'running'; endsAt: number; durationSec: number }
  | { kind: 'paused'; remainingMs: number; durationSec: number }
  | { kind: 'elapsed'; durationSec: number };

export const idleExecutionTimer: ExecutionTimer = { kind: 'idle' };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function executionStepsSignature(steps: ExecutionStep[]): string {
  return JSON.stringify(steps.map(({ id, durationSec }) => [id, durationSec]));
}

/** Serialize only resumable guidance state; it never represents saved completion. */
export function serializeExecutionProgress(steps: ExecutionStep[], state: ExecutionState, timer: ExecutionTimer = idleExecutionTimer): string {
  const progress: SavedExecutionProgress = { version: 2, steps: executionStepsSignature(steps), state, timer };
  return JSON.stringify(progress);
}

/** Restore progress only when it is valid for the exact current executable workout. */
export function parseExecutionProgress(serialized: string | null, steps: ExecutionStep[]): ExecutionState | null {
  if (!serialized || steps.length === 0) return null;

  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    return null;
  }

  if (!isRecord(value) || (value.version !== 1 && value.version !== 2) || value.steps !== executionStepsSignature(steps) || !isRecord(value.state)) {
    return null;
  }

  const { currentIndex, completed } = value.state;
  // Version 1 saves predate skipped-step state, so they resume with nothing skipped.
  const skipped: unknown = value.state.skipped ?? steps.map(() => false);
  if (
    typeof currentIndex !== 'number' ||
    !Number.isInteger(currentIndex) ||
    currentIndex < 0 ||
    currentIndex >= steps.length ||
    !Array.isArray(completed) ||
    completed.length !== steps.length ||
    !completed.every((item: unknown) => typeof item === 'boolean') ||
    !Array.isArray(skipped) ||
    skipped.length !== steps.length ||
    !skipped.every((item: unknown) => typeof item === 'boolean')
  ) {
    return null;
  }

  return { currentIndex, completed, skipped };
}

/** Restores a timer only when its active step and prescribed duration still match. */
export function parseExecutionTimer(serialized: string | null, steps: ExecutionStep[], state: ExecutionState): ExecutionTimer {
  if (!serialized || steps.length === 0 || state.currentIndex >= steps.length || state.completed[state.currentIndex]) return idleExecutionTimer;
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    return idleExecutionTimer;
  }
  if (!isRecord(value) || value.version !== 2 || value.steps !== executionStepsSignature(steps) || !isRecord(value.timer)) return idleExecutionTimer;

  const timer = value.timer;
  const durationSec = steps[state.currentIndex].durationSec;
  if (!Number.isInteger(durationSec) || durationSec <= 0 || timer.durationSec !== durationSec) return idleExecutionTimer;
  if (timer.kind === 'idle') return idleExecutionTimer;
  if (timer.kind === 'running' && typeof timer.endsAt === 'number' && Number.isFinite(timer.endsAt)) {
    return { kind: 'running', endsAt: timer.endsAt, durationSec };
  }
  if (timer.kind === 'paused' && typeof timer.remainingMs === 'number' && Number.isFinite(timer.remainingMs) && timer.remainingMs >= 0 && timer.remainingMs <= durationSec * 1000) {
    return { kind: 'paused', remainingMs: timer.remainingMs, durationSec };
  }
  if (timer.kind === 'elapsed') return { kind: 'elapsed', durationSec };
  return idleExecutionTimer;
}

export function startExecutionTimer(timer: ExecutionTimer, durationSec: number, now: number): ExecutionTimer {
  if (!Number.isInteger(durationSec) || durationSec <= 0 || !Number.isFinite(now)) return idleExecutionTimer;
  if (timer.kind === 'running' && timer.durationSec === durationSec) return timer;
  const remainingMs = timer.kind === 'paused' && timer.durationSec === durationSec
    ? timer.remainingMs
    : durationSec * 1000;
  if (remainingMs <= 0) return { kind: 'elapsed', durationSec };
  return { kind: 'running', endsAt: now + remainingMs, durationSec };
}

export function pauseExecutionTimer(timer: ExecutionTimer, now: number): ExecutionTimer {
  if (timer.kind !== 'running' || !Number.isFinite(now)) return timer;
  const remainingMs = Math.max(0, timer.endsAt - now);
  return remainingMs === 0
    ? { kind: 'elapsed', durationSec: timer.durationSec }
    : { kind: 'paused', remainingMs, durationSec: timer.durationSec };
}

export function resolveExecutionTimer(timer: ExecutionTimer, now: number): ExecutionTimer {
  if (timer.kind === 'running' && timer.endsAt <= now) return { kind: 'elapsed', durationSec: timer.durationSec };
  return timer;
}

export function getExecutionTimerRemainingMs(timer: ExecutionTimer, durationSec: number, now: number): number {
  if (timer.kind === 'running') return Math.max(0, timer.endsAt - now);
  if (timer.kind === 'paused') return timer.remainingMs;
  return timer.kind === 'elapsed' ? 0 : Math.max(0, durationSec) * 1000;
}

export function createExecutionState(blockCount: number): ExecutionState {
  const count = Math.max(0, Math.floor(blockCount));
  return {
    currentIndex: 0,
    completed: Array.from({ length: count }, () => false),
    skipped: Array.from({ length: count }, () => false),
  };
}

export function advanceExecution(state: ExecutionState): ExecutionState {
  if (state.completed.length === 0) return state;
  const completed = state.completed.map((value, index) => index === state.currentIndex ? true : value);
  const skipped = state.skipped.map((value, index) => index === state.currentIndex ? false : value);
  return {
    currentIndex: Math.min(state.currentIndex + 1, completed.length - 1),
    completed,
    skipped,
  };
}

export function previousExecution(state: ExecutionState): ExecutionState {
  const currentIndex = Math.max(0, state.currentIndex - 1);
  return {
    currentIndex,
    completed: state.completed.map((value, index) => index < currentIndex ? value : false),
    skipped: state.skipped.map((value, index) => index < currentIndex ? value : false),
  };
}

export function restartExecution(state: ExecutionState): ExecutionState {
  return createExecutionState(state.completed.length);
}

export function completeCurrentExecution(state: ExecutionState): ExecutionState {
  if (state.completed.length === 0) return state;
  return {
    ...state,
    completed: state.completed.map((value, index) => index === state.currentIndex ? true : value),
    skipped: state.skipped.map((value, index) => index === state.currentIndex ? false : value),
  };
}

export function skipCurrentExecution(state: ExecutionState): ExecutionState {
  if (state.skipped.length === 0) return state;
  return {
    ...state,
    currentIndex: Math.min(state.currentIndex + 1, state.skipped.length - 1),
    completed: state.completed.map((value, index) => index === state.currentIndex ? false : value),
    skipped: state.skipped.map((value, index) => index === state.currentIndex ? true : value),
  };
}

export function isExecutionComplete(state: ExecutionState): boolean {
  return state.completed.every((done, index) => done || state.skipped[index]);
}

export function blockExecutionDurationSec(block: { durationSec: number; reps?: number | null }): number {
  const durationSec = Number.isFinite(block.durationSec) ? Math.max(0, block.durationSec) : 0;
  const reps = Number.isInteger(block.reps) && (block.reps ?? 0) > 0 ? block.reps! : 1;
  return durationSec * reps;
}

export function remainingExecutionSeconds(
  state: ExecutionState,
  currentBlockRemainingSec: number,
  blockDurationsSec: number[],
): number {
  if (isExecutionComplete(state)) return 0;
  const currentIsHandled = state.completed[state.currentIndex] || state.skipped[state.currentIndex];
  const current = currentIsHandled ? 0 : Math.max(0, currentBlockRemainingSec);
  const upcoming = blockDurationsSec.reduce((remaining, duration, index) => {
    if (index <= state.currentIndex || state.completed[index] || state.skipped[index]) return remaining;
    return remaining + Math.max(0, duration);
  }, 0);
  return current + upcoming;
}

export function advanceTimedExecution(
  state: ExecutionState,
  elapsedPastDeadlineSec: number,
  blockDurationsSec: number[],
): { state: ExecutionState; remainingSec: number } {
  let nextState = advanceExecution(state);
  let elapsed = Math.max(0, elapsedPastDeadlineSec);

  while (!isExecutionComplete(nextState)) {
    const nextDuration = Math.max(1, blockDurationsSec[nextState.currentIndex] ?? 1);
    if (elapsed < nextDuration) {
      return { state: nextState, remainingSec: nextDuration - elapsed };
    }
    elapsed -= nextDuration;
    nextState = advanceExecution(nextState);
  }

  return { state: nextState, remainingSec: 0 };
}
