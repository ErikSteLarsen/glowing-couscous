'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import Link from 'next/link';
import { Maximize, Minimize, Minus, Pause, Play, Plus, SkipForward, Square } from 'lucide-react';
import { BackLink, buttonFocusClassName, primaryButtonClassName, secondaryButtonClassName } from '@/components/ui';
import type { BackTarget } from '@/lib/app-navigation';
import { Toggle } from '@/components/tempo/Toggle';
import { UnsavedRidesNotice } from '@/components/UnsavedRidesNotice';
import { MAX_ACTIVITY_IMPORT_DURATION_SEC } from '@/lib/activity-import-limits';
import type { ExecutionStep } from '@/lib/athlete-execution';
import { formatDistance } from '@/lib/format-distance';
import { intensityColor } from '@/lib/intensity-color';
import { zoneForHeartRateBpm } from '@/lib/profile-training-zones';
import { isWebBluetoothAvailable, RideDeviceManager, type RideDeviceRole, type RideDeviceState } from '@/lib/ride/bluetooth';
import { ergTargetChanged, planHasPowerTargets, targetWattsAt, type RidePlan } from '@/lib/ride/ride-plan';
import { complianceTone, planPositionSec, powerBuckets, stepIntensityZone } from '@/lib/ride/ride-chart';
import {
  advanceStep,
  createRecording,
  currentLapStats,
  emptyReading,
  finishRecording,
  pauseRecording,
  planSignature,
  recordReading,
  restoreRecording,
  resumeRecording,
  setBias,
  setErg,
  startRecording,
  summarizeLaps,
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
const ROLES = ['trainer', 'heartRate', 'cadence'] as const;
const subscribeNever = () => () => undefined;
const PROFILE_FTP_HREF = '/profile#training-metrics';

/** "90.5-100% FTP" → ["90.5-100", "% FTP"], so the number can carry the hero size. */
function splitPrescription(label: string | null): [string, string] {
  const match = label?.match(/^([\d.\-–]+)\s*(.*)$/);
  return match ? [match[1], match[2]] : [label ?? '', ''];
}

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

const display = (value: number | null | undefined, digits = 0) => value === null || value === undefined ? '--' : value.toFixed(digits);

const TONE_VAR = { on: 'var(--ride-on)', over: 'var(--ride-over)', under: 'var(--ride-under)', none: 'var(--text)' } as const;

function subscribeFullscreen(onChange: () => void) {
  document.addEventListener('fullscreenchange', onChange);
  return () => document.removeEventListener('fullscreenchange', onChange);
}

const ROLE_LABEL: Record<RideDeviceRole, string> = { trainer: 'Trainer / power', heartRate: 'Heart rate', cadence: 'Cadence' };
const ROLE_SHORT: Record<RideDeviceRole, string> = { trainer: 'Trainer', heartRate: 'HR', cadence: 'Cadence' };

function deviceDot(state: RideDeviceState) {
  return state.status === 'connected' ? 'bg-[var(--status-success)]'
    : state.status === 'reconnecting' || state.status === 'connecting' ? 'bg-[var(--status-warning)] motion-safe:animate-pulse'
    : state.status === 'error' ? 'bg-[var(--status-danger)]' : 'bg-[var(--border-strong)]';
}

function deviceStatusText(state: RideDeviceState) {
  return state.status === 'connected'
    ? `${state.name ?? 'Connected'}${state.protocol === 'ftms' ? ' · ERG' : state.protocol === 'cycling-power' ? ' · power only' : ''}`
    : state.status === 'connecting' ? 'Connecting…' : state.status === 'reconnecting' ? state.message ?? 'Reconnecting…' : state.status === 'error' ? state.message ?? 'Connection failed' : 'Not connected';
}

const chipClassName = `inline-flex h-9 items-center gap-2 rounded-full border border-[var(--border)] px-3 text-[12px] font-medium text-[var(--text-secondary)] ${buttonFocusClassName}`;
const iconControlClassName = `inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border-strong)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--raised)] hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40 ${buttonFocusClassName}`;

function DeviceChip({ role, state, canConnect, onConnect }: { role: RideDeviceRole; state: RideDeviceState; canConnect: boolean; onConnect: () => void }) {
  const short = state.status === 'connected' ? 'On' : state.status === 'reconnecting' ? 'Reconnecting' : state.status === 'connecting' ? 'Connecting' : state.status === 'error' ? 'Failed' : 'Off';
  const content = (
    <>
      <span aria-hidden="true" className={`size-2 rounded-full ${deviceDot(state)}`} />
      <span className="text-[var(--text)]">{ROLE_SHORT[role]}</span>
      <span className="hidden xl:inline">{short}</span>
    </>
  );
  const title = `${ROLE_LABEL[role]}: ${deviceStatusText(state)}`;
  if (canConnect && (state.status === 'disconnected' || state.status === 'error')) {
    return <button type="button" className={`${chipClassName} hover:border-[var(--border-strong)] hover:text-[var(--text)]`} title={`Connect ${ROLE_LABEL[role].toLowerCase()}`} aria-label={`${title}. Connect`} onClick={onConnect}>{content}</button>;
  }
  return <span className={chipClassName} title={title} role="status" aria-label={title}>{content}</span>;
}

function DeviceRow({ role, state, onConnect, onDisconnect }: { role: RideDeviceRole; state: RideDeviceState; onConnect: () => void; onDisconnect: () => void }) {
  const idle = state.status === 'disconnected' || state.status === 'error';
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-[14px] font-medium text-[var(--text)]">{ROLE_LABEL[role]}</p>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-[12px] text-[var(--text-secondary)]"><span aria-hidden="true" className={`inline-block size-2 shrink-0 rounded-full ${deviceDot(state)}`} />{deviceStatusText(state)}</p>
      </div>
      <button type="button" className={`${secondaryButtonClassName} !h-9 !min-h-9 px-3 text-[13px]`} onClick={idle ? onConnect : onDisconnect}>{idle ? 'Connect' : 'Disconnect'}</button>
    </li>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="data inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-[var(--border-strong)] px-1.5 text-[11px] text-[var(--text)]">{children}</kbd>;
}

function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <p className={`text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)] ${className}`}>{children}</p>;
}

