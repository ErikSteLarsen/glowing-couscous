export type ExecutionState = {
  currentIndex: number;
  completed: boolean[];
  skipped: boolean[];
};

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
