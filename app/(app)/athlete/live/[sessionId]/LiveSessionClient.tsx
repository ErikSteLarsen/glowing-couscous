'use client';

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Pause, Play, SkipBack, SkipForward, Sun } from 'lucide-react';
import { ActionLink, Badge, dangerButtonClassName, dangerTextClassName, primaryButtonClassName, secondaryButtonClassName, Surface, sectionHeadingClassName } from '@/components/ui';
import { SessionPlanCanvas, type SessionPlanBlock } from '@/components/SessionPlanCanvas';
import {
  advanceExecution,
  advanceTimedExecution,
  blockExecutionDurationSec,
  createExecutionState,
  isExecutionComplete,
  previousExecution,
  remainingExecutionSeconds,
  restartExecution,
  skipCurrentExecution,
  type ExecutionState,
} from '@/lib/athlete-execution';
import { formatDurationExact } from '@/lib/format-duration';

type ScreenWakeLockSentinel = {
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
};

type ScreenWakeLockApi = {
  request: (type: 'screen') => Promise<ScreenWakeLockSentinel>;
};

const subscribeToWakeLockSupport = () => () => {};
const getWakeLockSupport = () => typeof navigator !== 'undefined' && 'wakeLock' in navigator;
const getServerWakeLockSupport = () => false;