function Stat({ label, value, unit, tone }: { label: string; value: string; unit?: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">{label}</p>
      <p className="ride-numeral mt-1.5 truncate text-[clamp(1.375rem,1.1rem+0.9vw,2.25rem)]" style={tone ? { color: tone } : undefined}>
        {value}{unit ? <span className="ml-1 text-[0.45em] font-normal tracking-normal text-[var(--text-muted)]">{unit}</span> : null}
      </p>
    </div>
  );
}

function ProgressBar({ value, label, color = 'var(--brand)', className = 'h-2' }: { value: number; label: string; color?: string; className?: string }) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className={`w-full overflow-hidden rounded-full bg-[var(--raised)] ${className}`}>
      <div className="ride-state-bar h-full rounded-full" style={{ width: `${percent}%`, background: color }} />
    </div>
  );
}

export function RideClient({ userId, sessionId, sessionTitle, plan, plannedTss, steps, back, heartRateMaxBpm }: {
  userId: number;
  sessionId: number;
  sessionTitle: string;
  plan: RidePlan;
  plannedTss: number;
  steps: ExecutionStep[];
  back: BackTarget;
  heartRateMaxBpm: number | null;
}) {
  const [manager] = useState(() => new RideDeviceManager());
  const devices = useSyncExternalStore(manager.subscribe, manager.getSnapshot, manager.getSnapshot);
  const bluetoothAvailable = useSyncExternalStore(subscribeNever, isWebBluetoothAvailable, () => true);
  const fullscreen = useSyncExternalStore(subscribeFullscreen, () => Boolean(document.fullscreenElement), () => false);
  const fullscreenSupported = useSyncExternalStore(subscribeNever, () => Boolean(document.fullscreenEnabled), () => false);
  const [recording, setRecording] = useState<RideRecording>(() => createRecording(sessionId, sessionTitle, plan));
  const [recovered, setRecovered] = useState<{ recording: RideRecording; savedAtMs: number; compatible: boolean } | null>(null);
  const [live, setLive] = useState<RideReading>(emptyReading);
  const [saveState, setSaveState] = useState<SaveState>({ kind: 'idle' });
  const recordingRef = useRef(recording);
  const lastCheckpointRef = useRef(0);
  const lastCommandRef = useRef<{ stepIndex: number; watts: number | null; erg: boolean; biasPct: number } | null>(null);
  const pendingSaveRef = useRef<AbortController | null>(null);
  const savedRef = useRef(false);

  useEffect(() => () => pendingSaveRef.current?.abort(), []);

  const commit = useCallback((next: RideRecording, persist = false) => {
    recordingRef.current = next;
    setRecording(next);
    if (persist && next.timerSec > 0) {
      lastCheckpointRef.current = Date.now();
      saveRideCheckpoint(userId, next);
    }
  }, [userId]);

  // Look for an unfinished ride for this session in this browser or the desktop store.
  useEffect(() => {
    let active = true;
    void listStoredRides(userId, sessionId).then(([match]) => {
      if (!active || !match || recordingRef.current.status !== 'ready') return;
      setRecovered({ recording: match.recording, savedAtMs: match.savedAtMs, compatible: match.recording.planSignature === planSignature(plan) });
    });
    return () => { active = false; };
  }, [userId, plan, sessionId]);

  useEffect(() => {
    manager.activate();
    return () => manager.dispose();
  }, [manager]);

  const status = recording.status;
  const active = status === 'running' || status === 'paused';

  useEffect(() => {
    if (!active) return;
    const unsubscribe = manager.subscribeReadings((now) => {
      const current = recordingRef.current;
      if (current.status !== 'running') return;
      const next = recordReading(current, plan, now, manager.getReading(now));
      if (next.timerSec !== current.timerSec || next.elapsedSec !== current.elapsedSec) {
        commit(next, next.status === 'finished' || now - lastCheckpointRef.current >= CHECKPOINT_INTERVAL_MS);
      } else {
        recordingRef.current = next;
      }
    });
    const syncClock = (persist = false) => {
      const current = recordingRef.current;
      if (current.status !== 'running' && current.status !== 'paused') return;
      const now = Date.now();
      const reading = manager.getReading(now);
      if (!persist) setLive(reading);
      const next = tick(current, plan, now, reading);
      if (next !== current || persist) commit(next, persist || next.status === 'finished' || now - lastCheckpointRef.current >= CHECKPOINT_INTERVAL_MS);
    };
    const interval = window.setInterval(syncClock, SAMPLE_INTERVAL_MS);
    const onPageHide = () => syncClock(true);
    const onVisibility = () => syncClock(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      unsubscribe();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
      const current = recordingRef.current;
      if (current.status === 'running' || current.status === 'paused') {
        const now = Date.now();
        const next = tick(current, plan, now, manager.getReading(now));
        if (next.timerSec > 0) saveRideCheckpoint(userId, next);
      }
    };
  }, [userId, active, commit, manager, plan]);

  // Keep the screen awake while riding; the lock is dropped when the tab hides, so re-acquire.
  useEffect(() => {
    if (status !== 'running' || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    let requesting = false;
    const acquire = () => {
      if (document.visibilityState !== 'visible' || requesting || (lock && !lock.released)) return;
      requesting = true;
      void navigator.wakeLock.request('screen').then((sentinel) => {
        if (cancelled || document.visibilityState !== 'visible') return sentinel.release();
        lock = sentinel;
      }).catch(() => undefined).finally(() => { requesting = false; });
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
  const { biasPct, ergEnabled } = recording;
  const currentStep = plan.steps[recording.stepIndex];
  const { stepIndex: commandStepIndex } = recording;
  const targetWatts = targetWattsAt(currentStep, recording.stepElapsedSec, recording.biasPct);
  useEffect(() => {
    if (status === 'ready') {
      lastCommandRef.current = null;
      manager.setCommand(null);
      return;
    }
    const erg = status === 'running' && ergEnabled && targetWatts !== null;
    const previous = lastCommandRef.current;
    const threshold = previous?.biasPct === biasPct ? 5 : 1;
    if (previous && previous.stepIndex === commandStepIndex && previous.erg === erg && (!erg || !ergTargetChanged(previous.watts, targetWatts, threshold))) return;
    lastCommandRef.current = { stepIndex: commandStepIndex, watts: targetWatts, erg, biasPct };
    manager.setCommand(erg ? { mode: 'erg', watts: targetWatts } : { mode: 'free' });
  }, [biasPct, commandStepIndex, ergEnabled, manager, status, targetWatts]);

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

  const skip = useCallback(() => {
    const now = Date.now();
    commit(advanceStep(recordingRef.current, plan, now, manager.getReading(now)), true);
  }, [commit, manager, plan]);
  const bias = useCallback((delta: number) => {
    const now = Date.now();
    const current = tick(recordingRef.current, plan, now, manager.getReading(now));
    commit(setBias(current, current.biasPct + delta), true);
  }, [commit, manager, plan]);
  const toggleErg = useCallback(() => {
    const now = Date.now();
    const current = tick(recordingRef.current, plan, now, manager.getReading(now));
    commit(setErg(current, !current.ergEnabled), true);
  }, [commit, manager, plan]);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    else void document.documentElement.requestFullscreen().catch(() => undefined);
  }, []);

  const save = useCallback(async (): Promise<void> => {
    const current = recordingRef.current;
    if (pendingSaveRef.current || savedRef.current || current.status !== 'finished' || current.timerSec === 0) return;
    const operation = new AbortController();
    pendingSaveRef.current = operation;
    const { signal } = operation;

    try {
      const body = JSON.stringify(toImportPayload(current));
      for (let attempt = 1; !signal.aborted; attempt += 1) {
        setSaveState({ kind: 'saving', attempt });
        let response: Response | null = null;
        try {
          response = await fetch('/api/activity-imports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
            signal,
          });
        } catch {
          // A lost response can be retried with the same import fingerprint.
        }
        const payload = response ? await response.json().catch(() => null) : null;
        if (signal.aborted) return;
        if (response?.ok && payload?.sessionId === sessionId) {
          savedRef.current = true;
          clearRideCheckpoint(userId, sessionId);
          setSaveState({ kind: 'saved', note: payload.duplicate === true ? 'Tempo already had this ride.' : null });
          return;
        }
        const retryable = !response || response.status >= 500 || response.status === 429;
        if (!retryable || attempt >= SAVE_RETRY_LIMIT) {
          const error = response?.ok ? 'Tempo could not confirm the save for this session.'
            : typeof payload?.error === 'string' ? payload.error
              : response ? 'Tempo could not save this ride.' : 'Could not reach Tempo.';
          setSaveState({ kind: 'failed', error: `${error} Your ride is kept on this device.` });
          return;
        }
        await new Promise<void>((resolve) => {
          const done = () => {
            window.clearTimeout(timer);
            signal.removeEventListener('abort', done);
            resolve();
          };
          const timer = window.setTimeout(done, 1000 * 2 ** attempt);
          signal.addEventListener('abort', done, { once: true });
        });
      }
    } catch {
      setSaveState({ kind: 'failed', error: 'Tempo could not prepare the upload. Your ride is kept on this device.' });
    } finally {
      pendingSaveRef.current = null;
    }
  }, [userId, sessionId]);

  const finish = useCallback(() => {
    const current = recordingRef.current;
    if (current.status !== 'running' && current.status !== 'paused') return;
    const now = Date.now();
    const finished = finishRecording(current, plan, now, manager.getReading(now));
    commit(finished, true);
    if (finished.timerSec > 0) void save();
  }, [commit, manager, plan, save]);

  const discard = useCallback(() => {
    if (pendingSaveRef.current || savedRef.current) return;
    clearRideCheckpoint(userId, sessionId);
    setRecovered(null);
    setSaveState({ kind: 'idle' });
    commit(createRecording(sessionId, sessionTitle, plan));
  }, [userId, commit, plan, sessionId, sessionTitle]);

  // Keyboard: space pause/resume, N next step, E toggle ERG, +/- intensity, F fullscreen.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.metaKey || event.ctrlKey || event.altKey || target?.closest('input, textarea, select, button, a, [contenteditable="true"]')) return;
      if ((event.key === 'f' || event.key === 'F') && document.fullscreenEnabled) { toggleFullscreen(); return; }
      if (!active) return;
      if (event.key === ' ') { event.preventDefault(); togglePause(); }
      else if (event.key === 'n' || event.key === 'N') skip();
      else if (event.key === 'e' || event.key === 'E') toggleErg();
      else if (event.key === '+' || event.key === '=') bias(1);
      else if (event.key === '-' || event.key === '_') bias(-1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, bias, skip, toggleErg, toggleFullscreen, togglePause]);

  // Workout-level stats are recomputed once per recorded second (when samples change), not per 4 Hz sample.
  const { samples, laps: recordedLaps, timerSec, elapsedSec, movingSec, distanceMeters, stepIndex, stepElapsedSec } = recording;
  const summary = useMemo(
    () => summarizeRecording({ ...recording, samples, laps: recordedLaps, timerSec, elapsedSec, movingSec, distanceMeters }, plan.ftpWatts),
    [samples, recordedLaps, timerSec, elapsedSec, movingSec, distanceMeters, plan.ftpWatts], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const lap = useMemo(() => currentLapStats({ samples, laps: recordedLaps }), [samples, recordedLaps]);
  const positionSec = planPositionSec({ stepIndex, stepElapsedSec, timerSec, laps: recordedLaps }, plan);
  const domainSec = Math.max(plan.totalSec, positionSec);
  const buckets = useMemo(
    () => powerBuckets({ ...recording, samples, laps: recordedLaps, timerSec }, plan, domainSec),
    [samples, recordedLaps, timerSec, plan, domainSec], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const anyDevice = ROLES.some((role) => devices[role].status !== 'disconnected');
  const lostDevices = ROLES.filter((role) => devices[role].status === 'reconnecting');
  const stepLabel = (index: number) => steps[index]?.label ?? (index >= plan.steps.length ? 'Free ride' : `Step ${index + 1}`);
  const connect = (role: RideDeviceRole) => void manager.connect(role);

  const backLink = <BackLink target={back} variant="compact" />;
  const fullscreenButton = fullscreenSupported ? (
    <button type="button" className={iconControlClassName} onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit full screen' : 'Full screen'} title={`${fullscreen ? 'Exit full screen' : 'Full screen'} (F)`} aria-pressed={fullscreen}>
      {fullscreen ? <Minimize aria-hidden="true" size={18} strokeWidth={1.6} /> : <Maximize aria-hidden="true" size={18} strokeWidth={1.6} />}
    </button>
  ) : null;
  const deviceChips = (
    <div className="flex items-center gap-1.5" aria-label="Devices">
      {ROLES.map((role) => <DeviceChip key={role} role={role} state={devices[role]} canConnect={bluetoothAvailable} onConnect={() => connect(role)} />)}
    </div>
  );

  const frame = (stateLabel: string, controls: ReactNode, body: ReactNode, label: string) => (
    <div className="ride-mode flex min-h-dvh flex-col">
      <header className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--border)] px-3 py-2 sm:px-5">
        <div className="flex min-w-0 flex-1 basis-40 items-center gap-2">
          {backLink}
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-medium text-[var(--text)]">{sessionTitle}</h1>
            <p className="truncate text-[12px] text-[var(--text-muted)]">{stateLabel}</p>
          </div>
        </div>
        {deviceChips}
        {controls ? (
          <div className="flex flex-wrap items-center gap-2 max-xl:basis-full sm:gap-3">
            {controls}
            {fullscreenButton}
          </div>
        ) : fullscreenButton}
      </header>
      <main id="ride" aria-label={label} className="flex min-h-0 flex-1 flex-col">{body}</main>
    </div>
  );

  const devicePanel = bluetoothAvailable ? (
    <ul className="divide-y divide-[var(--border)]">
      {ROLES.map((role) => <DeviceRow key={role} role={role} state={devices[role]} onConnect={() => connect(role)} onDisconnect={() => manager.disconnect(role)} />)}
    </ul>
  ) : (
    <p role="status" className="py-3 text-[13px] leading-relaxed text-[var(--text-secondary)]">
      This browser cannot connect to Bluetooth trainers (Safari and Firefox do not support Web Bluetooth). Use Chrome or Edge on desktop or Android, or the Tempo Ride desktop app. You can still ride with targets only.
    </p>
  );

  if (recovered && status === 'ready') {
    const recoveredSummary = summarizeRecording(recovered.recording, plan.ftpWatts);
    const canResume = recovered.compatible && recovered.recording.status !== 'finished';
    return frame('Unfinished ride', null, (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-5 py-10">
        <div>
          <h2 className="text-[28px] font-medium tracking-[-0.02em] text-[var(--text)]">Unfinished ride found</h2>
          <p className="mt-2 text-[14px] text-[var(--text-secondary)]">Last saved {new Date(recovered.savedAtMs).toLocaleString()}.</p>
          {!recovered.compatible ? <p className="mt-2 text-[14px] text-[var(--status-warning)]">The workout changed since this ride was recorded, so it cannot be resumed. You can still save it.</p> : null}
        </div>
        <div className="grid grid-cols-3 gap-6 border-y border-[var(--border)] py-6">
          <Stat label="Recorded" value={formatClock(recoveredSummary.timerSec)} />
          <Stat label="Avg power" value={display(recoveredSummary.averagePowerWatts)} unit="W" />
          <Stat label="Avg HR" value={display(recoveredSummary.averageHeartRateBpm)} unit="bpm" />
        </div>
        <div className="flex flex-wrap gap-3">
          {canResume ? <button type="button" className={primaryButtonClassName} onClick={() => { commit(restoreRecording(recovered.recording)); setRecovered(null); }}>Resume ride</button> : null}
          <button
            type="button"
            className={canResume ? secondaryButtonClassName : primaryButtonClassName}
            onClick={() => {
              commit(finishRecording(restoreRecording(recovered.recording), plan, recovered.savedAtMs), true);
              setRecovered(null);
              void save();
            }}
          >
            Save what I have
          </button>
          <button type="button" className={secondaryButtonClassName} onClick={() => downloadRideBackup(recovered.recording)}>Download backup</button>
          <button type="button" className={`${secondaryButtonClassName} sm:ml-auto`} onClick={() => { if (window.confirm('Discard this unsaved ride? This cannot be undone.')) discard(); }}>Discard</button>
        </div>
      </div>
    ), 'Unfinished ride');
  }

  if (status === 'finished') {
    const lapRows = summarizeLaps(recording).filter((entry) => entry.durationSec > 0);
    const saveButton = saveState.kind === 'saved' ? (
      <Link href={back.href} className={primaryButtonClassName}>View session</Link>
    ) : (
      <button type="button" className={primaryButtonClassName} disabled={saveState.kind === 'saving'} onClick={() => void save()}>
        {saveState.kind === 'saving' ? (saveState.attempt > 1 ? `Retrying (${saveState.attempt})…` : 'Saving…') : saveState.kind === 'failed' ? 'Try again' : 'Save to Tempo'}
      </button>
    );
    return frame('Ride complete', null, (
      <div className="mx-auto w-full max-w-[1400px] space-y-10 px-4 py-8 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h2 className="text-[clamp(1.75rem,1.4rem+1.2vw,2.5rem)] font-medium tracking-[-0.02em] text-[var(--text)]">Ride complete</h2>
            <div className="mt-2 min-h-5 text-[14px]">
              {saveState.kind === 'saved' ? <p role="status" className="text-[var(--status-success)]">Saved. The session is marked complete.{saveState.note ? ` ${saveState.note}` : ''}</p> : null}
              {saveState.kind === 'failed' ? <p role="alert" className="text-[var(--status-danger)]">{saveState.error}</p> : null}
              {saveState.kind === 'saving' ? <p role="status" className="text-[var(--text-secondary)]">Saving to Tempo…</p> : null}
              {timerSec >= MAX_ACTIVITY_IMPORT_DURATION_SEC ? <p className="text-[var(--text-secondary)]">This ride reached the 36-hour recording limit.</p> : null}
            {saveState.kind === 'idle' ? <p className="text-[var(--text-secondary)]">The ride stays on this device until Tempo confirms it is saved.</p> : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {saveButton}
            <button type="button" className={secondaryButtonClassName} onClick={() => downloadRideBackup(recording)}>Download backup</button>
            {saveState.kind !== 'saved' ? <button type="button" className={secondaryButtonClassName} disabled={saveState.kind === 'saving'} onClick={() => { if (window.confirm('Discard this ride without saving?')) discard(); }}>Discard</button> : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-8 gap-y-6 border-y border-[var(--border)] py-6 sm:grid-cols-4 xl:grid-cols-6">
          <Stat label="Ride time" value={formatClock(summary.timerSec)} />
          <Stat label="Avg power" value={display(summary.averagePowerWatts)} unit="W" />
          <Stat label="Normalized" value={display(summary.normalizedPowerWatts)} unit="W" />
          <Stat label="Work" value={display(summary.workKj)} unit="kJ" />
          <Stat label="TSS" value={display(summary.tss)} />
          <Stat label="IF" value={display(summary.intensityFactor, 2)} />
          <Stat label="Avg HR" value={display(summary.averageHeartRateBpm)} unit="bpm" />
          <Stat label="Max HR" value={display(summary.maxHeartRateBpm)} unit="bpm" />
          <Stat label="Max power" value={display(summary.maxPowerWatts)} unit="W" />
          <Stat label="Avg cadence" value={display(summary.averageCadenceRpm)} unit="rpm" />
          <Stat label="Distance" value={summary.distanceMeters > 0 ? formatDistance(summary.distanceMeters) : '--'} />
          <Stat label="Elapsed" value={formatClock(summary.elapsedSec)} />
        </div>

        <section aria-label="Workout profile">
          <WorkoutProfileChart plan={plan} positionSec={null} buckets={buckets} domainSec={domainSec} heartRateMaxBpm={heartRateMaxBpm} className="h-52 sm:h-64" />
        </section>

        <section aria-labelledby="ride-intervals" className="pt-4">
          <h3 id="ride-intervals" className="text-[16px] font-medium text-[var(--text)]">Intervals</h3>
          {lapRows.length ? (
            <div className="mt-3 overflow-x-auto">
              <table className="data w-full min-w-[640px] text-left text-[14px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    <th scope="col" className="py-2 pr-4 font-medium">Interval</th>
                    <th scope="col" className="py-2 pr-4 text-right font-medium">Time</th>
                    <th scope="col" className="py-2 pr-4 text-right font-medium">Target</th>
                    <th scope="col" className="py-2 pr-4 text-right font-medium">Avg power</th>
                    <th scope="col" className="py-2 pr-4 text-right font-medium">vs target</th>
                    <th scope="col" className="py-2 pr-4 text-right font-medium">Max power</th>
                    <th scope="col" className="py-2 text-right font-medium">Avg HR</th>
                  </tr>
                </thead>
                <tbody>
                  {lapRows.map((entry, index) => {
                    const step = plan.steps[entry.stepIndex];
                    const tone = complianceTone(entry.averagePowerWatts, entry.averageTargetWatts);
                    const delta = entry.averagePowerWatts !== null && entry.averageTargetWatts !== null ? entry.averagePowerWatts - entry.averageTargetWatts : null;
                    return (
                      <tr key={`${entry.stepIndex}-${index}`} className="border-b border-[var(--border)] text-[var(--text)]">
                        <td className="py-2.5 pr-4">
                          <span className="inline-flex items-center gap-2.5">
                            <span aria-hidden="true" className="h-4 w-1 rounded-full" style={{ background: step ? intensityColor(stepIntensityZone(step, plan.ftpWatts)) : 'var(--text-muted)' }} />
                            <span className="font-sans">{stepLabel(entry.stepIndex)}</span>
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-right">{formatClock(entry.durationSec)}</td>
                        <td className="py-2.5 pr-4 text-right text-[var(--text-secondary)]">{entry.averageTargetWatts !== null ? `${entry.averageTargetWatts} W` : '--'}</td>
                        <td className="py-2.5 pr-4 text-right">{entry.averagePowerWatts !== null ? `${entry.averagePowerWatts} W` : '--'}</td>
                        <td className="py-2.5 pr-4 text-right" style={{ color: tone === 'none' ? 'var(--text-muted)' : TONE_VAR[tone] }}>
                          {delta === null ? '--' : `${delta > 0 ? '+' : delta < 0 ? '−' : '±'}${Math.abs(delta)} W`}
                        </td>
                        <td className="py-2.5 pr-4 text-right text-[var(--text-secondary)]">{entry.maxPowerWatts !== null ? `${entry.maxPowerWatts} W` : '--'}</td>
                        <td className="py-2.5 text-right">{entry.averageHeartRateBpm !== null ? `${entry.averageHeartRateBpm}` : '--'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <p className="mt-2 text-[14px] text-[var(--text-secondary)]">No intervals were recorded.</p>}
        </section>
      </div>
    ), 'Ride summary');
  }

  if (status === 'ready') {
    const intervalCount = plan.steps.filter((step) => step.kind !== 'pause' && step.durationSec > 0).length;
    return frame('Ready to ride', null, (
      <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex min-w-0 flex-col gap-8 px-4 py-8 sm:px-8">
          <UnsavedRidesNotice userId={userId} excludeSessionId={sessionId} />
          <div>
            <h2 className="text-[clamp(1.75rem,1.3rem+1.6vw,3rem)] font-medium leading-tight tracking-[-0.025em] text-[var(--text)]">{sessionTitle}</h2>
            <div className="mt-6 grid max-w-2xl grid-cols-2 gap-6 sm:grid-cols-4">
              <Stat label="Duration" value={formatClock(plan.totalSec)} />
              <Stat label="Intervals" value={String(intervalCount)} />
              <Stat label="FTP" value={display(plan.ftpWatts)} unit={plan.ftpWatts ? 'W' : undefined} />
              <Stat label="Planned TSS" value={display(plannedTss)} />
            </div>
          </div>
          <section aria-label="Workout profile" className="flex min-h-[220px] flex-1 flex-col pb-6">
            <WorkoutProfileChart plan={plan} positionSec={null} buckets={[]} domainSec={plan.totalSec} heartRateMaxBpm={heartRateMaxBpm} className="min-h-[200px] flex-1" />
          </section>
          {!planHasPowerTargets(plan) ? (
            <p className="text-[14px] text-[var(--status-warning)]">
              {plan.ftpWatts ? 'This workout has no power targets, so the trainer stays in free ride.' : <><Link href={PROFILE_FTP_HREF} className="underline underline-offset-2">Add FTP in Profile</Link> to turn %FTP targets into watts. Until then the trainer stays in free ride.</>}
            </p>
          ) : null}
        </div>
        <aside className="flex flex-col gap-8 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-8 sm:px-8 lg:border-l lg:border-t-0">
          <section aria-labelledby="ride-devices">
            <h2 id="ride-devices" className="text-[16px] font-medium text-[var(--text)]">Devices</h2>
            <p className="mt-1 text-[13px] text-[var(--text-secondary)]">Connect a smart trainer for ERG control, or ride to the targets on your own.</p>
            <div className="mt-3">{devicePanel}</div>
          </section>
          <div className="space-y-3">
            <button type="button" className={`${primaryButtonClassName} !h-14 w-full gap-2 text-[16px]`} onClick={start}>
              <Play aria-hidden="true" size={18} strokeWidth={1.8} />
              {anyDevice ? 'Start ride' : 'Start with targets only'}
            </button>
            {!anyDevice ? <p className="text-[13px] text-[var(--text-muted)]">Without a trainer, Tempo times each interval and shows its target. Connect devices any time from the top bar.</p> : null}
          </div>
          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 text-[13px] text-[var(--text-secondary)] lg:mt-auto">
            <dt><Kbd>Space</Kbd></dt><dd>Pause or resume</dd>
            <dt><Kbd>N</Kbd></dt><dd>Skip to next interval</dd>
            <dt><Kbd>E</Kbd></dt><dd>Toggle ERG</dd>
            <dt className="flex gap-1"><Kbd>+</Kbd><Kbd>−</Kbd></dt><dd>Adjust intensity 1%</dd>
            <dt><Kbd>F</Kbd></dt><dd>Full screen</dd>
          </dl>
        </aside>
      </div>
    ), 'Ride setup');
  }

  // Riding.
  const hasPower = threeSecondPower(recording, live) !== null;
  const threeSecond = threeSecondPower(recording, live);
  const tone = complianceTone(threeSecond, targetWatts);
  const toneColor = TONE_VAR[tone];
  const delta = threeSecond !== null && targetWatts !== null ? threeSecond - targetWatts : null;
  // Without FTP there are no watts, but the %FTP prescription is still the target to ride.
  const prescribedTarget = targetWatts === null ? steps[recording.stepIndex]?.prescribedTarget ?? null : null;
  const [prescribedValue, prescribedUnit] = splitPrescription(prescribedTarget);
  const toneText = tone === 'on' ? 'On target' : tone === 'over' ? 'Above target' : tone === 'under' ? 'Below target' : targetWatts === null ? (prescribedTarget ? `Target ${prescribedTarget}` : 'Free ride') : 'No power';
  const stepRemaining = currentStep ? currentStep.durationSec - recording.stepElapsedSec : null;
  const stepProgress = currentStep && currentStep.durationSec > 0 ? recording.stepElapsedSec / currentStep.durationSec : 0;
  const nextStep = plan.steps[recording.stepIndex + 1];
  const nextTarget = targetWattsAt(nextStep, 0, recording.biasPct);
  const nextPrescription = steps[recording.stepIndex + 1]?.prescribedTarget ?? null;
  const remainingSec = Math.max(0, plan.totalSec - positionSec);
  const hrZone = live.heartRateBpm !== null ? zoneForHeartRateBpm(live.heartRateBpm, heartRateMaxBpm) : null;
  const deviation = delta !== null && targetWatts ? Math.max(-1, Math.min(1, delta / Math.max(20, targetWatts * 0.25))) : null;
  const intervalColor = currentStep ? (currentStep.kind === 'pause' ? 'var(--text-muted)' : intensityColor(stepIntensityZone(currentStep, plan.ftpWatts))) : 'var(--brand)';
  const heroNumeral = 'ride-numeral text-[clamp(4rem,min(9vw,16.5vh),10.25rem)]';

  const controls = (
    <>
      <div className="flex items-center gap-1" role="group" aria-label="Intensity">
        <button type="button" className={iconControlClassName} onClick={() => bias(-1)} aria-label="Decrease intensity 1%" aria-keyshortcuts="-" title="Decrease intensity (−)"><Minus aria-hidden="true" size={16} strokeWidth={1.8} /></button>
        <span className="data min-w-[3.75rem] text-center text-[14px] font-medium text-[var(--text)]" aria-live="polite" title="Intensity bias">{recording.biasPct > 0 ? '+' : recording.biasPct < 0 ? '−' : ''}{Math.abs(recording.biasPct)}%</span>
        <button type="button" className={iconControlClassName} onClick={() => bias(1)} aria-label="Increase intensity 1%" aria-keyshortcuts="+" title="Increase intensity (+)"><Plus aria-hidden="true" size={16} strokeWidth={1.8} /></button>
      </div>
      {devices.ergAvailable ? (
        <span className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--text-secondary)]">ERG<Toggle checked={recording.ergEnabled} onChange={toggleErg} label="ERG mode" /></span>
      ) : null}
      <span aria-hidden="true" className="hidden h-6 w-px bg-[var(--border)] xl:block" />
      <button type="button" className={`${iconControlClassName} sm:max-xl:ml-auto`} onClick={skip} disabled={!currentStep} aria-label="Skip to next interval" aria-keyshortcuts="N" title="Skip interval (N)"><SkipForward aria-hidden="true" size={17} strokeWidth={1.7} /></button>
      <button type="button" className={`${status === 'paused' ? primaryButtonClassName : secondaryButtonClassName} !h-10 gap-2`} onClick={togglePause} aria-keyshortcuts="Space">
        {status === 'paused' ? <Play aria-hidden="true" size={16} strokeWidth={1.8} /> : <Pause aria-hidden="true" size={16} strokeWidth={1.8} />}
        {status === 'paused' ? 'Resume' : 'Pause'}
      </button>
      <button type="button" className={`${secondaryButtonClassName} !h-10 gap-2`} onClick={() => { if (window.confirm('Finish this ride?')) finish(); }}>
        <Square aria-hidden="true" size={14} strokeWidth={1.8} />Finish
      </button>
    </>
  );

  return frame(status === 'paused' ? 'Paused' : anyDevice ? 'Riding' : 'Riding · targets only', controls, (
    <>
      {lostDevices.length ? (
        <p role="status" className="border-b border-[var(--status-warning-border)] bg-[var(--status-warning-tint)] px-5 py-2 text-[13px] text-[var(--text)] sm:px-7">
          {lostDevices.map((role) => ROLE_LABEL[role]).join(' and ')} disconnected. Recording continues; reconnecting automatically…
        </p>
      ) : null}
      {status === 'paused' ? (
        <p role="status" className="border-b border-[var(--border)] bg-[var(--raised)] px-5 py-2 text-[13px] text-[var(--text)] sm:px-7">Paused. The timer is stopped; press <Kbd>Space</Kbd> to resume.</p>
      ) : null}

      <div className="grid gap-px bg-[var(--border)] md:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.72fr)]">
        {/* Power vs target */}
        <section aria-label="Power" className="relative flex min-w-0 flex-col gap-4 bg-[var(--background)] px-5 pb-5 pt-6 sm:px-7">
          <div aria-hidden="true" className="ride-state-bar absolute inset-x-0 top-0 h-1" style={{ background: hasPower ? toneColor : 'var(--border)' }} />
          {hasPower ? (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <Label>Power · 3 s</Label>
                <p className="text-[14px] font-medium" style={{ color: tone === 'none' ? 'var(--text-secondary)' : toneColor }} aria-live="polite">
                  {toneText}{delta !== null && tone !== 'on' ? <span className="data"> {delta > 0 ? '+' : '−'}{Math.abs(delta)} W</span> : null}
                </p>
              </div>
              <p className={heroNumeral} style={{ color: tone === 'none' ? 'var(--text)' : toneColor }}>
                {display(threeSecond)}<span className="ml-2 text-[0.22em] font-normal tracking-normal text-[var(--text-muted)]">W</span>
              </p>
              <div className="mt-auto space-y-3">
                <div className="flex items-baseline gap-3">
                  <Label>{recording.ergEnabled && devices.ergAvailable ? 'Target · ERG' : 'Target'}</Label>
                  <p className="ride-numeral text-[clamp(2.25rem,min(4.1vw,7.5vh),4.5rem)]">{prescribedTarget ? prescribedValue : display(targetWatts)}<span className="ml-1.5 text-[0.4em] font-normal tracking-normal text-[var(--text-muted)]">{prescribedTarget ? prescribedUnit : 'W'}</span></p>
                </div>
                {deviation !== null ? (
                  <div className="relative h-2 rounded-full bg-[var(--raised)]" role="meter" aria-label="Power versus target" aria-valuemin={-100} aria-valuemax={100} aria-valuenow={Math.round(deviation * 100)}>
                    <span aria-hidden="true" className="absolute left-1/2 top-[-4px] h-4 w-px bg-[var(--text-muted)]" />
                    <span aria-hidden="true" className="ride-state-bar absolute top-0 h-2 rounded-full" style={{ left: `${50 + Math.min(0, deviation) * 50}%`, width: `${Math.abs(deviation) * 50}%`, background: toneColor }} />
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-baseline justify-between gap-3">
                <Label>{targetWatts === null && !prescribedTarget ? 'Free ride' : 'Target'}</Label>
                <p className="text-[13px] text-[var(--text-muted)]">{anyDevice ? 'Waiting for power' : 'Targets only'}</p>
              </div>
              {prescribedTarget ? (
                <p className={heroNumeral}>{prescribedValue}<span className="ml-2 text-[0.22em] font-normal tracking-normal text-[var(--text-muted)]">{prescribedUnit}</span></p>
              ) : (
                <p className={heroNumeral}>{targetWatts === null ? (currentStep ? `Z${currentStep.zone}` : '--') : targetWatts}{targetWatts !== null ? <span className="ml-2 text-[0.22em] font-normal tracking-normal text-[var(--text-muted)]">W</span> : null}</p>
              )}
              <p className="mt-auto text-[14px] text-[var(--text-secondary)]">
                {prescribedTarget ? <>Ride this by feel in Z{currentStep?.zone}. <Link href={PROFILE_FTP_HREF} className="text-[var(--text)] underline underline-offset-2">Add FTP in Profile</Link> to see watts.</> : targetWatts === null ? 'Ride by feel in this zone.' : plan.ftpWatts ? `${Math.round((targetWatts / plan.ftpWatts) * 100)}% of FTP. Hold this on your trainer.` : 'Hold this on your trainer.'}
                {recording.biasPct !== 0 ? <span className="data"> Intensity {recording.biasPct > 0 ? '+' : '−'}{Math.abs(recording.biasPct)}%.</span> : null}
              </p>
            </>
          )}
        </section>

        {/* Current interval */}
        <section aria-label="Current interval" className="relative flex min-w-0 flex-col gap-4 bg-[var(--background)] px-5 pb-5 pt-6 sm:px-7">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1" style={{ background: intervalColor }} />
          <div className="flex items-baseline justify-between gap-3">
            <p className="truncate text-[clamp(1rem,0.85rem+0.5vw,1.375rem)] font-medium text-[var(--text)]">{stepLabel(recording.stepIndex)}</p>
            <p className="data shrink-0 text-[13px] text-[var(--text-muted)]">{currentStep ? `${recording.stepIndex + 1} / ${plan.steps.length}` : 'After plan'}</p>
          </div>
          <div>
            <Label>{currentStep ? 'Interval left' : 'Free ride'}</Label>
            <p className={`${heroNumeral} mt-2`} aria-live="off">{stepRemaining === null ? formatClock(recording.timerSec - (recording.laps.at(-1)?.startSec ?? 0)) : formatClock(stepRemaining)}</p>
          </div>
          <ProgressBar value={stepProgress} label="Interval progress" color={intervalColor} />
          <div className="mt-auto grid grid-cols-3 gap-4">
            <Stat label="Int avg" value={display(lap?.averagePowerWatts)} unit="W" tone={lap?.averagePowerWatts !== null && lap?.averageTargetWatts !== null && lap ? TONE_VAR[complianceTone(lap.averagePowerWatts, lap.averageTargetWatts)] : undefined} />
            <Stat label="Int avg HR" value={display(lap?.averageHeartRateBpm)} unit="bpm" />
            <Stat label="Int max" value={display(lap?.maxPowerWatts)} unit="W" />
          </div>
          <div className="flex items-baseline justify-between gap-3 border-t border-[var(--border)] pt-3 text-[14px]">
            <span className="text-[var(--text-muted)]">Next</span>
            <span className="min-w-0 truncate text-right text-[var(--text)]">
              {nextStep ? <>{stepLabel(recording.stepIndex + 1)}<span className="data text-[var(--text-secondary)]">{nextTarget !== null ? ` · ${nextTarget} W` : nextPrescription ? ` · ${nextPrescription}` : ` · Z${nextStep.zone}`} · {formatClock(nextStep.durationSec)}</span></> : currentStep ? 'Finish' : 'Free ride continues'}
            </span>
          </div>
        </section>

        {/* Heart rate and cadence */}
        <div className="grid gap-px bg-[var(--border)] max-lg:md:col-span-2 max-lg:md:grid-cols-2 lg:grid-rows-2">
          <section aria-label="Heart rate" className="flex min-w-0 flex-col gap-2 bg-[var(--background)] px-5 pb-5 pt-6 sm:px-7">
            <div className="flex items-center justify-between gap-2">
              <Label>Heart rate</Label>
              {hrZone ? <span className="data rounded-md px-2 py-0.5 text-[13px] font-semibold text-[var(--signal-ink)]" style={{ background: intensityColor(hrZone) }}>I-{hrZone}</span> : null}
            </div>
            <p className="ride-numeral text-[clamp(3.5rem,min(7vw,13vh),8.25rem)]" style={hrZone ? { color: 'var(--ride-hr)' } : undefined}>
              {display(live.heartRateBpm)}<span className="ml-1.5 text-[0.28em] font-normal tracking-normal text-[var(--text-muted)]">bpm</span>
            </p>
            {devices.heartRate.status === 'disconnected' && live.heartRateBpm === null ? <p className="mt-auto text-[12px] text-[var(--text-muted)]">No heart-rate sensor</p> : null}
          </section>
          <section aria-label="Cadence" className="flex min-w-0 flex-col gap-2 bg-[var(--background)] px-5 pb-5 pt-6 sm:px-7">
            <Label>Cadence</Label>
            <p className="ride-numeral text-[clamp(3.5rem,min(7vw,13vh),8.25rem)]">
              {display(live.cadenceRpm)}<span className="ml-1.5 text-[0.28em] font-normal tracking-normal text-[var(--text-muted)]">rpm</span>
            </p>
            {live.cadenceRpm === null && !anyDevice ? <p className="mt-auto text-[12px] text-[var(--text-muted)]">No cadence sensor</p> : null}
          </section>
        </div>
      </div>

      {/* Workout totals */}
      <section aria-label="Workout" className="border-y border-[var(--border)] px-5 py-4 sm:px-7">
        <ProgressBar value={plan.totalSec > 0 ? positionSec / plan.totalSec : 0} label="Workout progress" className="h-1" />
        <div className="mt-4 grid grid-cols-4 gap-x-6 gap-y-4 lg:grid-cols-8">
          <Stat label="Elapsed" value={formatClock(recording.timerSec)} />
          <Stat label="Remaining" value={formatClock(remainingSec)} />
          <Stat label="Avg power" value={display(summary.averagePowerWatts)} unit="W" />
          <Stat label="NP" value={display(summary.normalizedPowerWatts)} unit="W" />
          <Stat label="Work" value={display(summary.workKj, 0)} unit="kJ" />
          <Stat label="TSS" value={plan.ftpWatts ? display(summary.tss) : '--'} />
          <Stat label="IF" value={plan.ftpWatts ? display(summary.intensityFactor, 2) : '--'} />
          <Stat label="Avg HR" value={display(summary.averageHeartRateBpm)} unit="bpm" />
        </div>
      </section>

      {/* Profile */}
      <section aria-label="Workout profile" className="flex min-h-[180px] flex-1 flex-col px-5 pb-8 pt-4 sm:px-7">
        <WorkoutProfileChart plan={plan} positionSec={positionSec} buckets={buckets} domainSec={domainSec} heartRateMaxBpm={heartRateMaxBpm} activeStepIndex={currentStep ? recording.stepIndex : null} className="min-h-[150px] flex-1" />
      </section>
    </>
  ), 'Ride');
}

function threeSecondPower(recording: RideRecording, live: RideReading): number | null {
  const values = recording.samples.slice(-3).map((sample) => sample.p).filter((value): value is number => value !== null);
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : live.powerWatts;
}
