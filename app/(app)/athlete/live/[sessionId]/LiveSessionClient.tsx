'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, Ellipsis, RotateCcw } from 'lucide-react';

import {
  dangerTextClassName,
  buttonFocusClassName,
  iconButtonClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  sectionHeadingClassName,
  successTextClassName,
} from '@/components/ui';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/tempo/Menu';
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
  executionProgressKey,
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
  const progressKey = executionProgressKey(sessionId);
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
  const currentIndex = state.currentIndex;
  const canRestart = currentIndex > 0 || state.completed.some(Boolean) || restoredTimer.kind !== 'idle';
  const stepCompleted = state.completed[currentIndex];
  const totalDuration = blocks.reduce((total, step) => total + step.durationSec, 0);

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
      {!hasBlocks ? <p role="alert" className={dangerTextClassName}>No workout blocks are available for this session.</p> : null}
      {currentStep && !saved ? (
        <section aria-labelledby="live-current-step" className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0" aria-live="polite">
              <h2 id="live-current-step" className={sectionHeadingClassName}>{complete ? 'All blocks complete' : currentStep.label}</h2>
              {complete ? (
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Save the outcome to finish.</p>
              ) : (
                <>
                  <p className="data mt-1 text-sm text-[var(--text-secondary)]">Step {currentIndex + 1} of {blocks.length}</p>
                  {currentStep.targetLabel ? <p className="data mt-2 text-sm font-medium text-[var(--text)]">{currentStep.targetLabel}</p> : null}
                  {currentStep.note ? <p className="mt-1 max-w-prose text-sm text-[var(--text-secondary)]">{currentStep.note}</p> : null}
                </>
              )}
            </div>
            <Menu>
              <MenuTrigger aria-label="More workout options" className={`${iconButtonClassName} shrink-0 max-md:size-11`} disabled={pending}>
                <Ellipsis aria-hidden="true" size={18} strokeWidth={1.8} />
              </MenuTrigger>
              <MenuContent align="end">
                <MenuItem value="restart" disabled={!canRestart} onSelect={() => updateExecutionState(restartExecution(state))}>
                  <RotateCcw aria-hidden="true" size={16} strokeWidth={1.8} />
                  Restart workout
                </MenuItem>
              </MenuContent>
            </Menu>
          </div>
          {!complete ? (
            <div role="group" aria-label="Step timer" className="flex flex-wrap items-end gap-x-4 gap-y-2">
              <div>
                <p className="text-xs font-medium text-[var(--text-muted)]">Step timer</p>
                {currentStep.durationSec <= 0 ? (
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">This step has no timed duration.</p>
                ) : stepCompleted ? (
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">This step is already marked complete.</p>
                ) : timer.kind === 'elapsed' ? (
                  <p role="status" className="mt-1 text-sm font-medium text-[var(--text)]">Time is up. Step not marked complete.</p>
                ) : now === null ? (
                  <p aria-label="Loading timer" className="data mt-1 text-3xl font-medium text-[var(--text)]">--:--</p>
                ) : (
                  <p aria-label={`Time remaining ${formatCountdown(timerRemainingMs)}`} className="data mt-1 text-3xl font-medium text-[var(--text)]">
                    {formatCountdown(timerRemainingMs)}
                    <span className="ml-2 text-xs font-normal text-[var(--text-secondary)]">
                      {timer.kind === 'running' ? 'Running' : timer.kind === 'paused' ? 'Paused' : 'Ready'}
                    </span>
                  </p>
                )}
              </div>
              {now !== null && currentStep.durationSec > 0 && !stepCompleted ? (
                timerRunning ? (
                  <button type="button" className={`${secondaryButtonClassName} min-h-11`} disabled={pending} onClick={() => updateExecutionState(state, pauseExecutionTimer(timer, Date.now()))}>
                    Pause timer
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`${secondaryButtonClassName} min-h-11`}
                    disabled={pending}
                    onClick={() => updateExecutionState(state, startExecutionTimer(timer.kind === 'elapsed' ? idleExecutionTimer : timer, currentStep.durationSec, Date.now()))}
                  >
                    {timer.kind === 'elapsed' ? 'Start again' : timer.kind === 'paused' ? 'Resume timer' : 'Start timer'}
                  </button>
                )
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              aria-label="Previous block"
              className={`${secondaryButtonClassName} min-h-11`}
              disabled={pending || saved || currentIndex === 0}
              onClick={() => updateExecutionState(previousExecution(state))}
            >
              Previous
            </button>
            {complete ? (
              <button type="button" className={`${primaryButtonClassName} min-h-11`} disabled={pending || saved} onClick={() => void completeSession()}>
                {pending ? 'Saving…' : 'Mark session complete'}
              </button>
            ) : (
              <button
                type="button"
                className={`${primaryButtonClassName} min-h-11`}
                disabled={pending || saved}
                onClick={() => updateExecutionState(advanceExecution(state))}
              >
                Next block
              </button>
            )}
          </div>
        </section>
      ) : null}
      {isDone ? <p role="status" className={successTextClassName}>Session saved. Review or correct the outcome in session details.</p> : null}
      {message && !isDone ? <p role="status" className={successTextClassName}>{message}</p> : null}
      {error ? <p role="alert" className={dangerTextClassName}>{error}</p> : null}
      {hasBlocks ? (
        <details className="group border-t border-[var(--border)]">
          <summary className={`flex min-h-11 list-none items-center gap-2 rounded-lg py-2 hover:bg-[var(--raised)] text-sm text-[var(--text)] ${buttonFocusClassName}`}>
            <ChevronDown aria-hidden="true" size={16} className="shrink-0 group-open:rotate-180" />
            <span className="font-medium">Workout steps</span>
            <span className="data ml-auto text-right text-[var(--text-secondary)]">{formatDuration(totalDuration)}</span>
          </summary>
          <div className="pt-2">
            <Stepper
              items={blocks.map((block, index) => ({
                id: block.id,
                title: `${block.label} · ${formatDuration(block.durationSec)}`,
                detail: [block.targetLabel, block.note].filter(Boolean).join(' · '),
                active: index === currentIndex && !complete && !saved,
                done: saved || state.completed[index],
              }))}
            />
          </div>
        </details>
      ) : null}
    </div>
  );
}
