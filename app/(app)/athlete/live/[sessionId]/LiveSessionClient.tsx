'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';

import {
  dangerTextClassName,
  compactPrimaryButtonClassName,
  compactSecondaryButtonClassName,
  primaryButtonClassName,
  successTextClassName,
} from '@/components/ui';
import { Stepper } from '@/components/tempo/Stepper';
import { formatDuration } from '@/lib/format-duration';
import {
  advanceExecution,
  createExecutionState,
  getExecutionTimerRemainingMs,
  idleExecutionTimer,
  isExecutionComplete,
  parseExecutionProgress,
  parseExecutionTimer,
  pauseExecutionTimer,
  previousExecution,
  resolveExecutionTimer,
  restartExecution,
  serializeExecutionProgress,
  startExecutionTimer,
  type ExecutionState,
  type ExecutionStep,
  type ExecutionTimer,
} from '@/lib/athlete-execution';
import {
  clearExecutionProgress,
  getExecutionProgress,
  saveExecutionProgress,
  subscribeToExecutionProgress,
} from '@/lib/athlete-execution-progress-store';

export function LiveSessionClient({ sessionId, blocks, isDone }: {
  sessionId: number;
  blocks: ExecutionStep[];
  isDone: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [now, setNow] = useState<number | null>(null);
  const saved = isDone || message !== '';
  const hasBlocks = blocks.length > 0;
  const progressKey = `tempo:live-progress:v1:${sessionId}`;
  const savedProgress = useSyncExternalStore(
    (callback) => subscribeToExecutionProgress(progressKey, callback),
    () => getExecutionProgress(progressKey),
    () => null,
  );
  const state: ExecutionState = isDone ? createExecutionState(blocks.length) : parseExecutionProgress(savedProgress, blocks) ?? createExecutionState(blocks.length);
  const complete = hasBlocks && isExecutionComplete(state);
  const restoredTimer = isDone ? idleExecutionTimer : parseExecutionTimer(savedProgress, blocks, state);
  const timer = now === null ? restoredTimer : resolveExecutionTimer(restoredTimer, now);
  const currentStep = blocks[state.currentIndex];
  const timerRemainingMs = currentStep && now !== null ? getExecutionTimerRemainingMs(timer, currentStep.durationSec, now) : 0;
  const timerRunning = timer.kind === 'running' && !saved;

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => setNow(Date.now()), 0);
    if (!timerRunning) return () => window.clearTimeout(initialRefresh);
    const refresh = () => setNow(Date.now());
    const interval = window.setInterval(refresh, 1000);
    window.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
      window.removeEventListener('visibilitychange', refresh);
    };
  }, [timerRunning]);

  function updateExecutionState(nextState: ExecutionState, nextTimer: ExecutionTimer = idleExecutionTimer): void {
    if (!hasBlocks || isDone) return;
    if (nextState.currentIndex === 0 && nextState.completed.every((value) => !value) && nextTimer.kind === 'idle') {
      clearExecutionProgress(progressKey);
      return;
    }
    saveExecutionProgress(progressKey, serializeExecutionProgress(blocks, nextState, nextTimer));
  }

  function formatCountdown(milliseconds: number): string {
    const totalSeconds = Math.ceil(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor(totalSeconds / 60) % 60;
    const seconds = totalSeconds % 60;
    return hours > 0
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      : `${Math.floor(totalSeconds / 60)}:${String(seconds).padStart(2, '0')}`;
  }

  async function completeSession() {
    setPending(true);
    setError('');
    try {
      const response = await fetch(`/api/athlete/sessions/${sessionId}/completion`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDone: true }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? 'Failed to complete session.');
        return;
      }
      clearExecutionProgress(progressKey);
      setMessage('Session marked complete.');
      router.refresh();
    } catch {
      setError('Could not reach the server. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <Stepper
        items={blocks.map((block, index) => ({
          id: block.id,
          title: `${block.label} · ${formatDuration(block.durationSec)}`,
          detail: [block.targetLabel, block.note].filter(Boolean).join(' · ') || 'Stay smooth and controlled.',
          active: index === state.currentIndex && !complete && !saved,
          done: saved || state.completed[index],
        }))}
      />
      {blocks.length === 0 ? <p role="alert" className={dangerTextClassName}>No workout blocks are available for this session.</p> : null}
      {hasBlocks ? (
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            aria-label="Previous block"
            className={compactSecondaryButtonClassName}
            disabled={pending || saved || state.currentIndex === 0}
            onClick={() => updateExecutionState(previousExecution(state))}
          >
            Previous
          </button>
          {!complete ? (
            <button
              type="button"
              aria-label="Next block"
              className={compactPrimaryButtonClassName}
              disabled={pending || saved}
              onClick={() => updateExecutionState(advanceExecution(state))}
            >
              Next block
            </button>
          ) : null}
          <button
            type="button"
            aria-label="Restart workout"
            className={compactSecondaryButtonClassName}
            disabled={pending || saved || state.completed.every((value) => !value) && state.currentIndex === 0}
            onClick={() => updateExecutionState(restartExecution(state))}
          >
            Restart
          </button>
        </div>
      ) : null}
      {currentStep && !saved ? (
        <section aria-label="Step timer" className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-4">
          <div>
            <p className="text-xs font-medium text-[var(--text-muted)]">Step timer</p>
            {currentStep.durationSec <= 0 ? (
              <p className="mt-1 text-sm text-[var(--text-secondary)]">This step has no timed duration.</p>
            ) : state.completed[state.currentIndex] ? (
              <p className="mt-1 text-sm text-[var(--text-secondary)]">This step is already marked complete.</p>
            ) : timer.kind === 'elapsed' ? (
              <p role="status" className="mt-1 text-sm font-medium text-[var(--text)]">Time is up. Step not marked complete.</p>
            ) : now === null ? (
              <p aria-label="Loading timer" className="data mt-1 text-2xl font-semibold text-[var(--text)]">--:--</p>
            ) : (
              <p aria-label={`Time remaining ${formatCountdown(timerRemainingMs)}`} className="data mt-1 text-2xl font-semibold text-[var(--text)]">
                {formatCountdown(timerRemainingMs)}
                <span className="ml-2 text-xs font-normal text-[var(--text-secondary)]">
                  {timer.kind === 'running' ? 'Running' : timer.kind === 'paused' ? 'Paused' : 'Ready'}
                </span>
              </p>
            )}
          </div>
          {currentStep.durationSec > 0 && !state.completed[state.currentIndex] && timer.kind !== 'elapsed' ? (
            timer.kind === 'running' ? (
              <button type="button" className={compactSecondaryButtonClassName} disabled={pending} onClick={() => updateExecutionState(state, pauseExecutionTimer(timer, Date.now()))}>
                Pause timer
              </button>
            ) : (
              <button type="button" className={compactSecondaryButtonClassName} disabled={pending} onClick={() => updateExecutionState(state, startExecutionTimer(timer, currentStep.durationSec, Date.now()))}>
                {timer.kind === 'paused' ? 'Resume timer' : 'Start timer'}
              </button>
            )
          ) : null}
          {timer.kind === 'elapsed' && currentStep.durationSec > 0 && !state.completed[state.currentIndex] ? (
            <button type="button" className={compactSecondaryButtonClassName} disabled={pending} onClick={() => updateExecutionState(state, startExecutionTimer(idleExecutionTimer, currentStep.durationSec, Date.now()))}>
              Start again
            </button>
          ) : null}
        </section>
      ) : null}
      {complete && !saved ? (
        <p role="status" className="text-sm font-semibold text-[var(--text)]">All blocks complete. Save the outcome to finish.</p>
      ) : null}
      {complete && !saved ? (
        <button type="button" className={primaryButtonClassName} disabled={pending || saved} onClick={() => void completeSession()}>
          {pending ? 'Saving…' : 'Mark session complete'}
        </button>
      ) : null}
      {isDone ? <p role="status" className={successTextClassName}>Session saved. Review or correct the outcome in session details.</p> : null}
      <p className="text-[12px] text-[var(--text-secondary)]">Progress is saved in this browser and resumes when you return. Restart begins again at the first step.</p>
      {message && !isDone ? <p role="status" aria-live="polite" className={successTextClassName}>{message}</p> : null}
      {error ? <p role="alert" className={dangerTextClassName}>{error}</p> : null}
    </div>
  );
}
