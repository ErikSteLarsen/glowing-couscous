'use client';

import { useId, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Ellipsis, Play, X } from 'lucide-react';
import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@ui-sdk/react/dialog';
import { getRideOs, GetTempoRideLink, RideAppInstallHelp, useRideAppLaunch } from '@/components/RideAppLaunch';
import { useCatalogRide } from '@/components/library/useCatalogRide';
import { Menu, MenuContent, MenuItem, MenuTrigger } from '@/components/tempo/Menu';
import {
  dangerTextClassName,
  sheetDialogClassName,
  ghostButtonClassName, iconButtonClassName,
  primaryButtonClassName, secondaryButtonClassName, sectionHeadingClassName,
} from '@/components/ui';
import { withBackOrigin, type BackOrigin } from '@/lib/app-navigation';
import { parseExecutionProgress, type ExecutionStep } from '@/lib/athlete-execution';
import { executionProgressKey, getExecutionProgress, pauseSavedExecutionProgress, subscribeToExecutionProgress } from '@/lib/athlete-execution-progress-store';
import { formatDuration } from '@/lib/format-duration';
import { isWebBluetoothAvailable } from '@/lib/ride/bluetooth';
import { rideSessionPath } from '@/lib/ride/launch';
import { canStartWorkout, getWorkoutStartOptions, type WorkoutStartEligibility, type WorkoutStartRuntime } from '@/lib/workout-start';

type WorkoutSource =
  | { kind: 'session'; id: number; from: BackOrigin | null; liveSteps?: ExecutionStep[] }
  | { kind: 'catalog'; slug: string; from: 'library' | 'ride' }
  /** A saved workout from My workouts: like a catalog workout, a copy is added to today first. */
  | { kind: 'workout'; id: number; from: BackOrigin | null };

type Props = {
  workout: WorkoutStartEligibility & { title: string; durationSec: number };
  source: WorkoutSource;
  triggerClassName?: string;
};

export function WorkoutStartChooser(props: Props) {
  return canStartWorkout(props.workout) ? <StartControl {...props} /> : null;
}

function StartControl({ workout, source, triggerClassName }: Props) {
  const router = useRouter();
  const app = useRideAppLaunch();
  const catalog = useCatalogRide();
  const dialogId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const openAfterMenu = useRef(false);
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
  const options = runtime ? getWorkoutStartOptions(workout, runtime) : [];
  const busy = catalog.preparation.kind === 'pending';
  const preparedId = catalog.preparation.kind === 'ready' ? catalog.preparation.sessionId : null;
  const sessionId = source.kind === 'session' ? source.id : preparedId;

  function openChooser() {
    app.reset();
    catalog.reset();
    setRuntime({
      os: getRideOs(),
      webBluetooth: isWebBluetoothAvailable(),
      inTempoRide: window.tempoDesktop?.isDesktop === true,
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

  async function choose(mode: (typeof options)[number]['mode']) {
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

  return (
    <>
      {hasProgress ? (
        <Menu onOpenChangeComplete={(menuOpen) => {
          if (!menuOpen && openAfterMenu.current) {
            openAfterMenu.current = false;
            openChooser();
          }
        }}>
          <MenuTrigger ref={triggerRef} className={iconButtonClassName} aria-label="More workout options">
            <Ellipsis aria-hidden="true" size={18} />
          </MenuTrigger>
          <MenuContent align="end">
            <MenuItem onSelect={() => { openAfterMenu.current = true; }}>{label}</MenuItem>
          </MenuContent>
        </Menu>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          className={triggerClassName ?? `${primaryButtonClassName} max-md:min-h-11`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? dialogId : undefined}
          onClick={openChooser}
        >
          {liveSteps ? null : <Play aria-hidden="true" size={15} strokeWidth={1.8} />}
          {label}
        </button>
      )}

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
                  {source.kind !== 'session' ? <span className="mt-1 block">Adds this workout to today.</span> : null}
                </DialogDescription>
              </div>
              <DialogClose type="button" className={iconButtonClassName} aria-label="Close" disabled={busy}>
                <X aria-hidden="true" size={17} />
              </DialogClose>
            </div>

            <div className="-mx-2 space-y-3 overflow-y-auto overscroll-contain px-2 py-4">
              {hasProgress ? <p className="text-sm text-[var(--text-secondary)]">Switching to a ride keeps your Follow along progress here.</p> : null}
              {options.map(({ mode, label: optionLabel, description }) => (
                <div key={mode} className="space-y-1">
                  <button
                    type="button"
                    className={`${secondaryButtonClassName} w-full max-md:min-h-11 justify-start!`}
                    aria-describedby={`${dialogId}-${mode}`}
                    disabled={busy || (mode === 'app' && app.state === 'opening')}
                    onClick={() => { void choose(mode); }}
                  >
                    {optionLabel}
                  </button>
                  <p id={`${dialogId}-${mode}`} className="px-1 text-[13px] leading-relaxed text-[var(--text-secondary)]">
                    {description}
                    {mode === 'app' ? <> <GetTempoRideLink>Don’t have it yet? Get Wattonaut Ride</GetTempoRideLink></> : null}
                  </p>
                </div>
              ))}
              {busy ? <p role="status" className="text-sm text-[var(--text-secondary)]">Adding workout to today…</p> : null}
              {catalog.preparation.kind === 'error' ? (
                <p role="alert" className={dangerTextClassName}>{catalog.preparation.message}</p>
              ) : null}
              {preparedId !== null ? (
                <p role="status" className="flex flex-wrap items-center gap-x-1.5 text-sm text-[var(--text-secondary)]">
                  Added to today.
                  <Link href={withBackOrigin(`/athlete/session/${preparedId}`, source.from)} className={ghostButtonClassName('compact')}>Open workout</Link>
                </p>
              ) : null}
              {app.state === 'opening' ? <p role="status" className="text-sm text-[var(--text-secondary)]">Opening Wattonaut Ride…</p> : null}
              {app.state === 'attempted' && sessionId !== null ? (
                <RideAppInstallHelp os={runtime.os} onRetry={() => openApp(sessionId)} />
              ) : null}
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
