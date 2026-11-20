'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  compactPrimaryButtonClassName,
  compactSecondaryButtonClassName,
  dangerTextClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  successTextClassName,
} from '@/components/ui';
import { Toggle } from '@/components/tempo/Toggle';
import type { ExecutionStep } from '@/lib/athlete-execution';
import { formatDistance } from '@/lib/format-distance';
import { isWebBluetoothAvailable, RideDeviceManager, type RideDeviceRole, type RideDeviceState } from '@/lib/ride/bluetooth';
import { ergTargetChanged, planHasPowerTargets, targetWattsAt, type RidePlan } from '@/lib/ride/ride-plan';
import { planPositionSec, powerBuckets } from '@/lib/ride/ride-chart';
import {
  addReading,
  advanceStep,
  createRecording,
  emptyReading,
  finishRecording,
  pauseRecording,
  planSignature,
  restoreRecording,
  resumeRecording,
  setBias,
  setErg,
  startRecording,
  summarizeRecording,
  tick,
  toImportPayload,
  type RideReading,
  type RideRecording,
} from '@/lib/ride/recorder';
import { clearRideCheckpoint, downloadRideBackup, listStoredRides, saveRideCheckpoint } from '@/lib/ride/recording-store';
import { WorkoutProfileChart } from './WorkoutProfileChart';

const CHECKPOINT_INTERVAL_MS = 5000;
const SAMPLE_INTERVAL_MS = 250;
const SAVE_RETRY_LIMIT = 5;
const subscribeNever = () => () => undefined;

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving'; attempt: number }
  | { kind: 'saved'; note: string | null }
  | { kind: 'failed'; error: string };

