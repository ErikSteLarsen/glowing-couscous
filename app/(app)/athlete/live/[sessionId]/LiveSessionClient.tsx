'use client';

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, Ellipsis, Pause, Play, RotateCcw, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';

import {
  BackLink,
  buttonFocusClassName,
  dangerTextClassName,
  ghostButtonClassName,
  iconButtonClassName,
  successTextClassName,
} from '@/components/ui';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/tempobuilder/Menu';
import { Stepper } from '@/components/tempobuilder/Stepper';
import type { BackTarget } from '@/lib/app-navigation';
import { formatDuration } from '@/lib/format-duration';
import { intensityColor } from '@/lib/intensity-color';
import { toDayKey } from '@/lib/training-load';
import {
  advanceExecution,
  createExecutionState,
  executionElapsedSeconds,
  getExecutionTimerRemainingMs,
  idleExecutionTimer,
  isExecutionActive,
  isExecutionComplete,
  parseExecutionProgress,
  parseExecutionTimer,
  pauseExecutionTimer,
  previousExecution,
  remainingExecutionSeconds,
  restartExecution,
  serializeExecutionProgress,
  settleExecution,
  startExecutionBlock,
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
import { useBlockTimerCues, useCuePreference, useScreenWakeLock } from './useBlockTimerCues';

/** Event handlers read the wall clock; render uses the `now` state instead. */
const readClock = () => Date.now();

function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  const rest = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
    : `${Math.floor(seconds / 60)}:${String(rest).padStart(2, '0')}`;
}

function spokenDuration(seconds: number): string {
  if (seconds <= 0) return 'no set time';
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  const parts = [minutes ? `${minutes} minute${minutes === 1 ? '' : 's'}` : '', rest ? `${rest} second${rest === 1 ? '' : 's'}` : ''];
  return parts.filter(Boolean).join(' ');
}

function stepName(step: ExecutionStep): string {
  return step.name ?? step.label;
}

function zoneColor(step: ExecutionStep): string {
  if (step.kind === 'pause' || step.zone === undefined) return 'var(--text-muted)';
  return intensityColor(step.zone);
}

const dockSideButtonClassName =
  `grid size-14 place-items-center rounded-full border border-[var(--border-strong)] text-[var(--text)] transition-[background-color,transform] control-hover:bg-[var(--raised)] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-40 [@media(max-height:700px)]:size-12 ${buttonFocusClassName}`;
const dockMainButtonClassName =
  `grid size-[4.5rem] place-items-center rounded-full bg-[var(--brand)] text-[var(--signal-ink)] transition-[background-color,transform] control-hover:bg-[var(--signal-hover)] active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50 [@media(max-height:700px)]:size-16 ${buttonFocusClassName}`;

