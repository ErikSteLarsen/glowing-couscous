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
export function createExecutionSteps(blocks: SessionEditorBlock[], profile?: PerformanceProfile | null): ExecutionStep[] {
  return expandRepeatedBlocks(blocks.filter((block) => !block.skipped).map((block) => ({ ...block, repetitionCount: block.reps ?? 1 }))).map((block) => {
    const meta = getTempoZoneMeta(block.zone);
    const genericTarget = block.target ? formatWorkoutTarget(block.target) : null;
    const resolvedTarget = block.target?.mode === 'relative' ? formatResolvedWorkoutTarget(block.target, profile) : null;
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
