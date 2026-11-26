'use client';

import { useId, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { Bike, Bluetooth, CalendarCheck, ChevronDown, ChevronRight, Monitor, Play, Timer, X, type LucideIcon } from 'lucide-react';
import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@ui-sdk/react/dialog';
import { getRideOs, GetTempoBuilderRideLink, RideAppInstallHelp, useRideAppLaunch } from '@/components/RideAppLaunch';
import { useCatalogRide } from '@/components/library/useCatalogRide';
import {
  dangerTextClassName,
  sheetDialogClassName,
  buttonFocusClassName, iconButtonClassName,
  primaryButtonClassName, secondaryButtonClassName, sectionHeadingClassName,
} from '@/components/ui';
import { withBackOrigin, type BackOrigin } from '@/lib/app-navigation';
import { parseExecutionProgress, type ExecutionStep } from '@/lib/athlete-execution';
import { executionProgressKey, getExecutionProgress, pauseSavedExecutionProgress, subscribeToExecutionProgress } from '@/lib/athlete-execution-progress-store';
import { formatDuration } from '@/lib/format-duration';
import { isWebBluetoothAvailable } from '@/lib/ride/bluetooth';
import { rideSessionPath } from '@/lib/ride/launch';
import {
  canStartWorkout, getWorkoutStartChoices,
  type WorkoutStartEligibility, type WorkoutStartIcon, type WorkoutStartMode, type WorkoutStartOption, type WorkoutStartRuntime,
} from '@/lib/workout-start';

const optionIcons: Record<WorkoutStartIcon, LucideIcon> = { desktop: Monitor, bluetooth: Bluetooth, timer: Timer, bike: Bike };

const optionRowClassName =
  `flex w-full min-h-16 items-center gap-3.5 px-3.5 py-3 text-left transition-colors control-hover:bg-[var(--raised)] disabled:cursor-not-allowed disabled:opacity-50 ${buttonFocusClassName} focus-visible:ring-inset focus-visible:ring-offset-0`;

type WorkoutSource =
  | { kind: 'session'; id: number; from: BackOrigin | null; liveSteps?: ExecutionStep[] }
  | { kind: 'catalog'; slug: string; from: 'library' | 'ride' }
  /** A saved workout from My workouts. Like a catalog workout, it isn't in the Calendar. */
  | { kind: 'workout'; id: number; from: BackOrigin | null };

type Props = {
  workout: WorkoutStartEligibility & { title: string; durationSec: number };
  source: WorkoutSource;
  triggerClassName?: string;
  /** Accessible name when the page has another control with the same visible label. */
  triggerAriaLabel?: string;
};

export function WorkoutStartChooser(props: Props) {
  return canStartWorkout(props.workout) ? <StartControl {...props} /> : null;
}

function StartControl({ workout, source, triggerClassName, triggerAriaLabel }: Props) {
  const router = useRouter();
  const app = useRideAppLaunch();
  const catalog = useCatalogRide();
  const dialogId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [runtime, setRuntime] = useState<WorkoutStartRuntime | null>(null);
  const [open, setOpen] = useState(false);

  const liveSteps = source.kind === 'session' ? source.liveSteps : undefined;
  const progressKey = source.kind === 'session' && liveSteps ? executionProgressKey(source.id) : null;
  const savedProgress = useSyncExternalStore(
    (callback) => progressKey ? subscribeToExecutionProgress(progressKey, callback) : () => undefined,
    () => progressKey ? getExecutionProgress(progressKey) : null,
    () => null,
  );
  const hasProgress = liveSteps ? parseExecutionProgress(savedProgress, liveSteps) !== null : false;

  const label = liveSteps ? 'Change workout mode' : 'Start workout';
  const choices = runtime ? getWorkoutStartChoices(workout, runtime) : { recommended: null, others: [] };
  const options = choices.recommended ? [choices.recommended, ...choices.others] : choices.others;
  const busy = catalog.preparation.kind === 'pending';
  const preparedId = catalog.preparation.kind === 'ready' ? catalog.preparation.sessionId : null;
  const sessionId = source.kind === 'session' ? source.id : preparedId;

  function openChooser() {
    app.reset();
    catalog.reset();
    setRuntime({
      os: getRideOs(),
      webBluetooth: isWebBluetoothAvailable(),
      inTempoBuilderRide: window.tempoDesktop?.isDesktop === true,
    });
    setOpen(true);
  }

  function pauseLiveProgress() {
    if (progressKey && liveSteps) pauseSavedExecutionProgress(progressKey, liveSteps);
  }

  function openApp(id: number) {
    pauseLiveProgress();
    app.launch(id, source.from ?? undefined);
  }

  async function choose(mode: WorkoutStartMode) {
    if (mode === 'live' && liveSteps) {
      setOpen(false);
      return;
    }

    const id = source.kind === 'session' ? source.id : await catalog.prepare(source);
    if (id === null) return;

    if (mode === 'app') {
      openApp(id);
      return;
    }

    pauseLiveProgress();
    setOpen(false);
    router.push(mode === 'live'
      ? withBackOrigin(`/athlete/live/${id}`, source.from)
      : rideSessionPath(id, source.from ?? undefined));
  }

  function isDisabled(mode: WorkoutStartMode) {
    return busy || (mode === 'app' && app.state === 'opening');
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName ?? `${primaryButtonClassName} max-md:min-h-11`}
        aria-label={triggerAriaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? dialogId : undefined}
        onClick={openChooser}
      >
        {liveSteps ? null : <Play aria-hidden="true" size={15} strokeWidth={1.8} />}
        {label}
      </button>

      {runtime ? (
        <Dialog open={open} onOpenChange={(next, details) => {
          if (!next && busy) details.cancel();
          else setOpen(next);
        }}>
          <DialogBackdrop className="fixed inset-0 bg-black/50" />
          <DialogContent
            id={dialogId}
            initialFocus="content"
            finalFocus={() => triggerRef.current}
            className={`${sheetDialogClassName} max-w-md grid-rows-[auto_minmax(0,1fr)_auto] px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] md:max-h-[calc(100dvh-2rem)]`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <DialogTitle className={sectionHeadingClassName}>{label}</DialogTitle>
                <DialogDescription className="mt-1 break-words text-sm text-[var(--text-secondary)]">
                  {workout.title} <span className="data whitespace-nowrap">– {formatDuration(workout.durationSec)}</span>
                  {source.kind !== 'session' ? (
                    <span className="mt-1.5 flex items-center gap-1.5 text-[13px] text-[var(--text-muted)]">
                      <CalendarCheck aria-hidden="true" size={14} strokeWidth={1.6} />Added to your Calendar when you finish
                    </span>
                  ) : null}
                </DialogDescription>
              </div>
              <DialogClose type="button" className={iconButtonClassName} aria-label="Close" disabled={busy}>
                <X aria-hidden="true" size={17} />
              </DialogClose>
            </div>

            <div className="-mx-2 space-y-4 overflow-y-auto overscroll-contain px-2 py-4">
              {hasProgress ? <p className="text-sm text-[var(--text-secondary)]">Switching to a ride keeps your block timer progress here.</p> : null}
              {choices.recommended ? (
                <div className="overflow-hidden rounded-xl border border-[var(--brand)] bg-[var(--brand-tint)]">
                  <OptionRow
                    option={choices.recommended}
                    note={choices.recommended.reason}
                    recommended
                    disabled={isDisabled(choices.recommended.mode)}
                    onChoose={choose}
                  />
                </div>
              ) : null}
              {choices.others.length > 0 ? (
                <div>
                  {choices.recommended ? <p id={`${dialogId}-others`} className="mb-2 px-0.5 text-xs font-medium text-[var(--text-muted)]">Other ways to start</p> : null}
                  <ul
                    aria-labelledby={choices.recommended ? `${dialogId}-others` : undefined}
                    className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)]"
                  >
                    {choices.others.map((option) => (
                      <li key={option.label}>
                        <OptionRow option={option} note={option.hint} disabled={isDisabled(option.mode)} onChoose={choose} />
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {busy ? <p role="status" className="text-sm text-[var(--text-secondary)]">Opening workout…</p> : null}
              {catalog.preparation.kind === 'error' ? (
                <p role="alert" className={dangerTextClassName}>{catalog.preparation.message}</p>
              ) : null}
              {app.state === 'opening' ? <p role="status" className="text-sm text-[var(--text-secondary)]">Opening TempoBuilder Ride…</p> : null}
              {app.state === 'attempted' && sessionId !== null ? (
                <RideAppInstallHelp os={runtime.os} onRetry={() => openApp(sessionId)} />
              ) : null}
              <details className="group">
                <summary className={`flex min-h-10 w-fit cursor-pointer list-none items-center gap-1.5 rounded-lg px-0.5 text-[13px] font-medium text-[var(--text-secondary)] hover:text-[var(--text)] [&::-webkit-details-marker]:hidden ${buttonFocusClassName}`}>
                  <ChevronDown aria-hidden="true" size={16} className="transition-transform duration-200 group-open:rotate-180" />
                  {options.length > 1 ? 'Which one should I pick?' : 'How it works'}
                </summary>
                <ul className="mt-1 space-y-2.5 px-0.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                  {options.map((option) => {
                    const Icon = optionIcons[option.icon];
                    return (
                      <li key={option.label} className="grid grid-cols-[1rem_minmax(0,1fr)] gap-2.5">
                        <Icon aria-hidden="true" size={16} strokeWidth={1.6} className="mt-0.5 text-[var(--text-muted)]" />
                        <span>
                          <span className="font-medium text-[var(--text)]">{option.label}.</span> {option.detail}
                          {option.mode === 'app' ? <> <GetTempoBuilderRideLink /></> : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </details>
            </div>

            <div className="flex justify-end border-t border-[var(--border)] pt-3">
              <DialogClose type="button" className={`${secondaryButtonClassName} max-md:min-h-11 max-md:w-full`} disabled={busy}>Cancel</DialogClose>
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
}

function OptionRow({ option, note, recommended = false, disabled, onChoose }: {
  option: WorkoutStartOption;
  note: string;
  recommended?: boolean;
  disabled: boolean;
  onChoose: (mode: WorkoutStartMode) => Promise<void>;
}) {
  const Icon = optionIcons[option.icon];
  return (
    <button
      type="button"
      className={`${optionRowClassName} ${recommended ? 'min-h-[4.5rem] py-3.5' : ''}`}
      disabled={disabled}
      onClick={() => { void onChoose(option.mode); }}
    >
      <span
        aria-hidden="true"
        className={`grid shrink-0 place-items-center rounded-[10px] ${recommended
          ? 'size-11 bg-[var(--brand)] text-[var(--signal-ink)]'
          : 'size-10 border border-[var(--border)] bg-[var(--raised)] text-[var(--text)]'}`}
      >
        <Icon size={recommended ? 21 : 19} strokeWidth={1.6} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        {recommended ? <span className="text-xs font-medium text-[var(--brand)]">Recommended</span> : null}
        <span className={`font-medium text-[var(--text)] ${recommended ? 'text-base' : 'text-[15px]'}`}>{option.label}</span>
        <span className="text-[13px] text-[var(--text-secondary)]">{note}</span>
      </span>
      <ChevronRight aria-hidden="true" size={18} className="shrink-0 text-[var(--text-muted)]" />
    </button>
  );
}