export function LiveSessionClient({ sessionId, blocks, isDone, unsaved = false, title, back, workoutHref, actions }: {
  sessionId: number;
  blocks: ExecutionStep[];
  isDone: boolean;
  /** Started without planning: it reaches the Calendar only when marked as done. */
  unsaved?: boolean;
  title: string;
  back: BackTarget;
  workoutHref: string;
  /** Extra page actions, such as changing a bike workout to a ride. */
  actions?: ReactNode;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [now, setNow] = useState<number | null>(null);
  const [beeps, setBeeps] = useCuePreference('beeps');
  const [voice, setVoice] = useCuePreference('voice');
  const saved = isDone || message !== '';
  const hasBlocks = blocks.length > 0;
  const progressKey = executionProgressKey(sessionId);
  const savedProgress = useSyncExternalStore(
    (callback) => subscribeToExecutionProgress(progressKey, callback),
    () => getExecutionProgress(progressKey),
    () => null,
  );
  const storedState: ExecutionState = isDone ? createExecutionState(blocks.length) : parseExecutionProgress(savedProgress, blocks) ?? createExecutionState(blocks.length);
  const storedTimer = isDone ? idleExecutionTimer : parseExecutionTimer(savedProgress, blocks, storedState);
  const settled = now === null ? { state: storedState, timer: storedTimer } : settleExecution(blocks, storedState, storedTimer, now);
  const { state, timer } = settled;
  const complete = hasBlocks && isExecutionComplete(state);
  const currentIndex = state.currentIndex;
  const currentStep = blocks[currentIndex];
  const nextStep = blocks.slice(currentIndex + 1).find((_, offset) => !state.skipped[currentIndex + 1 + offset]);
  const active = isExecutionActive(timer) && !saved && !complete;
  const remainingMs = currentStep && now !== null ? getExecutionTimerRemainingMs(timer, currentStep.durationSec, now) : null;
  const remainingSec = remainingMs === null ? currentStep?.durationSec ?? 0 : remainingMs / 1000;
  const durations = blocks.map((step) => step.durationSec);
  const elapsedSec = executionElapsedSeconds(blocks, state, remainingSec);
  const leftSec = remainingExecutionSeconds(state, remainingSec, durations);
  const started = currentIndex > 0 || state.completed.some(Boolean) || storedTimer.kind !== 'idle';
  const openBlock = currentStep !== undefined && currentStep.durationSec <= 0;
  const blockProgress = currentStep && currentStep.durationSec > 0 ? Math.min(1, Math.max(0, 1 - remainingSec / currentStep.durationSec)) : 0;

  const { unlock } = useBlockTimerCues({
    active,
    remainingMs: timer.kind === 'running' ? remainingMs : null,
    block: currentStep && !complete
      ? {
          key: `${currentIndex}:${currentStep.id}`,
          spoken: `${stepName(currentStep)}${currentStep.rep ? `, rep ${currentStep.rep.index} of ${currentStep.rep.count}` : ''}, ${spokenDuration(currentStep.durationSec)}`,
        }
      : null,
  });
  useScreenWakeLock(active);

  const ticking = timer.kind === 'running' && !saved;
  useEffect(() => {
    const initialRefresh = window.setTimeout(() => setNow(Date.now()), 0);
    if (!ticking) return () => window.clearTimeout(initialRefresh);
    const refresh = () => setNow(Date.now());
    // Quarter-second ticks keep the countdown beeps on time.
    const interval = window.setInterval(refresh, 250);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [ticking]);

  function updateExecutionState(nextState: ExecutionState, nextTimer: ExecutionTimer = idleExecutionTimer): void {
    if (!hasBlocks || isDone) return;
    if (nextState.currentIndex === 0 && nextState.completed.every((value) => !value) && nextTimer.kind === 'idle') {
      clearExecutionProgress(progressKey);
      return;
    }
    saveExecutionProgress(progressKey, serializeExecutionProgress(blocks, nextState, nextTimer));
  }

  // Store blocks the clock moved past, so a reload or another tab resumes from here.
  const settledChanged = settled.state !== storedState || settled.timer !== storedTimer;
  useEffect(() => {
    if (settledChanged && !isDone) saveExecutionProgress(progressKey, serializeExecutionProgress(blocks, settled.state, settled.timer));
  });

  function startOrResume() {
    unlock();
    const at = readClock();
    if (timer.kind === 'paused' && currentStep) {
      updateExecutionState(state, startExecutionTimer(timer, currentStep.durationSec, at));
    } else if (timer.kind === 'elapsed') {
      const nextState = advanceExecution(state);
      updateExecutionState(nextState, isExecutionComplete(nextState) ? idleExecutionTimer : startExecutionBlock(blocks[nextState.currentIndex], at));
    } else {
      updateExecutionState(state, startExecutionBlock(currentStep, at));
    }
  }

  function pause() {
    updateExecutionState(state, timer.kind === 'running' ? pauseExecutionTimer(timer, readClock()) : idleExecutionTimer);
  }

  function move(nextState: ExecutionState) {
    if (isExecutionComplete(nextState)) {
      updateExecutionState(nextState);
      return;
    }
    // A running workout keeps running in the block you move to; a paused one stays paused.
    updateExecutionState(nextState, active ? startExecutionBlock(blocks[nextState.currentIndex], readClock()) : idleExecutionTimer);
  }

  async function completeSession() {
    setPending(true);
    setError('');
    try {
      const response = await fetch(`/api/athlete/sessions/${sessionId}/completion`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDone: true, localDay: toDayKey(new Date()), via: 'live' }),
      });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? 'Could not mark this workout as done. Try again.');
        return;
      }
      clearExecutionProgress(progressKey);
      setMessage('Workout marked as done. It’s in your Calendar.');
      router.refresh();
    } catch {
      setError('Could not reach TempoBuilder. Check your connection and try again.');
    } finally {
      setPending(false);
    }
  }

  function handleMain() {
    if (complete) void completeSession();
    else if (active) pause();
    else startOrResume();
  }

  function getMainAction(): { label: string; icon: typeof Play } {
    if (complete) return { label: pending ? 'Saving…' : 'Mark as done', icon: Check };
    if (active) return { label: 'Pause', icon: Pause };
    return { label: started ? 'Resume' : 'Start', icon: Play };
  }

  const mainAction = getMainAction();
  const MainIcon = mainAction.icon;
  const showDock = hasBlocks && !saved;

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--background)] text-[var(--text)]">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-[var(--border)] bg-[var(--background)] px-3 py-2 md:px-5">
        <BackLink target={back} variant="compact" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-[var(--text-muted)]">Block timer</p>
          <h1 className="truncate text-base font-medium tracking-[-0.01em]">{title}</h1>
        </div>
        <button
          type="button"
          className={iconButtonClassName}
          aria-pressed={beeps}
          aria-label="Beeps"
          title={beeps ? 'Beeps on' : 'Beeps off'}
          onClick={() => setBeeps(!beeps)}
        >
          {beeps ? <Volume2 aria-hidden="true" size={18} strokeWidth={1.6} /> : <VolumeX aria-hidden="true" size={18} strokeWidth={1.6} />}
        </button>
        <Menu>
          <MenuTrigger aria-label="More workout options" className={iconButtonClassName} disabled={pending}>
            <Ellipsis aria-hidden="true" size={18} strokeWidth={1.8} />
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem value="voice" onSelect={() => setVoice(!voice)}>
              {voice ? <VolumeX aria-hidden="true" size={16} strokeWidth={1.8} /> : <Volume2 aria-hidden="true" size={16} strokeWidth={1.8} />}
              {voice ? 'Turn off spoken cues' : 'Turn on spoken cues'}
            </MenuItem>
            <MenuItem value="restart" disabled={!started || saved} onSelect={() => updateExecutionState(restartExecution(state))}>
              <RotateCcw aria-hidden="true" size={16} strokeWidth={1.8} />
              Restart workout
            </MenuItem>
          </MenuContent>
        </Menu>
      </header>

      <main
        className={`mx-auto grid w-full max-w-[1140px] flex-1 content-start gap-3 px-4 pt-[clamp(0.75rem,2dvh,1.5rem)] md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] md:gap-5 md:px-6 ${showDock ? 'pb-36 [@media(max-height:700px)]:pb-28' : 'pb-8'}`}
      >
        <section aria-labelledby="live-current-step" className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-[clamp(1rem,2.5dvh,1.5rem)] py-[clamp(0.875rem,2.4dvh,1.5rem)]">
          {saved ? (
            <div className="space-y-3 py-6 text-center">
              <h2 id="live-current-step" className="text-xl font-medium">Workout done</h2>
              <p role="status" className={successTextClassName}>{isDone ? 'To check or fix the result, open the workout page.' : message}</p>
              <Link href={workoutHref} className={ghostButtonClassName('default')}>Open workout</Link>
            </div>
          ) : !hasBlocks ? (
            <p id="live-current-step" role="alert" className={dangerTextClassName}>This workout has no blocks.</p>
          ) : complete ? (
            <div className="space-y-2 py-[clamp(1rem,6dvh,4rem)] text-center">
              <h2 id="live-current-step" className="text-2xl font-medium">All blocks done</h2>
              <p className="text-sm text-[var(--text-secondary)]">{unsaved ? 'Mark it as done to add it to your Calendar.' : 'Mark the workout as done to save it.'}</p>
              <p className="data text-sm text-[var(--text-secondary)]">{formatDuration(elapsedSec)} done</p>
            </div>
          ) : currentStep ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 id="live-current-step" className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[clamp(1.125rem,2.8dvh,1.5rem)] font-medium tracking-[-0.01em]">
                    {currentStep.kind !== 'pause' && currentStep.zone !== undefined ? (
                      <span className="inline-flex h-6 items-center gap-1.5 rounded-full border px-2 text-xs font-medium" style={{ borderColor: zoneColor(currentStep) }}>
                        <span aria-hidden="true" className="size-2 rounded-full" style={{ backgroundColor: zoneColor(currentStep) }} />
                        Z{currentStep.zone}
                      </span>
                    ) : null}
                    {stepName(currentStep)}
                  </h2>
                  {currentStep.rep ? <p className="data mt-0.5 text-sm text-[var(--text-secondary)]">Rep {currentStep.rep.index} of {currentStep.rep.count}</p> : null}
                  {currentStep.targetLabel ? <p className="data mt-1 text-[clamp(1rem,2.4dvh,1.25rem)] font-medium">{currentStep.targetLabel}</p> : null}
                  {currentStep.note ? <p className="mt-1 line-clamp-2 max-w-prose text-[13px] text-[var(--text-secondary)] [@media(max-height:700px)]:line-clamp-1">{currentStep.note}</p> : null}
                </div>
                <p className="data shrink-0 pt-1 text-xs text-[var(--text-muted)]">Block {currentIndex + 1} of {blocks.length}</p>
              </div>

              {openBlock ? (
                <div className="py-[clamp(1rem,5dvh,3rem)] text-center">
                  <p className="text-[clamp(1.75rem,6dvh,3rem)] font-medium tracking-[-0.02em]">No set time</p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">{active ? 'Tap Next block when you’re done.' : 'Start, then tap Next block when you’re done.'}</p>
                </div>
              ) : (
                <>
                  <p
                    role="timer"
                    aria-label={`Time left in this block ${formatClock(remainingSec)}${active ? '' : ', stopped'}`}
                    className="data py-[clamp(0.5rem,3.5dvh,2.25rem)] text-center text-[clamp(3.5rem,12.5dvh,7.5rem)] font-medium leading-none tracking-[-0.04em] md:text-[clamp(4.5rem,17dvh,9.5rem)]"
                  >
                    {now === null ? '--:--' : formatClock(remainingSec)}
                  </p>
                  <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-[var(--sunken)]">
                    <div className="h-full rounded-full" style={{ width: `${blockProgress * 100}%`, backgroundColor: zoneColor(currentStep) }} />
                  </div>
                  <div className="data mt-1.5 flex justify-between text-[13px] text-[var(--text-muted)]">
                    <span>{active ? `${formatClock(currentStep.durationSec - remainingSec)} done` : started ? 'Paused' : 'Ready'}</span>
                    <span>{formatClock(currentStep.durationSec)}</span>
                  </div>
                </>
              )}

              <div className="mt-[clamp(0.75rem,2dvh,1.25rem)] flex items-center gap-3 rounded-xl bg-[var(--sunken)] px-3.5 py-[clamp(0.5rem,1.4dvh,0.75rem)]">
                <span aria-hidden="true" className="w-1.5 self-stretch rounded-full" style={{ backgroundColor: nextStep ? zoneColor(nextStep) : 'var(--border-strong)' }} />
                <p className="min-w-0 text-sm">
                  <span className="block text-xs font-medium text-[var(--text-muted)]">Next</span>
                  {nextStep ? (
                    <>
                      <span className="font-medium">{stepName(nextStep)}</span>{' '}
                      <span className="data text-[var(--text-secondary)]">
                        {nextStep.durationSec > 0 ? formatClock(nextStep.durationSec) : 'No set time'}
                        {nextStep.targetLabel ? ` – ${nextStep.targetLabel}` : ''}
                      </span>
                    </>
                  ) : <span className="text-[var(--text-secondary)]">Last block</span>}
                </p>
              </div>
            </>
          ) : null}
          {error ? <p role="alert" className={`${dangerTextClassName} mt-3`}>{error}</p> : null}
        </section>

        {hasBlocks ? (
          <div className="space-y-3 md:space-y-5">
            <div className="rounded-2xl border border-[var(--border)] px-4 py-3">
              <dl className="flex items-baseline justify-between gap-4">
                <div>
                  <dt className="text-xs font-medium text-[var(--text-muted)]">Done</dt>
                  <dd className="data text-[clamp(1.125rem,2.8dvh,1.5rem)] font-medium">{formatClock(elapsedSec)}</dd>
                </div>
                <div className="text-right">
                  <dt className="text-xs font-medium text-[var(--text-muted)]">Left</dt>
                  <dd className="data text-[clamp(1.125rem,2.8dvh,1.5rem)] font-medium">{formatClock(leftSec)}</dd>
                </div>
              </dl>
              <div
                role="img"
                aria-label={`Workout progress: block ${Math.min(currentIndex + 1, blocks.length)} of ${blocks.length}`}
                className="mt-2.5 flex h-7 items-end gap-0.5 [@media(max-height:700px)]:h-5"
              >
                {blocks.map((step, index) => {
                  const current = index === currentIndex && !complete && !saved;
                  const done = saved || state.completed[index] || state.skipped[index];
                  return (
                    <span
                      key={step.id}
                      className={`training-chart-bar block ${current ? 'outline-2 outline-offset-1 outline-[var(--text)]' : ''}`}
                      style={{
                        flexGrow: Math.max(step.durationSec, 30),
                        height: step.kind === 'pause' ? '20%' : `${30 + Math.min(Math.max(step.zone ?? 1, 1), 5) * 14}%`,
                        backgroundColor: zoneColor(step),
                        opacity: current ? 1 : done ? 0.25 : 0.55,
                      }}
                    />
                  );
                })}
              </div>
            </div>

            <details className="group rounded-2xl border border-[var(--border)] px-4">
              <summary className={`flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg text-sm [&::-webkit-details-marker]:hidden ${buttonFocusClassName}`}>
                <ChevronDown aria-hidden="true" size={16} className="shrink-0 transition-transform group-open:rotate-180" />
                <span className="font-medium">Workout blocks</span>
                <span className="data ml-auto text-[var(--text-secondary)]">{formatDuration(durations.reduce((total, value) => total + value, 0))}</span>
              </summary>
              <div className="pb-3">
                <Stepper
                  items={blocks.map((block, index) => ({
                    id: block.id,
                    title: `${block.label} – ${block.durationSec > 0 ? formatDuration(block.durationSec) : 'no set time'}`,
                    detail: [block.targetLabel, block.note].filter(Boolean).join(' – '),
                    active: index === currentIndex && !complete && !saved,
                    done: saved || state.completed[index],
                  }))}
                />
              </div>
            </details>
            {unsaved ? <p className="px-1 text-[13px] text-[var(--text-muted)]">Not in your Calendar yet. It’s added when you mark it as done.</p> : null}
            {actions ? <div className="flex justify-start">{actions}</div> : null}
          </div>
        ) : null}
      </main>

      {showDock ? (
        <nav
          aria-label="Workout controls"
          className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--border)] bg-[color-mix(in_srgb,var(--background)_92%,transparent)] px-5 pt-3 pb-[max(0.875rem,env(safe-area-inset-bottom))] backdrop-blur-md [@media(max-height:700px)]:pt-2"
        >
          <div className="mx-auto grid max-w-md grid-cols-3 items-start justify-items-center gap-3 text-[11px] text-[var(--text-muted)]">
            <div className="flex flex-col items-center gap-1 justify-self-start md:justify-self-center">
              <button
                type="button"
                aria-label="Previous block"
                className={dockSideButtonClassName}
                disabled={pending || currentIndex === 0}
                onClick={() => move(previousExecution(state))}
              >
                <SkipBack aria-hidden="true" size={20} strokeWidth={1.7} />
              </button>
              <span aria-hidden="true">Previous</span>
            </div>
            <div className="-mt-1 flex flex-col items-center gap-1">
              <button type="button" aria-label={mainAction.label} className={dockMainButtonClassName} disabled={pending || saved} onClick={handleMain}>
                <MainIcon aria-hidden="true" size={28} strokeWidth={2} />
              </button>
              <span aria-hidden="true" className="font-medium text-[var(--text-secondary)]">{mainAction.label}</span>
            </div>
            <div className="flex flex-col items-center gap-1 justify-self-end md:justify-self-center">
              <button
                type="button"
                aria-label="Next block"
                className={dockSideButtonClassName}
                disabled={pending || complete}
                onClick={() => move(advanceExecution(state))}
              >
                <SkipForward aria-hidden="true" size={20} strokeWidth={1.7} />
              </button>
              <span aria-hidden="true">Next block</span>
            </div>
          </div>
        </nav>
      ) : null}
      <p className="sr-only" aria-live="polite">
        {active && currentStep && !complete ? `${stepName(currentStep)}${currentStep.rep ? `, rep ${currentStep.rep.index} of ${currentStep.rep.count}` : ''}` : ''}
      </p>
    </div>
  );
}
