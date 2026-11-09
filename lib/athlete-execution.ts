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
  note: string;
};

/** The same ordered repetitions as the workout timeline, omitting skipped work. */
export function createExecutionSteps(blocks: SessionEditorBlock[], sport: string, profile?: PerformanceProfile | null): ExecutionStep[] {
  return expandRepeatedBlocks(blocks.filter((block) => !block.skipped).map((block) => ({ ...block, repetitionCount: block.reps ?? 1 }))).map((block) => {
    const meta = getTempoZoneMeta(block.zone);
    const genericTarget = block.target ? formatWorkoutTarget(block.target) : null;
    const resolvedTarget = block.target?.mode === 'relative' ? formatResolvedWorkoutTarget(block.target, profile, sport) : null;
    return {
      id: `${block.clientId}:${block.occurrence}`,
      label: `${meta.label} ${meta.name}${block.repetitionCount > 1 ? ` · Rep ${block.occurrence + 1} of ${block.repetitionCount}` : ''}`,
      durationSec: block.durationSec,
      targetLabel: resolvedTarget ? `${genericTarget} · ${resolvedTarget}` : genericTarget,
      note: block.note,
    };
  });
}

export type ExecutionState = {
  currentIndex: number;
  completed: boolean[];
};

type SavedExecutionProgress = {
  version: 1;
  steps: string;
  state: ExecutionState;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function executionStepsSignature(steps: ExecutionStep[]): string {
  return JSON.stringify(steps.map(({ id, durationSec }) => [id, durationSec]));
}

/** Serialize only resumable guidance state; it never represents saved completion. */
export function serializeExecutionProgress(steps: ExecutionStep[], state: ExecutionState): string {
  const progress: SavedExecutionProgress = { version: 1, steps: executionStepsSignature(steps), state };
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

  if (!isRecord(value) || value.version !== 1 || value.steps !== executionStepsSignature(steps) || !isRecord(value.state)) {
    return null;
  }

  const { currentIndex, completed } = value.state;
  if (
    typeof currentIndex !== 'number' ||
    !Number.isInteger(currentIndex) ||
    currentIndex < 0 ||
    currentIndex >= steps.length ||
    !Array.isArray(completed) ||
    completed.length !== steps.length ||
    !completed.every((item: unknown) => typeof item === 'boolean')
  ) {
    return null;
  }

  return { currentIndex, completed };
}

export function createExecutionState(blockCount: number): ExecutionState {
  const count = Math.max(0, Math.floor(blockCount));
  return { currentIndex: 0, completed: Array.from({ length: count }, () => false) };
}

export function advanceExecution(state: ExecutionState): ExecutionState {
  if (state.completed.length === 0) return state;
  const completed = state.completed.map((value, index) => index === state.currentIndex ? true : value);
  return {
    currentIndex: Math.min(state.currentIndex + 1, completed.length - 1),
    completed,
  };
}

export function previousExecution(state: ExecutionState): ExecutionState {
  return { ...state, currentIndex: Math.max(0, state.currentIndex - 1) };
}

export function restartExecution(state: ExecutionState): ExecutionState {
  return createExecutionState(state.completed.length);
}

export function completeCurrentExecution(state: ExecutionState): ExecutionState {
  if (state.completed.length === 0) return state;
  return {
    ...state,
    completed: state.completed.map((value, index) => index === state.currentIndex ? true : value),
  };
}

export function isExecutionComplete(state: ExecutionState): boolean {
  return state.completed.every(Boolean);
}
