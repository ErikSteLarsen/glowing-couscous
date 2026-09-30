import { advanceTimedExecution, isExecutionComplete, type ExecutionState } from './athlete-execution.ts';

export type LiveCheckpoint = { execution: ExecutionState; remainingSec: number; wasRunning: boolean; checkpointAt: number; notes: string };

export function parseLiveCheckpoint(payload: string, durations: number[], now = Date.now()): LiveCheckpoint | null {
  try {
    const value = JSON.parse(payload) as LiveCheckpoint;
    const state = value?.execution;
    if (!state || !Number.isInteger(state.currentIndex) || state.currentIndex < 0 || state.currentIndex >= durations.length || !Array.isArray(state.completed) || !Array.isArray(state.skipped) || state.completed.length !== durations.length || state.skipped.length !== durations.length || !state.completed.every((entry) => typeof entry === 'boolean') || !state.skipped.every((entry) => typeof entry === 'boolean') || state.completed.some((done, index) => done && state.skipped[index]) || !Number.isFinite(value.remainingSec) || value.remainingSec < 0 || value.remainingSec > durations[state.currentIndex] || typeof value.wasRunning !== 'boolean' || !Number.isFinite(value.checkpointAt) || value.checkpointAt > now + 60_000 || now - value.checkpointAt > 24 * 60 * 60 * 1000 || typeof value.notes !== 'string' || value.notes.length > 20_000) return null;
    // Execution advances in order; future blocks cannot already be handled.
    if (state.completed.some((done, index) => index > state.currentIndex && done) || state.skipped.some((done, index) => index > state.currentIndex && done)) return null;
    if (state.completed.some((done, index) => index < state.currentIndex && !done && !state.skipped[index])) return null;
    return value;
  } catch { return null; }
}

export function restoreLiveCheckpoint(value: LiveCheckpoint, durations: number[], accountForElapsed: boolean, now = Date.now()) {
  if (!accountForElapsed || !value.wasRunning || isExecutionComplete(value.execution)) return { state: value.execution, remainingSec: value.remainingSec };
  const elapsed = Math.max(0, (now - value.checkpointAt) / 1000);
  if (elapsed < value.remainingSec) return { state: value.execution, remainingSec: value.remainingSec - elapsed };
  return advanceTimedExecution(value.execution, elapsed - value.remainingSec, durations);
}