function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  const rest = seconds % 60;
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}` : `${minutes}:${String(rest).padStart(2, '0')}`;
}

const display = (value: number | null, digits = 0) => value === null ? '--' : value.toFixed(digits);

function Metric({ label, value, unit, size = 'md', tone }: { label: string; value: string; unit?: string; size?: 'xl' | 'lg' | 'md'; tone?: string }) {
  const sizeClass = size === 'xl' ? 'text-[64px] sm:text-[88px]' : size === 'lg' ? 'text-[40px] sm:text-[52px]' : 'text-[24px] sm:text-[28px]';
  return (
    <div className="min-w-0">
      <p className="text-xs font-medium text-[var(--text-muted)]">{label}</p>
      <p className={`data mt-1 font-medium leading-none tracking-[-0.02em] ${sizeClass}`} style={{ color: tone ?? 'var(--text)' }}>
        {value}
        {unit ? <span className="ml-1.5 text-[13px] font-normal tracking-normal text-[var(--text-secondary)]">{unit}</span> : null}
      </p>
    </div>
  );
}

const ROLE_LABEL: Record<RideDeviceRole, string> = { trainer: 'Trainer / power', heartRate: 'Heart rate', cadence: 'Cadence' };

function DeviceRow({ role, state, onConnect, onDisconnect }: { role: RideDeviceRole; state: RideDeviceState; onConnect: () => void; onDisconnect: () => void }) {
  const statusText = state.status === 'connected'
    ? `${state.name ?? 'Connected'}${state.protocol === 'ftms' ? ' · ERG' : state.protocol === 'cycling-power' ? ' · power only' : ''}`
    : state.status === 'connecting' ? 'Connecting…' : state.status === 'reconnecting' ? state.message ?? 'Reconnecting…' : state.status === 'error' ? state.message ?? 'Connection failed' : 'Not connected';
  const dot = state.status === 'connected' ? 'bg-[var(--status-success)]' : state.status === 'reconnecting' || state.status === 'connecting' ? 'bg-[var(--status-warning)]' : state.status === 'error' ? 'bg-[var(--status-danger)]' : 'bg-[var(--border-strong)]';
  return (
    <li className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-[var(--text)]">{ROLE_LABEL[role]}</p>
        <p className="flex items-center gap-1.5 truncate text-[12px] text-[var(--text-secondary)]"><span aria-hidden="true" className={`inline-block size-2 shrink-0 rounded-full ${dot}`} />{statusText}</p>
      </div>
      {state.status === 'disconnected' || state.status === 'error' ? (
        <button type="button" className={compactSecondaryButtonClassName} onClick={onConnect}>Connect</button>
      ) : (
        <button type="button" className={compactSecondaryButtonClassName} onClick={onDisconnect}>Disconnect</button>
      )}
    </li>
  );
}

export function RideClient({ sessionId, sessionTitle, plan, steps }: {
  sessionId: number;
  sessionTitle: string;
  plan: RidePlan;
  steps: ExecutionStep[];
}) {
  const router = useRouter();
  const [manager] = useState(() => new RideDeviceManager());
  const devices = useSyncExternalStore(manager.subscribe, manager.getSnapshot, manager.getSnapshot);
  const bluetoothAvailable = useSyncExternalStore(subscribeNever, isWebBluetoothAvailable, () => true);
  const [recording, setRecording] = useState<RideRecording>(() => createRecording(sessionId, sessionTitle, plan));
  const [recovered, setRecovered] = useState<{ recording: RideRecording; savedAtMs: number; compatible: boolean } | null>(null);
  const [live, setLive] = useState<RideReading>(emptyReading);
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' });
  const recordingRef = useRef(recording);
  const lastCheckpointRef = useRef(0);
  const lastCommandRef = useRef<{ stepIndex: number; watts: number | null; erg: boolean } | null>(null);
  const uncertainSaveRef = useRef(false);

  const commit = useCallback((next: RideRecording, persist = false) => {
    recordingRef.current = next;
    setRecording(next);
    if (persist && next.timerSec > 0) {
      lastCheckpointRef.current = Date.now();
      saveRideCheckpoint(next);
    }
  }, []);

  // Look for an unfinished ride for this session in this browser or the desktop store.
  useEffect(() => {
    let active = true;
    void listStoredRides().then((rides) => {
      const match = rides.find((ride) => ride.recording.sessionId === sessionId);
      if (!active || !match || recordingRef.current.status !== 'ready') return;
      setRecovered({ recording: match.recording, savedAtMs: match.savedAtMs, compatible: match.recording.planSignature === planSignature(plan) });
    });
    return () => { active = false; };
  }, [plan, sessionId]);

  useEffect(() => () => manager.dispose(), [manager]);

  const status = recording.status;
  const active = status === 'running' || status === 'paused';

  // Sample sensors at 4 Hz; the recorder writes one sample per whole second.
  useEffect(() => {
    if (!active) return;
    const interval = window.setInterval(() => {
      const now = Date.now();
      const reading = manager.getReading(now);
      setLive(reading);
      const current = recordingRef.current;
      const next = tick(addReading(current, reading), plan, now, reading);
      if (next !== current) commit(next, now - lastCheckpointRef.current >= CHECKPOINT_INTERVAL_MS);
    }, SAMPLE_INTERVAL_MS);
    const persistNow = () => { if (recordingRef.current.timerSec > 0) saveRideCheckpoint(recordingRef.current); };
    const onVisibility = () => { if (document.visibilityState === 'hidden') persistNow(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', persistNow);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', persistNow);
    };
  }, [active, commit, manager, plan]);

  // Keep the screen awake while riding; the lock is dropped when the tab hides, so re-acquire.
  useEffect(() => {
    if (status !== 'running' || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const acquire = () => {
      if (document.visibilityState !== 'visible') return;
      navigator.wakeLock.request('screen').then((sentinel) => {
        if (cancelled) void sentinel.release();
        else lock = sentinel;
      }).catch(() => undefined);
    };
    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', acquire);
      void lock?.release().catch(() => undefined);
    };
  }, [status]);

  // Push ERG targets on step changes, ramps (5 W steps), bias and ERG toggles.
  const currentStep = plan.steps[recording.stepIndex];
  const targetWatts = targetWattsAt(currentStep, recording.stepElapsedSec, recording.biasPct);
  useEffect(() => {
    if (!devices.ergAvailable) {
      lastCommandRef.current = null;
      return;
    }
    const erg = status === 'running' && recording.ergEnabled && targetWatts !== null;
    const previous = lastCommandRef.current;
    if (previous && previous.stepIndex === recording.stepIndex && previous.erg === erg && (!erg || !ergTargetChanged(previous.watts, targetWatts))) return;
    lastCommandRef.current = { stepIndex: recording.stepIndex, watts: targetWatts, erg };
    manager.setCommand(erg ? { mode: 'erg', watts: targetWatts! } : { mode: 'free' });
  }, [devices.ergAvailable, manager, recording.ergEnabled, recording.stepIndex, status, targetWatts]);

  const start = useCallback(() => {
    lastCheckpointRef.current = Date.now();
    commit(startRecording(recordingRef.current, plan, Date.now()), true);
  }, [commit, plan]);

  const togglePause = useCallback(() => {
    const current = recordingRef.current;
    const now = Date.now();
    if (current.status === 'running') commit(pauseRecording(current, plan, now, manager.getReading(now)), true);
    else if (current.status === 'paused') commit(resumeRecording(current, plan, now), true);
  }, [commit, manager, plan]);

  const skip = useCallback(() => commit(advanceStep(recordingRef.current, plan), true), [commit, plan]);
  const bias = useCallback((delta: number) => commit(setBias(recordingRef.current, recordingRef.current.biasPct + delta), true), [commit]);
  const toggleErg = useCallback(() => commit(setErg(recordingRef.current, !recordingRef.current.ergEnabled), true), [commit]);

  const save = useCallback(async (): Promise<void> => {
    for (let attempt = 1; ; attempt += 1) {
      setSaveState({ kind: 'saving', attempt });
      let response: Response | null = null;
      try {
        response = await fetch('/api/activity-imports', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(toImportPayload(recordingRef.current)),
        });
      } catch {
        uncertainSaveRef.current = true;
      }
      if (response?.ok) {
        clearRideCheckpoint(sessionId);
        setSaveState({ kind: 'saved', note: null });
        router.refresh();
        return;
      }
      const payload = response ? await response.json().catch(() => ({})) as { error?: string } : {};
      if (response?.status === 409 && (payload.error?.includes('already been imported') || uncertainSaveRef.current)) {
        // An earlier attempt reached the server even though its response was lost.
        clearRideCheckpoint(sessionId);
        setSaveState({ kind: 'saved', note: 'Tempo already had this ride.' });
        router.refresh();
        return;
      }
      const retryable = !response || response.status >= 500 || response.status === 429;
      if (response && response.status >= 500) uncertainSaveRef.current = true;
      if (!retryable || attempt >= SAVE_RETRY_LIMIT) {
        setSaveState({
          kind: 'failed',
          error: response
            ? `${payload.error ?? 'Tempo could not save this ride.'} Your ride is kept on this device.`
            : 'Could not reach Tempo. Your ride is kept on this device; try again when you are online.',
        });
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
    }
  }, [router, sessionId]);

  const finish = useCallback(() => {
    const now = Date.now();
    const finished = finishRecording(recordingRef.current, plan, now, manager.getReading(now));
    commit(finished, true);
    manager.setCommand({ mode: 'free' });
    if (finished.timerSec > 0) void save();
  }, [commit, manager, plan, save]);

  const discard = useCallback(() => {
    clearRideCheckpoint(sessionId);
    setRecovered(null);
    uncertainSaveRef.current = false;
    setSaveState({ kind: 'idle' });
    commit(createRecording(sessionId, sessionTitle, plan));
  }, [commit, plan, sessionId, sessionTitle]);

  // Keyboard: space pause/resume, N next step, E toggle ERG, +/- intensity.
  useEffect(() => {
    if (!active) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.metaKey || event.ctrlKey || event.altKey || target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (event.key === ' ') { event.preventDefault(); togglePause(); }
      else if (event.key === 'n' || event.key === 'N') skip();
      else if (event.key === 'e' || event.key === 'E') toggleErg();
      else if (event.key === '+' || event.key === '=') bias(1);
      else if (event.key === '-' || event.key === '_') bias(-1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, bias, skip, toggleErg, togglePause]);

  const anyDevice = (['trainer', 'heartRate', 'cadence'] as const).some((role) => devices[role].status !== 'disconnected');
  const lostDevices = (['trainer', 'heartRate', 'cadence'] as const).filter((role) => devices[role].status === 'reconnecting');
  const stepLabel = (index: number) => steps[index]?.label ?? (index >= plan.steps.length ? 'Free ride' : `Step ${index + 1}`);
  const stepRemaining = currentStep ? currentStep.durationSec - recording.stepElapsedSec : null;
  const nextStep = plan.steps[recording.stepIndex + 1];
  const nextTarget = targetWattsAt(nextStep, 0, recording.biasPct);
  const threeSecond = (() => {
    const values = recording.samples.slice(-3).map((sample) => sample.p).filter((value): value is number => value !== null);
    return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : live.powerWatts;
  })();
  const domainSec = Math.max(plan.totalSec, planPositionSec(recording, plan));
  const powerTone = threeSecond === null || targetWatts === null ? undefined
    : threeSecond > targetWatts + Math.max(10, targetWatts * 0.05) ? 'var(--status-warning)'
    : threeSecond < targetWatts - Math.max(10, targetWatts * 0.05) ? 'var(--status-danger)' : 'var(--status-success)';

  const devicePanel = bluetoothAvailable ? (
    <ul className="divide-y divide-[var(--border)]">
      {(['trainer', 'heartRate', 'cadence'] as const).map((role) => (
        <DeviceRow key={role} role={role} state={devices[role]} onConnect={() => void manager.connect(role)} onDisconnect={() => manager.disconnect(role)} />
      ))}
    </ul>
  ) : (
    <p role="status" className="text-[13px] leading-relaxed text-[var(--text-secondary)]">
      This browser cannot connect to Bluetooth trainers (Safari and Firefox do not support Web Bluetooth). Use Chrome or Edge on desktop or Android, or the Tempo Ride desktop app.
      You can still ride with targets only.
    </p>
  );

  if (recovered && status === 'ready') {
    const summary = summarizeRecording(recovered.recording, plan.ftpWatts);
    return (
      <section aria-label="Unfinished ride" className="space-y-4">
        <div>
          <h2 className="text-base font-medium text-[var(--text)]">Unfinished ride found</h2>
          <p className="mt-1 text-[13px] text-[var(--text-secondary)]">
            Last saved {new Date(recovered.savedAtMs).toLocaleString()} · <span className="data">{formatClock(summary.timerSec)}</span> recorded
            {summary.averagePowerWatts !== null ? <> · <span className="data">{summary.averagePowerWatts} W</span> average</> : null}
          </p>
          {!recovered.compatible ? <p className="mt-1 text-[13px] text-[var(--status-warning)]">The workout changed since this ride was recorded, so it cannot be resumed. You can still save it.</p> : null}
        </div>
        <div className="flex flex-wrap gap-3">
          {recovered.compatible && recovered.recording.status !== 'finished' ? (
            <button type="button" className={primaryButtonClassName} onClick={() => { commit(restoreRecording(recovered.recording)); setRecovered(null); }}>Resume</button>
          ) : null}
          <button
            type="button"
            className={recovered.compatible && recovered.recording.status !== 'finished' ? secondaryButtonClassName : primaryButtonClassName}
            onClick={() => {
              commit(finishRecording(restoreRecording(recovered.recording), plan, recovered.savedAtMs), true);
              setRecovered(null);
              void save();
            }}
          >
            Save what I have
          </button>
          <button type="button" className={secondaryButtonClassName} onClick={() => downloadRideBackup(recovered.recording)}>Download backup (JSON)</button>
          <button type="button" className={secondaryButtonClassName} onClick={() => { if (window.confirm('Discard this unsaved ride? This cannot be undone.')) discard(); }}>Discard</button>
        </div>
      </section>
    );
  }

  if (status === 'finished') {
    const summary = summarizeRecording(recording, plan.ftpWatts);
    return (
      <section aria-label="Ride summary" className="space-y-6">
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 border-y border-[var(--border)] py-5 sm:grid-cols-4">
          <Metric label="Ride time" value={formatClock(summary.timerSec)} />
          <Metric label="Elapsed" value={formatClock(summary.elapsedSec)} />
          <Metric label="Average power" value={display(summary.averagePowerWatts)} unit="W" />
          <Metric label="Normalized power" value={display(summary.normalizedPowerWatts)} unit="W" />
          <Metric label="Max power" value={display(summary.maxPowerWatts)} unit="W" />
          <Metric label="Average HR" value={display(summary.averageHeartRateBpm)} unit="bpm" />
          <Metric label="Average cadence" value={display(summary.averageCadenceRpm)} unit="rpm" />
          <Metric label="Work" value={display(summary.workKj)} unit="kJ" />
          <Metric label="Training load" value={display(summary.tss)} unit="TSS" />
          <Metric label="Intensity factor" value={display(summary.intensityFactor, 2)} />
          <Metric label="Distance" value={summary.distanceMeters > 0 ? formatDistance(summary.distanceMeters) : '--'} />
          <Metric label="Moving time" value={formatClock(summary.movingSec)} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {saveState.kind === 'saved' ? (
            <Link href={`/athlete/session/${sessionId}`} className={primaryButtonClassName}>View session</Link>
          ) : (
            <button type="button" className={primaryButtonClassName} disabled={saveState.kind === 'saving'} onClick={() => void save()}>
              {saveState.kind === 'saving' ? (saveState.attempt > 1 ? `Retrying (${saveState.attempt})…` : 'Saving…') : saveState.kind === 'failed' ? 'Try again' : 'Save to Tempo'}
            </button>
          )}
          <button type="button" className={secondaryButtonClassName} onClick={() => downloadRideBackup(recording)}>Download backup (JSON)</button>
          {saveState.kind !== 'saved' ? (
            <button type="button" className={secondaryButtonClassName} onClick={() => { if (window.confirm('Discard this ride without saving?')) discard(); }}>Discard</button>
          ) : null}
        </div>
        {saveState.kind === 'saved' ? <p role="status" className={successTextClassName}>Ride saved and the session is marked complete.{saveState.note ? ` ${saveState.note}` : ''}</p> : null}
        {saveState.kind === 'failed' ? <p role="alert" className={dangerTextClassName}>{saveState.error}</p> : null}
        {saveState.kind !== 'saved' ? <p className="text-[12px] text-[var(--text-muted)]">The ride stays on this device until Tempo confirms it is saved.</p> : null}
      </section>
    );
  }

  if (status === 'ready') {
    return (
      <section aria-label="Ride setup" className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <WorkoutProfileChart plan={plan} positionSec={0} buckets={[]} domainSec={plan.totalSec} />
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className={primaryButtonClassName} onClick={start}>
              {anyDevice ? 'Start ride' : 'Start with targets only'}
            </button>
            <span className="text-[12px] text-[var(--text-muted)]">Space pauses · N skips a step · E toggles ERG · +/− adjusts intensity</span>
          </div>
          {!planHasPowerTargets(plan) ? (
            <p className="text-[13px] text-[var(--text-secondary)]">
              {plan.ftpWatts ? 'This workout has no power targets, so the trainer stays in free ride.' : 'Add FTP in Profile to turn %FTP targets into watts. Until then the trainer stays in free ride.'}
            </p>
          ) : null}
        </div>
        <div className="space-y-2">
          <h2 className="text-[13px] font-medium text-[var(--text)]">Devices</h2>
          {devicePanel}
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Ride" className="space-y-5">
      {lostDevices.length ? (
        <p role="status" className="rounded-lg border border-[var(--status-warning-border)] bg-[var(--status-warning-tint)] px-3 py-2 text-[13px] text-[var(--text)]">
          {lostDevices.map((role) => ROLE_LABEL[role]).join(' and ')} disconnected. Recording continues; reconnecting automatically…
        </p>
      ) : null}

      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--text-muted)]">{status === 'paused' ? 'Paused' : 'Now'}</p>
          <p className="truncate text-[18px] font-medium text-[var(--text)]">{stepLabel(recording.stepIndex)}</p>
        </div>
        <p className="text-[13px] text-[var(--text-secondary)]">
          Next: {nextStep ? <>{stepLabel(recording.stepIndex + 1)}{nextTarget !== null ? <span className="data"> · {nextTarget} W</span> : null}</> : currentStep ? 'Finish' : 'Free ride continues'}
        </p>
      </div>

      {anyDevice ? (
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 border-y border-[var(--border)] py-5 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1"><Metric label="Power · 3 s" value={display(threeSecond)} unit="W" size="xl" tone={powerTone} /></div>
          <Metric label={recording.ergEnabled ? 'Target · ERG' : 'Target'} value={display(targetWatts)} unit="W" size="lg" />
          <Metric label="Interval left" value={stepRemaining === null ? '--' : formatClock(stepRemaining)} size="lg" />
          <Metric label="Heart rate" value={display(live.heartRateBpm)} unit="bpm" />
          <Metric label="Cadence" value={display(live.cadenceRpm)} unit="rpm" />
          <Metric label="Speed" value={live.speedMetersPerSecond === null ? '--' : (live.speedMetersPerSecond * 3.6).toFixed(1)} unit="km/h" />
          <Metric label="Elapsed" value={formatClock(recording.timerSec)} />
          <Metric label="Power · live" value={display(live.powerWatts)} unit="W" />
          <Metric label="Distance" value={recording.distanceMeters > 0 ? formatDistance(recording.distanceMeters) : '--'} />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 border-y border-[var(--border)] py-5 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="col-span-2 md:col-span-1"><Metric label="Interval left" value={stepRemaining === null ? '--' : formatClock(stepRemaining)} size="xl" /></div>
          <Metric label="Target" value={display(targetWatts)} unit="W" size="lg" />
          <Metric label="Elapsed" value={formatClock(recording.timerSec)} size="lg" />
        </div>
      )}

      <WorkoutProfileChart plan={plan} positionSec={planPositionSec(recording, plan)} buckets={powerBuckets(recording, plan, domainSec)} domainSec={domainSec} />

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={compactPrimaryButtonClassName} onClick={togglePause} aria-keyshortcuts="Space">{status === 'paused' ? 'Resume' : 'Pause'}</button>
        <button type="button" className={compactSecondaryButtonClassName} onClick={skip} disabled={!currentStep} aria-keyshortcuts="N">Skip step</button>
        <span className="inline-flex items-center gap-1" aria-label="Intensity bias">
          <button type="button" className={compactSecondaryButtonClassName} onClick={() => bias(-1)} aria-label="Decrease intensity 1%" aria-keyshortcuts="-">−</button>
          <span className="data min-w-[3.5rem] text-center text-[13px] text-[var(--text)]">{recording.biasPct > 0 ? '+' : ''}{recording.biasPct}%</span>
          <button type="button" className={compactSecondaryButtonClassName} onClick={() => bias(1)} aria-label="Increase intensity 1%" aria-keyshortcuts="+">+</button>
        </span>
        {devices.ergAvailable ? (
          <span className="inline-flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
            ERG <Toggle checked={recording.ergEnabled} onChange={toggleErg} label="ERG mode" />
          </span>
        ) : null}
        <button type="button" className={`${compactSecondaryButtonClassName} ml-auto`} onClick={() => { if (window.confirm('Finish this ride?')) finish(); }}>Finish ride</button>
      </div>

      <details className="border-t border-[var(--border)] pt-3">
        <summary className="cursor-pointer text-[13px] font-medium text-[var(--text-secondary)]">Devices</summary>
        <div className="mt-2 max-w-md">{devicePanel}</div>
      </details>
    </section>
  );
}
