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