function formatCountdown(totalSeconds: number) {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export function LiveSessionClient({
  sessionId,
  sessionHref,
  blocks,
  initialNotes,
  alreadyCompleted,
}: {
  sessionId: number;
  sessionHref: string;
  blocks: SessionPlanBlock[];
  initialNotes: string;
  alreadyCompleted: boolean;
}) {
  const router = useRouter();
  const [activeBlocks, plannedSkippedBlocks] = useMemo(() => [blocks.filter((block) => !block.skipped), blocks.filter((block) => block.skipped)], [blocks]);
  const blockDurations = useMemo(() => activeBlocks.map(blockExecutionDurationSec), [activeBlocks]);
  const totalDurationSec = useMemo(() => blockDurations.reduce((sum, duration) => sum + duration, 0), [blockDurations]);
  const [execution, setExecution] = useState<ExecutionState>(() => createExecutionState(activeBlocks.length));
  const [remainingSec, setRemainingSec] = useState(() => blockDurations[0] ?? 0);
  const [hasStarted, setHasStarted] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [keepAwake, setKeepAwake] = useState(false);
  const canKeepAwake = useSyncExternalStore(subscribeToWakeLockSupport, getWakeLockSupport, getServerWakeLockSupport);
  const [wakeLockError, setWakeLockError] = useState('');
  const deadlineRef = useRef<number | null>(null);
  const wakeLockRef = useRef<ScreenWakeLockSentinel | null>(null);

  const currentBlock = activeBlocks[execution.currentIndex] ?? null;
  const isFinished = activeBlocks.length > 0 && isExecutionComplete(execution);
  const remainingSessionSec = remainingExecutionSeconds(execution, remainingSec, blockDurations);
  const handledCount = execution.completed.filter(Boolean).length + execution.skipped.filter(Boolean).length;
  const sessionProgress = totalDurationSec > 0 ? Math.max(0, Math.min(100, (1 - remainingSessionSec / totalDurationSec) * 100)) : 0;
  const currentBlockProgress = currentBlock
    ? Math.max(0, Math.min(100, ((blockDurations[execution.currentIndex] - remainingSec) / blockDurations[execution.currentIndex]) * 100))
    : 0;
  const completedIds = activeBlocks.filter((_, index) => execution.completed[index]).map((block) => block.id);
  const skippedIds = [
    ...plannedSkippedBlocks.map((block) => block.id),
    ...activeBlocks.filter((_, index) => execution.skipped[index]).map((block) => block.id),
  ];

  useEffect(() => {
    if (!isRunning) return;

    const tick = () => {
      const deadline = deadlineRef.current;
      if (deadline === null) return;
      const now = Date.now();
      const millisecondsLeft = deadline - now;

      if (millisecondsLeft > 0) {
        setRemainingSec(Math.ceil(millisecondsLeft / 1000));
        return;
      }

      const result = advanceTimedExecution(execution, Math.max(0, (now - deadline) / 1000), blockDurations);
      setExecution(result.state);
      setRemainingSec(result.remainingSec);
      setError('');

      if (isExecutionComplete(result.state)) {
        deadlineRef.current = null;
        setIsRunning(false);
        setMessage('Final block complete. Review the session, then finish when you are ready.');
      } else {
        deadlineRef.current = now + result.remainingSec * 1000;
        const nextBlock = activeBlocks[result.state.currentIndex];
        setMessage(`Block complete. Now up: ${nextBlock.label}.`);
      }
    };

    const interval = window.setInterval(tick, 200);
    tick();
    return () => window.clearInterval(interval);
  }, [activeBlocks, blockDurations, execution, isRunning]);

  useEffect(() => {
    if (!keepAwake || !hasStarted || isFinished || !canKeepAwake) return;

    const api = (navigator as Navigator & { wakeLock?: ScreenWakeLockApi }).wakeLock;
    if (!api) return;
    let disposed = false;
    let acquired: ScreenWakeLockSentinel | null = null;

    const acquire = async () => {
      try {
        const sentinel = await api.request('screen');
        if (disposed) {
          await sentinel.release();
          return;
        }
        acquired = sentinel;
        wakeLockRef.current = sentinel;
        setWakeLockError('');
        sentinel.addEventListener('release', () => {
          if (wakeLockRef.current === sentinel) wakeLockRef.current = null;
        });
      } catch {
        setWakeLockError('This browser could not keep the screen awake.');
      }
    };

    const handleVisibility = () => {
      if (!document.hidden && !wakeLockRef.current) void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      if (wakeLockRef.current === acquired) wakeLockRef.current = null;
      if (acquired) void acquired.release();
    };
  }, [canKeepAwake, hasStarted, isFinished, keepAwake]);

  function startOrResume() {
    if (!currentBlock || isFinished || pending) return;
    deadlineRef.current = Date.now() + remainingSec * 1000;
    setHasStarted(true);
    setIsRunning(true);
    setError('');
    setMessage('Workout started.');
  }

  function togglePause() {
    if (isRunning) {
      const left = deadlineRef.current === null ? remainingSec : Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000));
      deadlineRef.current = null;
      setRemainingSec(left);
      setIsRunning(false);
      setMessage('Workout paused.');
      return;
    }
    startOrResume();
  }

  function moveToPreviousBlock() {
    if (execution.currentIndex === 0 || pending) return;
    const previous = previousExecution(execution);
    deadlineRef.current = null;
    setExecution(previous);
    setRemainingSec(blockDurations[previous.currentIndex] ?? 0);
    setIsRunning(false);
    setHasStarted(true);
    setConfirmRestart(false);
    setMessage(`Back to ${activeBlocks[previous.currentIndex].label}. The timer is paused.`);
  }

  function finishCurrentBlock(skip = false) {
    if (!currentBlock || isFinished || pending) return;
    const wasRunning = isRunning;
    const next = skip ? skipCurrentExecution(execution) : advanceExecution(execution);
    setExecution(next);
    setError('');
    setConfirmRestart(false);

    if (isExecutionComplete(next)) {
      deadlineRef.current = null;
      setRemainingSec(0);
      setIsRunning(false);
      setHasStarted(true);
      setMessage(skip
        ? 'No active blocks remain. Review the session, then finish when you are ready.'
        : 'Final block complete. Review the session, then finish when you are ready.');
      return;
    }

    const nextBlock = activeBlocks[next.currentIndex];
    const nextDuration = blockDurations[next.currentIndex] ?? 0;
    deadlineRef.current = wasRunning ? Date.now() + nextDuration * 1000 : null;
    setRemainingSec(nextDuration);
    setHasStarted(true);
    setMessage(skip ? `${currentBlock.label} skipped. Now up: ${nextBlock.label}.` : `${currentBlock.label} complete. Now up: ${nextBlock.label}.`);
  }

  function restartWorkout() {
    if (pending || saved || alreadyCompleted) return;
    deadlineRef.current = null;
    setExecution(restartExecution(execution));
    setRemainingSec(blockDurations[0] ?? 0);
    setIsRunning(false);
    setHasStarted(false);
    setConfirmRestart(false);
    setError('');
    setMessage('Workout reset. Start when you are ready.');
  }

  async function finishWorkout() {
    if (!isFinished || pending || saved) return;
    setPending(true);
    setError('');
    try {
      if (!alreadyCompleted) {
        const response = await fetch(`/api/athlete/sessions/${sessionId}/completion`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isDone: true, notes: initialNotes }),
        });
        const payload = await response.json().catch(() => ({})) as { error?: string };
        if (!response.ok) {
          setError(payload.error ?? 'The session could not be saved. Your local workout progress is still here.');
          return;
        }
      }

      setSaved(true);
      setMessage(alreadyCompleted ? 'Run complete. The saved session outcome was left unchanged.' : 'Session marked complete and saved.');
      if (!alreadyCompleted) router.refresh();
    } catch {
      setError('Could not reach the server. Your local workout progress is still here; check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="page-content--standard grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_304px]">
      <Surface className="min-w-0 space-y-4 p-4 sm:space-y-5 sm:p-5">
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-4">
          <div className="min-w-0">
            <Badge tone={isFinished ? 'success' : isRunning ? 'brand' : 'neutral'}>
              {isFinished ? 'Blocks complete' : isRunning ? 'In progress' : hasStarted ? 'Paused' : 'Ready'}
            </Badge>
            <p className="mt-2 text-[12px] text-[var(--text-secondary)]">
              {currentBlock ? `Block ${execution.currentIndex + 1} of ${activeBlocks.length}` : 'No active workout blocks'}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] font-medium text-[var(--text-muted)]">Session remaining</p>
            <p className="metric-text mt-1 text-[20px] font-semibold leading-none text-[var(--text)] sm:text-[26px]" aria-label={`${formatCountdown(remainingSessionSec)} session time remaining`}>
              {formatCountdown(remainingSessionSec)}
            </p>
          </div>
        </div>

        {currentBlock ? (
          <>
            <div className="space-y-3 sm:space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                {currentBlock.targetLabel ? <span className="text-[13px] font-semibold text-[var(--text)]">{currentBlock.targetLabel}</span> : null}
                {currentBlock.reps ? <span className="text-[12px] text-[var(--text-secondary)]">{currentBlock.reps} reps</span> : null}
              </div>

              <h2 className={`break-words ${sectionHeadingClassName}`}>
                {isFinished ? 'Workout complete' : currentBlock.kind === 'pause' ? 'Pause and reset' : currentBlock.label}
              </h2>

              <div className="border-y border-[var(--border)] py-3 sm:py-5">
                <p className="text-[11px] font-medium text-[var(--text-secondary)]">
                  {isFinished ? 'BLOCK TIMER · COMPLETE' : isRunning ? 'BLOCK TIMER · COUNTING DOWN' : hasStarted ? 'BLOCK TIMER · PAUSED' : 'BLOCK TIMER · READY'}
                </p>
                <p
                  role="timer"
                  aria-live="off"
                  aria-label={`${formatCountdown(remainingSec)} remaining in ${currentBlock.label}`}
                  className="metric-text mt-1 whitespace-nowrap text-[60px] font-semibold leading-none tracking-[-0.04em] text-[var(--text)] sm:text-[84px]"
                >
                  {formatCountdown(remainingSec)}
                </p>
                <div
                  role="progressbar"
                  aria-label="Current block progress"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(currentBlockProgress)}
                  className="mt-4 h-2 overflow-hidden bg-[var(--sunken)]"
                >
                  <div
                    className={`h-full transition-[width] duration-300 ease-out motion-reduce:transition-none ${currentBlock.kind === 'pause' ? 'bg-[var(--text-muted)]' : `ink-zone-${Math.min(Math.max(currentBlock.zone, 1), 5)}`}`}
                    style={{ width: `${currentBlockProgress}%` }}
                  />
                </div>
                <div className="mt-2 flex justify-between text-[11px] text-[var(--text-muted)]">
                  <span>{hasStarted ? formatDurationExact(Math.max(0, Math.floor(blockDurations[execution.currentIndex] - remainingSec))) : 'Not started'}</span>
                  <span>{formatDurationExact(blockDurations[execution.currentIndex])}</span>
                </div>
              </div>

              {currentBlock.note && currentBlock.note !== currentBlock.label ? (
                <p className="max-w-[68ch] text-[15px] leading-[1.55] text-[var(--text-secondary)]">{currentBlock.note}</p>
              ) : currentBlock.kind === 'pause' ? (
                <p className="text-[15px] leading-[1.55] text-[var(--text-secondary)]">Take the recovery time before moving on.</p>
              ) : currentBlock.targetLabel ? (
                <p className="text-[15px] leading-[1.55] text-[var(--text-secondary)]">Stay with the target and keep this effort controlled.</p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {!hasStarted ? (
                <button type="button" className={`${primaryButtonClassName} col-span-2 min-h-12 gap-2 py-3`} onClick={startOrResume}>
                  <Play className="h-4 w-4" aria-hidden="true" />
                  Start workout
                </button>
              ) : isFinished ? (
                <>
                  <button type="button" className={`${primaryButtonClassName} col-span-2 min-h-12 gap-2 py-3`} disabled={pending || saved} onClick={() => void finishWorkout()}>
                    <Check className="h-4 w-4" aria-hidden="true" />
                    {pending ? 'Saving session…' : saved ? 'Session complete' : alreadyCompleted ? 'Finish this run' : 'Finish workout'}
                  </button>
                  {saved ? <ActionLink href={sessionHref} tone="secondary" size="default">View session</ActionLink> : null}
                </>
              ) : (
                <>
                  <button type="button" className={`${primaryButtonClassName} min-h-12 gap-2 py-3`} disabled={pending} onClick={togglePause}>
                    {isRunning ? <Pause className="h-4 w-4" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
                    {isRunning ? 'Pause' : 'Resume'}
                  </button>
                  <button type="button" className={`${secondaryButtonClassName} min-h-12 gap-2 py-3`} disabled={pending} onClick={() => finishCurrentBlock(true)}>
                    <SkipForward className="h-4 w-4" aria-hidden="true" />
                    Skip block
                  </button>
                  <button type="button" className={`${secondaryButtonClassName} min-h-12 gap-2 py-3`} disabled={pending || execution.currentIndex === 0} onClick={moveToPreviousBlock}>
                    <SkipBack className="h-4 w-4" aria-hidden="true" />
                    Previous block
                  </button>
                  <button type="button" className={`${secondaryButtonClassName} min-h-12 gap-2 py-3`} disabled={pending} onClick={() => finishCurrentBlock(false)}>
                    <Check className="h-4 w-4" aria-hidden="true" />
                    {execution.currentIndex === activeBlocks.length - 1 ? 'Finish block' : 'Next block'}
                  </button>
                </>
              )}
            </div>

            {confirmRestart ? (
              <div role="alert" className="space-y-3 border border-[var(--status-warning-border)] bg-[var(--status-warning-tint)] p-4">
                <p className="text-[13px] font-semibold text-[var(--text)]">Restart from the first block?</p>
                <p className="text-[12px] leading-[1.5] text-[var(--text-secondary)]">This clears the live progress stored on this device.</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={secondaryButtonClassName} onClick={() => setConfirmRestart(false)}>Keep progress</button>
                  <button type="button" className={dangerButtonClassName} onClick={restartWorkout}>Restart workout</button>
                </div>
              </div>
            ) : null}

            {message ? <p role="status" aria-live="polite" className="text-[13px] text-[var(--text-secondary)]">{message}</p> : null}
            {error ? <p role="alert" className={dangerTextClassName}>{error}</p> : null}
          </>
        ) : (
          <div role="alert" className="border-y border-[var(--border)] py-6">
            <h2 className={sectionHeadingClassName}>No active blocks</h2>
            <p className="mt-2 text-[13px] leading-[1.5] text-[var(--text-secondary)]">This session has no active workout blocks to time. Return to the session details to review its plan.</p>
          </div>
        )}

        {canKeepAwake ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
            <div>
              <p className="text-[12px] font-medium text-[var(--text)]">Keep screen awake</p>
              <p className="mt-1 text-[11px] text-[var(--text-secondary)]">Useful while following the workout on a phone.</p>
            </div>
            <button
              type="button"
              aria-pressed={keepAwake}
              className={`${secondaryButtonClassName} min-h-10 gap-2`}
              onClick={() => { setKeepAwake((value) => !value); setWakeLockError(''); }}
            >
              <Sun className="h-4 w-4" aria-hidden="true" />
              {keepAwake ? 'On' : 'Off'}
            </button>
            {wakeLockError ? <p role="status" className="w-full text-[12px] text-[var(--text-secondary)]">{wakeLockError}</p> : null}
          </div>
        ) : null}

        {hasStarted && !saved && !alreadyCompleted ? (
          <div className="border-t border-[var(--border)] pt-3">
            {!confirmRestart ? (
              <button type="button" className="text-[12px] font-medium text-[var(--text-secondary)] underline decoration-[var(--border)] underline-offset-4 hover:text-[var(--text)]" onClick={() => setConfirmRestart(true)}>
                Restart workout
              </button>
            ) : null}
          </div>
        ) : null}
      </Surface>

      <div className="min-w-0 space-y-4">
        <Surface className="space-y-4">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className={sectionHeadingClassName}>Session progress</h2>
            <span className="metric-text text-[12px] text-[var(--text-secondary)]">{handledCount} / {activeBlocks.length}</span>
          </div>
          <div
            role="progressbar"
            aria-label="Session progress"
            aria-valuemin={0}
            aria-valuemax={activeBlocks.length}
            aria-valuenow={handledCount}
            className="h-2 overflow-hidden bg-[var(--sunken)]"
          >
            <div className="h-full bg-[var(--brand)] transition-[width] duration-300 ease-out motion-reduce:transition-none" style={{ width: `${sessionProgress}%` }} />
          </div>
          <SessionPlanCanvas
            blocks={blocks}
            size="live"
            activeBlockId={currentBlock?.id}
            completedIds={completedIds}
            skippedIds={skippedIds}
          />
          <p className="text-[12px] leading-[1.5] text-[var(--text-secondary)]">
            {plannedSkippedBlocks.length ? `${plannedSkippedBlocks.length} planned ${plannedSkippedBlocks.length === 1 ? 'block is' : 'blocks are'} already skipped and excluded from the timer.` : `${activeBlocks.length} active ${activeBlocks.length === 1 ? 'block' : 'blocks'} in this workout.`}
          </p>
        </Surface>

        <Surface className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className={sectionHeadingClassName}>Block sequence</h2>
            <span className="text-[11px] text-[var(--text-muted)]">{formatDurationExact(totalDurationSec)}</span>
          </div>
          <ol className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
            {blocks.map((block, index) => {
              const activeIndex = activeBlocks.findIndex((active) => active.id === block.id);
              const isCurrent = activeIndex === execution.currentIndex && !isFinished;
              const blockDone = activeIndex >= 0 && execution.completed[activeIndex];
              const liveSkipped = activeIndex >= 0 && execution.skipped[activeIndex];
              const blockStatus = block.skipped || liveSkipped ? 'Skipped' : blockDone ? 'Done' : isCurrent ? 'Current block' : 'Up next';

              return (
                <li key={block.id} aria-current={isCurrent ? 'step' : undefined} className={`py-3 ${block.skipped || liveSkipped ? 'opacity-65' : ''}`}>
                  <div className="flex items-start gap-3">
                    <span className="metric-text min-w-5 pt-0.5 text-[11px] text-[var(--text-muted)]">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-[13px] font-medium text-[var(--text)]">{block.label}</span>
                        <span className={`text-[11px] font-semibold ${isCurrent ? 'text-[var(--field-selected-text)]' : 'text-[var(--text-muted)]'}`}>{blockStatus}</span>
                      </div>
                      <p className="mt-1 text-[12px] leading-[1.45] text-[var(--text-secondary)]">
                        {formatDurationExact(block.durationSec * (block.reps ?? 1))}
                        {block.reps ? ` · ${block.reps} reps` : ''}
                        {block.targetLabel ? ` · ${block.targetLabel}` : ''}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          {currentBlock?.note ? <p className="text-[12px] leading-[1.5] text-[var(--text-secondary)]">Current cue: {currentBlock.note}</p> : null}
        </Surface>

        <p className="px-1 text-[11px] leading-[1.5] text-[var(--text-muted)]">
          Live progress is stored on this device and resets if you refresh or leave this page. Session completion is saved when you choose Finish workout.
        </p>
        {alreadyCompleted ? <p className="px-1 text-[11px] leading-[1.5] text-[var(--text-secondary)]">This session was already completed. Another run will not change its saved outcome.</p> : null}
        {saved ? <ActionLink href={sessionHref} tone="secondary">Back to session details</ActionLink> : null}
      </div>
    </div>
  );
}
