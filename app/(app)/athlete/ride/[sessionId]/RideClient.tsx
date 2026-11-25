'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, Ellipsis, Maximize, Minimize, Minus, Pause, Play, Plus, Popcorn, SkipBack, SkipForward, Square } from 'lucide-react';
import { BackLink, buttonFocusClassName, primaryButtonClassName, secondaryButtonClassName } from '@/components/ui';
import type { BackTarget } from '@/lib/app-navigation';
import { UnsavedRidesNotice } from '@/components/UnsavedRidesNotice';
import { GetTempoRideLink } from '@/components/RideAppLaunch';
import { MAX_ACTIVITY_IMPORT_DURATION_SEC } from '@/lib/activity-import-limits';
import type { ExecutionStep } from '@/lib/athlete-execution';
import { formatDistance } from '@/lib/format-distance';
import { intensityColor } from '@/lib/intensity-color';
import { isWebBluetoothAvailable, RideDeviceManager, type RideDeviceRole, type RideDeviceState } from '@/lib/ride/bluetooth';
import { ergTargetChanged, planHasPowerTargets, targetWattsAt, type RidePlan } from '@/lib/ride/ride-plan';
import { complianceTone, planPositionSec, powerBuckets, shortDuration, stepIntensityZone } from '@/lib/ride/ride-chart';
import {
  advanceStep,
  previousStep,
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
import { StravaPostAction } from '@/components/StravaPostAction';
import { EntertainmentStage, type YouTubeInbox } from '@/components/ride/entertainment/EntertainmentStage';
import { EntertainmentMenu } from '@/components/ride/entertainment/EntertainmentMenu';
import type { ActivityCheck, EntertainmentMode, EntertainmentRide, TrackActivity } from '@/components/ride/entertainment/types';
import { useYouTubeInbox, type IncomingYouTubeVideo } from '@/components/ride/entertainment/youtube/use-youtube-inbox';

const CHECKPOINT_INTERVAL_MS = 5000;
const SAMPLE_INTERVAL_MS = 250;
const SAVE_RETRY_LIMIT = 5;
const ROLES = ['trainer', 'heartRate', 'cadence'] as const;
const subscribeNever = () => () => undefined;
const PROFILE_FTP_HREF = '/profile#cycling';
const MORE_DATA_KEY = 'tempo.ride.moreData';
const PHONE_QUERY = '(max-width: 639px)';
const ENTERTAINMENT_KEY = 'tempo.ride.entertainment';

/** Off, or on with a chosen view. Remembered per browser. */
type EntertainmentSetting = 'off' | EntertainmentMode;
type SentVideo = { videoId: string; startSec?: number };
/** A change of view waiting for the rider's answer, with the video that asked for it, if any. */
type PendingSwitch = { to: EntertainmentSetting; video?: SentVideo };

function readEntertainment(): EntertainmentSetting {
  try {
    const value = typeof window === 'undefined' ? null : window.localStorage.getItem(ENTERTAINMENT_KEY);
    return value === 'youtube' || value === 'course' ? value : 'off';
  } catch {
    return 'off';
  }
}

function subscribePhone(onChange: () => void) {
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

type SaveState =
  | { kind: 'idle' }
  | { kind: 'saving'; attempt: number }
  | { kind: 'saved'; note: string | null; activityId: number | null }
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

function deviceDot(state: RideDeviceState) {
  return state.status === 'connected' ? 'bg-[var(--status-success)]'
    : state.status === 'reconnecting' || state.status === 'connecting' ? 'bg-[var(--status-warning)] motion-safe:animate-pulse'
    : state.status === 'error' ? 'bg-[var(--status-danger)]' : 'bg-[var(--border-strong)]';
}

function deviceStatusText(state: RideDeviceState) {
  return state.status === 'connected'
    ? `${state.name ?? 'Connected'}${state.protocol === 'cycling-power' ? ', power only' : ''}`
    : state.status === 'connecting' ? 'Connecting…' : state.status === 'reconnecting' ? state.message ?? 'Reconnecting…' : state.status === 'error' ? state.message ?? 'Connection failed' : 'Not connected';
}

const iconControlClassName = `inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-[var(--border-strong)] text-[var(--text-secondary)] transition-colors enabled:hover:bg-[var(--raised)] enabled:hover:text-[var(--text)] disabled:cursor-not-allowed disabled:opacity-40 ${buttonFocusClassName}`;

function DeviceRow({ role, state, onConnect, onDisconnect }: { role: RideDeviceRole; state: RideDeviceState; onConnect: () => void; onDisconnect: () => void }) {
  const idle = state.status === 'disconnected' || state.status === 'error';
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="text-[14px] font-medium text-[var(--text)]">{ROLE_LABEL[role]}</p>
        <p className="mt-0.5 flex items-center gap-1.5 break-words text-[12px] text-[var(--text-secondary)]"><span aria-hidden="true" className={`inline-block size-2 shrink-0 rounded-full ${deviceDot(state)}`} />{deviceStatusText(state)}</p>
      </div>
      <button type="button" className={`${secondaryButtonClassName} shrink-0`} aria-label={`${idle ? 'Connect' : 'Disconnect'} ${ROLE_LABEL[role].toLowerCase()}`} onClick={idle ? onConnect : onDisconnect}>{idle ? 'Connect' : 'Disconnect'}</button>
    </li>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="data inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-[var(--border-strong)] px-1.5 text-[11px] text-[var(--text)]">{children}</kbd>;
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-muted)]">{label}</p>
      <p className="ride-numeral mt-1.5 truncate text-[clamp(1.375rem,1.1rem+0.9vw,2.25rem)]">
        {value}{unit ? <span className="ml-1 text-[0.45em] font-normal tracking-normal text-[var(--text-muted)]">{unit}</span> : null}
      </p>
    </div>
  );
}

/** A clock with its label underneath, so several in a row can't be mistaken for each other. */
function RideClock({ label, value, primary = false }: { label: string; value: string; primary?: boolean }) {
  return (
    <div className="flex flex-col-reverse gap-1 text-right">
      <dt className="whitespace-nowrap text-[12px] leading-none text-[var(--text-secondary)]">{label}</dt>
      <dd className={`ride-numeral !leading-none ${primary ? 'text-[1.75rem]' : 'text-xl !text-[var(--text-secondary)]'}`}>{value}</dd>
    </div>
  );
}

function ColumnHeading({ id, title, detail }: { id: string; title: string; detail?: string }) {
  return (
    <div className="mb-4 flex items-baseline gap-3">
      <h2 id={id} className="shrink-0 text-lg font-medium text-[var(--text)]">{title}</h2>
      {detail ? <p className="min-w-0 truncate text-sm text-[var(--text-secondary)]" title={detail}>{detail}</p> : null}
    </div>
  );
}

function ColumnClock({ value, detail }: { value: string; detail: string }) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
      <span className="ride-numeral !leading-none text-[2.75rem] xl:text-[3.5rem]">{value}</span>
      <span className="text-base text-[var(--text-secondary)]">{detail}</span>
    </p>
  );
}

function RideMetric({ label, value, unit, size, color }: {
  label: string;
  value: string;
  unit?: string;
  size: string;
  color?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-[var(--text-secondary)]">{label}</dt>
      <dd className="mt-2 flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
        <span className={`ride-numeral !leading-none ${size}`} style={{ color }}>{value}</span>
        {unit ? <span className="text-sm text-[var(--text-muted)]">{unit}</span> : null}
      </dd>
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

function switchConsequence(leavingVideo: boolean): string {
  if (!leavingVideo) return 'Tempo keeps your place on the loop.';
  if (window.tempoDesktop) return 'It starts over when you come back.';
  return 'Tempo keeps your place in it for this ride.';
}

function switchLabel({ to, video }: PendingSwitch): string {
  if (video) return 'Play the video';
  if (to === 'youtube') return 'Switch to YouTube';
  return to === 'course' ? 'Switch to the course' : 'Back to data only';
}

export function RideClient({ userId, sessionId, sessionTitle, plan, plannedTss, steps, back, sessionHref, notPlanned, heartRateMaxBpm }: {
  userId: number;
  sessionId: number;
  sessionTitle: string;
  plan: RidePlan;
  plannedTss: number;
  steps: ExecutionStep[];
  back: BackTarget;
  sessionHref: string;
  /** Started without planning it: in the Calendar only once this ride is saved. */
  notPlanned: boolean;
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
  const connectionsRef = useRef<HTMLDialogElement>(null);
  const phoneSheetRef = useRef<HTMLDialogElement>(null);
  // Open dialogs cover the entertainment stage; YouTube pauses and hides its player meanwhile.
  const [connectionsOpen, setConnectionsOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const openConnections = useCallback(() => {
    connectionsRef.current?.showModal();
    setConnectionsOpen(true);
  }, []);
  const finishDialogRef = useRef<HTMLDialogElement>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const openFinish = useCallback(() => {
    finishDialogRef.current?.showModal();
    setFinishOpen(true);
  }, []);
  const attachFinishDialog = useCallback((node: HTMLDialogElement | null) => {
    finishDialogRef.current = node;
    if (!node) setFinishOpen(false);
  }, []);
  const openSheet = useCallback(() => {
    phoneSheetRef.current?.showModal();
    setSheetOpen(true);
  }, []);
  // A layout swap (phone and desktop) unmounts an open dialog without a close event.
  const attachConnections = useCallback((node: HTMLDialogElement | null) => {
    connectionsRef.current = node;
    if (!node) setConnectionsOpen(false);
  }, []);
  const attachSheet = useCallback((node: HTMLDialogElement | null) => {
    phoneSheetRef.current = node;
    if (!node) setSheetOpen(false);
  }, []);
  const isPhone = useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE_QUERY).matches, () => false);
  // The live view never renders on the server, so reading storage here cannot cause a hydration mismatch.
  const [moreData, setMoreData] = useState(() => {
    try { return typeof window !== 'undefined' && window.localStorage.getItem(MORE_DATA_KEY) === '1'; } catch { return false; }
  });
  const toggleMoreData = useCallback(() => setMoreData((open) => {
    try { window.localStorage.setItem(MORE_DATA_KEY, open ? '0' : '1'); } catch { /* preference only */ }
    return !open;
  }), []);

  // Like More data, entertainment only shows in the live view, which never renders on the server.
  const [entertainment, setEntertainmentState] = useState<EntertainmentSetting>(readEntertainment);
  const setEntertainment = useCallback((next: EntertainmentSetting) => {
    try { window.localStorage.setItem(ENTERTAINMENT_KEY, next); } catch { /* preference only */ }
    setEntertainmentState(next);
  }, []);
  // Turning it back on returns to the last view.
  const lastModeRef = useRef<EntertainmentMode | null>(entertainment === 'off' ? null : entertainment);
  useEffect(() => {
    if (entertainment !== 'off') lastModeRef.current = entertainment;
  }, [entertainment]);
  const [entertainmentMenuOpen, setEntertainmentMenuOpen] = useState(false);

  // Leaving a video that plays or a course under way asks first.
  const activityRef = useRef<ActivityCheck | null>(null);
  const trackActivity = useCallback<TrackActivity>((check) => { activityRef.current = check; }, []);
  const switchDialogRef = useRef<HTMLDialogElement>(null);
  const [pendingSwitch, setPendingSwitch] = useState<PendingSwitch | null>(null);
  const attachSwitchDialog = useCallback((node: HTMLDialogElement | null) => {
    switchDialogRef.current = node;
    if (!node) setPendingSwitch(null);
  }, []);
  const requestEntertainment = useCallback((to: EntertainmentSetting, video?: SentVideo) => {
    if (to === entertainment) return;
    if (!activityRef.current?.()) {
      setEntertainment(to);
      return;
    }
    // Asked again (another video sent meanwhile): the dialog stays and takes the newer request.
    setPendingSwitch({ to, video });
    if (!switchDialogRef.current?.open) switchDialogRef.current?.showModal();
  }, [entertainment, setEntertainment]);
  const toggleEntertainment = useCallback(() => {
    if (entertainment !== 'off') requestEntertainment('off');
    else if (isPhone) setEntertainment('course');
    else if (lastModeRef.current) setEntertainment(lastModeRef.current);
    else setEntertainmentMenuOpen(true);
  }, [entertainment, isPhone, requestEntertainment, setEntertainment]);

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

  // A YouTube video brought in from outside Tempo (Send to Tempo bookmark, a link sent to the
  // Tempo Ride app, a dropped or pasted link) turns on the YouTube view and waits there until the
  // view takes it. Desktop only: phones have no YouTube view.
  const [incomingVideo, setIncomingVideo] = useState<IncomingYouTubeVideo | null>(null);
  const incomingSeqRef = useRef(0);
  const deliverVideo = useCallback((video: SentVideo | null) => {
    incomingSeqRef.current += 1;
    setIncomingVideo({ seq: incomingSeqRef.current, videoId: video?.videoId ?? null, ...(video?.startSec ? { startSec: video.startSec } : {}) });
  }, []);
  const receiveVideo = useCallback((video: SentVideo | null) => {
    if (video && entertainment === 'course' && activityRef.current?.()) {
      requestEntertainment('youtube', video);
      return;
    }
    deliverVideo(video);
    if (video) setEntertainment('youtube');
  }, [deliverVideo, entertainment, requestEntertainment, setEntertainment]);
  const confirmSwitch = () => {
    if (!pendingSwitch) return;
    if (pendingSwitch.video) deliverVideo(pendingSwitch.video);
    setEntertainment(pendingSwitch.to);
    switchDialogRef.current?.close();
  };
  const takeIncomingVideo = useCallback((seq: number) => {
    setIncomingVideo((current) => (current?.seq === seq ? null : current));
  }, []);
  const { dragActive } = useYouTubeInbox(active && !isPhone, receiveVideo);
  const youTubeInbox = useMemo<YouTubeInbox>(
    () => ({ incoming: incomingVideo, onIncomingTaken: takeIncomingVideo, dragActive }),
    [incomingVideo, takeIncomingVideo, dragActive],
  );

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
  const goBack = useCallback(() => {
    const now = Date.now();
    commit(previousStep(recordingRef.current, plan, now, manager.getReading(now)), true);
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
          setSaveState({
            kind: 'saved',
            note: payload.duplicate === true ? 'This ride was already saved.' : null,
            activityId: Number.isSafeInteger(payload.activityId) ? payload.activityId : null,
          });
          return;
        }
        const retryable = !response || response.status >= 500 || response.status === 429;
        if (!retryable || attempt >= SAVE_RETRY_LIMIT) {
          const error = response?.ok ? 'Tempo could not confirm that this ride was saved.'
            : typeof payload?.error === 'string' ? payload.error
              : response ? 'Tempo could not save this ride.' : 'Could not reach Tempo.';
          setSaveState({ kind: 'failed', error: `${error} Your ride is still on this device.` });
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
      setSaveState({ kind: 'failed', error: 'Tempo could not get this ride ready to save. Your ride is still on this device.' });
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

  // Keyboard: space pause/resume, N next step, B previous step, E toggle ERG, +/- intensity, F fullscreen.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (connectionsRef.current?.open || switchDialogRef.current?.open || finishDialogRef.current?.open || phoneSheetRef.current?.open || event.metaKey || event.ctrlKey || event.altKey || target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      // A focused control keeps its native Space activation; letter shortcuts still work after a click.
      if (event.key === ' ' && target?.closest('button, a, summary')) return;
      if ((event.key === 'f' || event.key === 'F') && document.fullscreenEnabled) { toggleFullscreen(); return; }
      if (!active) return;
      if (event.key === ' ') { event.preventDefault(); togglePause(); }
      else if (event.key === 'n' || event.key === 'N') skip();
      else if (event.key === 'b' || event.key === 'B') goBack();
      else if (event.key === 'e' || event.key === 'E') toggleErg();
      else if (event.key === 'v' || event.key === 'V') toggleEntertainment();
      else if (event.key === '+' || event.key === '=') bias(1);
      else if (event.key === '-' || event.key === '_') bias(-1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, bias, goBack, skip, toggleEntertainment, toggleErg, toggleFullscreen, togglePause]);

  const { samples, laps: recordedLaps, timerSec, stepIndex, stepElapsedSec } = recording;
  const lap = useMemo(() => currentLapStats({ samples, laps: recordedLaps }), [samples, recordedLaps]);
  const workout = useMemo(() => summarizeRecording(recording, plan.ftpWatts), [recording, plan.ftpWatts]);
  const positionSec = planPositionSec({ stepIndex, stepElapsedSec, timerSec, laps: recordedLaps }, plan);
  const domainSec = Math.max(plan.totalSec, positionSec);
  const buckets = useMemo(
    () => powerBuckets({ ...recording, samples, laps: recordedLaps, timerSec }, plan, domainSec),
    [samples, recordedLaps, timerSec, plan, domainSec], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const connectedCount = ROLES.filter((role) => devices[role].status === 'connected').length;
  const anyDevice = connectedCount > 0;
  const lostDevices = ROLES.filter((role) => devices[role].status === 'reconnecting');
  const stepLabel = (index: number) => steps[index]?.label ?? (index >= plan.steps.length ? 'Free ride' : `Block ${index + 1}`);

  const backLink = <BackLink target={back} variant="compact" />;
  const fullscreenButton = fullscreenSupported ? (
    <button type="button" className={iconControlClassName} onClick={toggleFullscreen} aria-label={fullscreen ? 'Exit full screen' : 'Full screen'} title={`${fullscreen ? 'Exit full screen' : 'Full screen'} (F)`} aria-pressed={fullscreen}>
      {fullscreen ? <Minimize aria-hidden="true" size={18} strokeWidth={1.6} /> : <Maximize aria-hidden="true" size={18} strokeWidth={1.6} />}
    </button>
  ) : null;
  const connectionsRow = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <p role="status" className="text-sm text-[var(--text-secondary)]">
        {connectedCount === 0 ? 'No devices connected' : `${connectedCount} ${connectedCount === 1 ? 'device' : 'devices'} connected`}
      </p>
      <button type="button" className={secondaryButtonClassName} aria-haspopup="dialog" onClick={openConnections}>
        Connections
      </button>
    </div>
  );

  const connectionsDialog = (
    <dialog
      ref={attachConnections}
      onClose={() => setConnectionsOpen(false)}
      aria-labelledby="ride-connections-title"
      className="tempo-alert-dialog w-[calc(100%-2rem)] max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-[var(--text)] shadow-[var(--shadow-overlay)]"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="ride-connections-title" className="text-base font-medium">Connections</h2>
        <button type="button" className={secondaryButtonClassName} autoFocus onClick={() => connectionsRef.current?.close()}>Close</button>
      </div>
      {bluetoothAvailable ? (
        <ul className="mt-3 divide-y divide-[var(--border)]">
          {ROLES.map((role) => (
            <DeviceRow key={role} role={role} state={devices[role]} onConnect={() => void manager.connect(role)} onDisconnect={() => manager.disconnect(role)} />
          ))}
        </ul>
      ) : (
        <p role="status" className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">
          This browser can’t connect to Bluetooth devices. You can ride without devices, or connect them in the <GetTempoRideLink>Tempo Ride desktop app</GetTempoRideLink>.
        </p>
      )}
    </dialog>
  );

  const leavingVideo = entertainment === 'youtube' && !isPhone;
  const switchDialog = (
    <dialog
      ref={attachSwitchDialog}
      onClose={() => setPendingSwitch(null)}
      aria-labelledby="ride-switch-title"
      aria-describedby="ride-switch-text"
      className="tempo-alert-dialog w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-[var(--text)] shadow-[var(--shadow-overlay)]"
    >
      <h2 id="ride-switch-title" className="text-base font-medium">{leavingVideo ? 'Leave the video?' : 'Leave the course?'}</h2>
      <p id="ride-switch-text" className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
        {switchConsequence(leavingVideo)} Your ride keeps recording.
      </p>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" className={secondaryButtonClassName} onClick={() => switchDialogRef.current?.close()}>{leavingVideo ? 'Keep watching' : 'Keep riding it'}</button>
        <button type="button" className={primaryButtonClassName} onClick={confirmSwitch}>{pendingSwitch ? switchLabel(pendingSwitch) : 'Leave'}</button>
      </div>
    </dialog>
  );

  const finishDialog = (
    <dialog
      ref={attachFinishDialog}
      onClose={() => setFinishOpen(false)}
      aria-labelledby="ride-finish-title"
      aria-describedby="ride-finish-text"
      className="tempo-alert-dialog w-[calc(100%-2rem)] max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-[var(--text)] shadow-[var(--shadow-overlay)]"
    >
      <h2 id="ride-finish-title" className="text-base font-medium">Finish this ride?</h2>
      <p id="ride-finish-text" className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">
        {notPlanned ? 'Saving adds it to your Calendar.' : 'Saving marks the planned workout as done.'} Discarding deletes this ride{notPlanned ? '' : ' and keeps the workout planned'}.
      </p>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button type="button" className={`${secondaryButtonClassName} sm:mr-auto`} onClick={() => finishDialogRef.current?.close()}>Keep riding</button>
        <button type="button" className={secondaryButtonClassName} onClick={() => { if (window.confirm('Discard this ride? This cannot be undone.')) { finishDialogRef.current?.close(); discard(); } }}>Discard</button>
        <button type="button" className={primaryButtonClassName} onClick={() => { finishDialogRef.current?.close(); finish(); }}>Finish and save</button>
      </div>
    </dialog>
  );

  const shortcutLegend = (
    <dl aria-label="Keyboard shortcuts" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[12px] text-[var(--text-muted)] [@media(pointer:coarse)]:hidden">
      <div className="flex items-center gap-1.5"><dt><Kbd>Space</Kbd></dt><dd>Pause</dd></div>
      <div className="flex items-center gap-1.5"><dt className="flex gap-1"><Kbd>B</Kbd><Kbd>N</Kbd></dt><dd>Previous / next block</dd></div>
      <div className="flex items-center gap-1.5"><dt><Kbd>E</Kbd></dt><dd>ERG</dd></div>
      <div className="flex items-center gap-1.5"><dt className="flex gap-1"><Kbd>+</Kbd><Kbd>−</Kbd></dt><dd>Intensity</dd></div>
      {status === 'ready' ? null : <div className="flex items-center gap-1.5"><dt><Kbd>V</Kbd></dt><dd>Entertainment</dd></div>}
      {fullscreenSupported ? <div className="flex items-center gap-1.5"><dt><Kbd>F</Kbd></dt><dd>Full screen</dd></div> : null}
    </dl>
  );

  const frame = (stateLabel: string, controls: ReactNode, body: ReactNode, label: string, fill = false) => (
    <div className={`ride-mode flex flex-col ${fill ? 'h-dvh overflow-hidden' : 'min-h-dvh'}`}>
      <header className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--border)] px-3 py-2 sm:px-5">
        <div className="flex min-w-0 flex-1 basis-40 items-center gap-2">
          {backLink}
          <div className="min-w-0">
            <h1 className="truncate text-[15px] font-medium text-[var(--text)]">{sessionTitle}</h1>
            <p className="truncate text-[12px] text-[var(--text-muted)]">{stateLabel}</p>
          </div>
        </div>
        {(active || (recovered && status === 'ready')) ? connectionsRow : null}
        {controls ? (
          <div className="flex flex-wrap items-center gap-2 max-xl:basis-full sm:gap-3">
            {controls}
            {fullscreenButton}
          </div>
        ) : fullscreenButton}
      </header>
      <main id="ride" aria-label={label} className="flex min-h-0 flex-1 flex-col">{body}</main>
      {connectionsDialog}
      {active ? switchDialog : null}
      {active ? finishDialog : null}
    </div>
  );

  if (recovered && status === 'ready') {
    const recoveredSummary = summarizeRecording(recovered.recording, plan.ftpWatts);
    const canResume = recovered.compatible && recovered.recording.status !== 'finished';
    return frame('Unfinished ride', null, (
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-8 px-5 py-10">
        <div>
          <h2 className="text-[28px] font-medium tracking-[-0.02em] text-[var(--text)]">Unfinished ride found</h2>
          <p className="mt-2 text-[14px] text-[var(--text-secondary)]">Saved on this device {new Date(recovered.savedAtMs).toLocaleString()}.</p>
          {!recovered.compatible ? <p className="mt-2 text-[14px] text-[var(--status-warning)]">The workout has changed since this ride, so you can’t resume it. You can still save it.</p> : null}
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
    const summary = summarizeRecording(recording, plan.ftpWatts);
    const lapRows = summarizeLaps(recording).filter((entry) => entry.durationSec > 0);
    const saveButton = saveState.kind === 'saved' ? (
      <>
        <Link href={sessionHref} className={primaryButtonClassName}>Open workout</Link>
        {/* Optional: the workout page keeps the same Post to Strava action for later. */}
        {saveState.activityId !== null ? (
          <StravaPostAction activityId={saveState.activityId} returnPath={`/athlete/session/${sessionId}?post=strava`} />
        ) : null}
      </>
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
              {saveState.kind === 'saved' ? <p role="status" className="text-[var(--status-success)]">{notPlanned ? 'Saved and added to your Calendar.' : 'Saved. The workout is marked as done.'}{saveState.note ? ` ${saveState.note}` : ''}</p> : null}
              {saveState.kind === 'saved' && saveState.activityId !== null ? <p className="mt-1 text-[var(--text-secondary)]">Post it to Strava now, or later from the workout page.</p> : null}
              {saveState.kind === 'failed' ? <p role="alert" className="text-[var(--status-danger)]">{saveState.error}</p> : null}
              {saveState.kind === 'saving' ? <p role="status" className="text-[var(--text-secondary)]">Saving to Tempo…</p> : null}
              {timerSec >= MAX_ACTIVITY_IMPORT_DURATION_SEC ? <p className="text-[var(--text-secondary)]">This ride reached the 36-hour recording limit.</p> : null}
            {saveState.kind === 'idle' ? <p className="text-[var(--text-secondary)]">Your ride stays on this device until it’s saved to Tempo.</p> : null}
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

        <section aria-labelledby="ride-blocks" className="pt-4">
          <h3 id="ride-blocks" className="text-[16px] font-medium text-[var(--text)]">Blocks</h3>
          {lapRows.length ? (
            <div className="mt-3 overflow-x-auto">
              <table className="data w-full min-w-[640px] text-left text-[14px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[11px] uppercase tracking-[0.08em] text-[var(--text-muted)]">
                    <th scope="col" className="py-2 pr-4 font-medium">Block</th>
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
                        <td className="py-2.5 pr-4 text-right text-[var(--text-secondary)]">{entry.averageTargetWatts !== null ? `${entry.averageTargetWatts}\u00A0W` : '--'}</td>
                        <td className="py-2.5 pr-4 text-right">{entry.averagePowerWatts !== null ? `${entry.averagePowerWatts}\u00A0W` : '--'}</td>
                        <td className="py-2.5 pr-4 text-right" style={{ color: tone === 'none' ? 'var(--text-muted)' : TONE_VAR[tone] }}>
                          {delta === null ? '--' : `${delta > 0 ? '+' : delta < 0 ? '−' : '±'}${Math.abs(delta)}\u00A0W`}
                        </td>
                        <td className="py-2.5 pr-4 text-right text-[var(--text-secondary)]">{entry.maxPowerWatts !== null ? `${entry.maxPowerWatts}\u00A0W` : '--'}</td>
                        <td className="py-2.5 text-right">{entry.averageHeartRateBpm !== null ? `${entry.averageHeartRateBpm}` : '--'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <p className="mt-2 text-[14px] text-[var(--text-secondary)]">No blocks were recorded.</p>}
        </section>
      </div>
    ), 'Ride summary');
  }

  if (status === 'ready') {
    const blockCount = plan.steps.filter((step) => step.kind !== 'pause' && step.durationSec > 0).length;
    return frame('Ready to ride', null, (
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-10">
          <div>
            <h2 className="text-[clamp(1.75rem,1.3rem+1.6vw,3rem)] font-medium leading-tight tracking-[-0.025em] text-[var(--text)]">{sessionTitle}</h2>
            <div className="mt-4 grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Duration" value={formatClock(plan.totalSec)} />
              <Stat label="Blocks" value={String(blockCount)} />
              <Stat label="FTP" value={display(plan.ftpWatts)} unit={plan.ftpWatts ? 'W' : undefined} />
              <Stat label={notPlanned ? 'TSS' : 'Planned TSS'} value={display(plannedTss)} />
            </div>
          </div>
          <div className="flex flex-col gap-3">
            <button type="button" className={`${primaryButtonClassName} min-h-11 gap-2`} onClick={start}>
              <Play aria-hidden="true" size={18} strokeWidth={1.8} />
              {anyDevice ? 'Start ride' : 'Start without devices'}
            </button>
            {connectionsRow}
            <p className="max-w-xs text-[13px] text-[var(--text-secondary)]">
              {notPlanned ? 'Not in your plan. It’s added to your Calendar only when you finish and save the ride.' : 'In your plan. Saving the ride marks it as done.'}
            </p>
          </div>
        </div>
        <UnsavedRidesNotice userId={userId} excludeSessionId={sessionId} />
        <section aria-label="Workout profile" className="flex flex-col pb-4">
          <WorkoutProfileChart plan={plan} positionSec={null} buckets={[]} domainSec={plan.totalSec} heartRateMaxBpm={heartRateMaxBpm} className="h-[clamp(180px,35dvh,360px)]" />
        </section>
        {!planHasPowerTargets(plan) ? (
          <p className="text-[14px] text-[var(--status-warning)]">
            {plan.ftpWatts ? 'This workout has no power targets, so the trainer stays in free ride.' : <><Link href={PROFILE_FTP_HREF} className="underline underline-offset-2 hover:text-[var(--text)]">Add FTP in Profile</Link> to turn %FTP targets into watts. Until then the trainer stays in free ride.</>}
          </p>
        ) : null}
        {shortcutLegend}
      </div>
    ), 'Ride setup');
  }

  const threeSecond = threeSecondPower(recording, live);
  const tone = complianceTone(threeSecond, targetWatts);
  const toneColor = TONE_VAR[tone];
  const delta = threeSecond !== null && targetWatts !== null ? threeSecond - targetWatts : null;
  const toneText = tone === 'on' ? 'On target' : tone === 'over' ? 'Above target' : 'Below target';
  const prescribedTarget = targetWatts === null ? steps[stepIndex]?.prescribedTarget ?? null : null;
  const ergOn = recording.ergEnabled && devices.ergAvailable;
  const stepTime = currentStep
    ? currentStep.durationSec - stepElapsedSec
    : timerSec - (recordedLaps.at(-1)?.startSec ?? 0);
  const stepProgress = currentStep && currentStep.durationSec > 0 ? stepElapsedSec / currentStep.durationSec : 0;
  const nextStep = plan.steps[stepIndex + 1];
  const nextTarget = targetWattsAt(nextStep, 0, recording.biasPct);
  const nextPrescription = steps[stepIndex + 1]?.prescribedTarget ?? null;
  const remainingSec = Math.max(0, plan.totalSec - positionSec);
  const deviation = delta !== null && targetWatts ? Math.max(-1, Math.min(1, delta / Math.max(20, targetWatts * 0.25))) : null;
  const intervalColor = currentStep?.kind === 'pause' ? 'var(--text-muted)' : currentStep ? intensityColor(stepIntensityZone(currentStep, plan.ftpWatts)) : 'var(--brand)';
  const hasPowerTargets = planHasPowerTargets(plan);
  const ftpPercent = threeSecond !== null && plan.ftpWatts ? Math.round((threeSecond / plan.ftpWatts) * 100) : null;
  const biasText = `${recording.biasPct > 0 ? '+' : recording.biasPct < 0 ? '−' : ''}${Math.abs(recording.biasPct)}%`;
  const unit = (value: number | null | undefined, text: string) => value === null || value === undefined ? undefined : text;

  const canGoBack = plan.steps.slice(0, Math.min(stepIndex, plan.steps.length)).some((step) => step.durationSec > 0);
  const ergButton = (
    <button
      type="button"
      className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${buttonFocusClassName} ${ergOn ? 'border-[var(--brand)] text-[var(--text)]' : 'border-[var(--border-strong)] text-[var(--text-secondary)] enabled:hover:bg-[var(--raised)] enabled:hover:text-[var(--text)]'}`}
      onClick={toggleErg}
      disabled={!devices.ergAvailable}
      aria-pressed={ergOn}
      aria-keyshortcuts="E"
      title={devices.ergAvailable ? `ERG ${ergOn ? 'on' : 'off'} (E)` : 'Connect a controllable trainer to use ERG'}
    >
      <span aria-hidden="true" className={`size-2 rounded-full ${ergOn ? 'bg-[var(--brand)]' : 'bg-[var(--border-strong)]'}`} />
      ERG {ergOn ? 'on' : 'off'}
    </button>
  );

  const controls = (
    <>
      <div role="group" aria-label="Trainer control" className="flex items-center gap-2">
        {ergButton}
        {hasPowerTargets ? (
          <div className="flex items-center gap-1" role="group" aria-label="Intensity" title="Intensity (+ / −)">
            <span aria-hidden="true" className="mr-1 hidden text-sm text-[var(--text-secondary)] 2xl:inline">Intensity</span>
            <button type="button" className={iconControlClassName} onClick={() => bias(-1)} aria-label="Decrease intensity 1%" aria-keyshortcuts="-"><Minus aria-hidden="true" size={15} strokeWidth={1.8} /></button>
            <span className="data min-w-12 text-center text-sm font-medium text-[var(--text)]" aria-live="polite" aria-label={`Intensity ${biasText}`}>{biasText}</span>
            <button type="button" className={iconControlClassName} onClick={() => bias(1)} aria-label="Increase intensity 1%" aria-keyshortcuts="+"><Plus aria-hidden="true" size={15} strokeWidth={1.8} /></button>
          </div>
        ) : null}
      </div>
      <span aria-hidden="true" className="mx-1 hidden h-6 w-px bg-[var(--border-strong)] sm:block" />
      <div role="group" aria-label="Ride" className="flex items-center gap-2">
        <button type="button" className={`${status === 'paused' ? primaryButtonClassName : secondaryButtonClassName} !h-10 gap-2`} onClick={togglePause} aria-keyshortcuts="Space" title={`${status === 'paused' ? 'Resume' : 'Pause'} (Space)`}>
          {status === 'paused' ? <Play aria-hidden="true" size={16} strokeWidth={1.8} /> : <Pause aria-hidden="true" size={16} strokeWidth={1.8} />}
          {status === 'paused' ? 'Resume' : 'Pause'}
        </button>
        <button type="button" className={`${secondaryButtonClassName} !h-10 gap-2`} aria-haspopup="dialog" onClick={openFinish}>
          <Square aria-hidden="true" size={14} strokeWidth={1.8} />Finish
        </button>
      </div>
    </>
  );

  const avgValue = (value: number | null | undefined, unitText: string, color?: string) => (
    <span className="inline-flex items-baseline gap-1">
      <span className="ride-numeral !leading-none text-xl sm:text-[1.75rem]" style={{ color: value == null ? undefined : color }}>{display(value)}</span>
      {value != null ? <span className="text-[12px] text-[var(--text-muted)]">{unitText}</span> : null}
    </span>
  );
  const nowValue = (value: number | null, unitText: string, size: string, color?: string) => (
    <span className="inline-flex items-baseline gap-1.5">
      <span className={`ride-numeral !leading-none ${size}`} style={{ color: value === null ? undefined : color }}>{display(value)}</span>
      {value !== null ? <span className="text-sm text-[var(--text-muted)]">{unitText}</span> : null}
    </span>
  );

  const rideClocks = (
    <dl aria-label="Time" className="flex shrink-0 items-end gap-5">
      <RideClock label="Elapsed" value={formatClock(timerSec)} />
      {remainingSec > 0 ? <RideClock label="Workout left" value={formatClock(remainingSec)} /> : null}
      <RideClock label={currentStep ? 'Block left' : 'Free ride'} value={formatClock(stepTime)} primary />
    </dl>
  );
  const entertainmentOn = entertainment !== 'off';
  // Phones show the course only; a remembered YouTube view opens it there.
  let entertainmentMode: EntertainmentMode | null = null;
  if (entertainment !== 'off') entertainmentMode = isPhone ? 'course' : entertainment;
  const entertainmentRide: EntertainmentRide = {
    sessionId,
    userId,
    status: status === 'paused' ? 'paused' : 'running',
    obscured: connectionsOpen || sheetOpen || finishOpen || pendingSwitch !== null,
    reading: live,
    threeSecondPowerWatts: threeSecond,
    targetWatts,
    ergOn,
    tone,
    blockLabel: stepLabel(stepIndex),
    blockLeftSec: currentStep ? stepTime : null,
    blockNumber: currentStep ? stepIndex + 1 : null,
    blockCount: plan.steps.length,
    blockColor: intervalColor,
  };
  const entertainmentStage = entertainmentMode ? (
    <EntertainmentStage
      mode={entertainmentMode}
      ride={entertainmentRide}
      inbox={youTubeInbox}
      trackActivity={trackActivity}
      onClose={() => setEntertainment('off')}
    />
  ) : null;
  // Phones have one view, so the button turns it on and off.
  const phoneEntertainmentButton = (
    <button
      type="button"
      className={`inline-flex size-10 shrink-0 items-center justify-center rounded-lg border transition-colors ${buttonFocusClassName} ${entertainmentOn ? 'border-[var(--brand)] text-[var(--text)]' : 'border-[var(--border-strong)] text-[var(--text-secondary)] hover:bg-[var(--raised)] hover:text-[var(--text)]'}`}
      onClick={toggleEntertainment}
      aria-pressed={entertainmentOn}
      aria-keyshortcuts="V"
      aria-label="Ride a course"
      title={entertainmentOn ? 'Back to data only (V)' : 'Ride a course (V)'}
    >
      <Popcorn aria-hidden="true" size={16} strokeWidth={1.7} />
    </button>
  );
  const deviationMeter = deviation !== null ? (
    <div className="relative h-1.5 rounded-full bg-[var(--raised)]" role="meter" aria-label="Power versus target" aria-valuemin={-100} aria-valuemax={100} aria-valuenow={Math.round(deviation * 100)} aria-valuetext={delta ? `${Math.abs(delta)} watts ${delta > 0 ? 'above' : 'below'} target` : toneText}>
      <span aria-hidden="true" className="absolute -top-0.5 left-1/2 h-2.5 w-px bg-[var(--text-muted)]" />
      <span aria-hidden="true" className="ride-state-bar absolute top-0 h-1.5 rounded-full" style={{ left: `${50 + Math.min(0, deviation) * 50}%`, width: `${Math.abs(deviation) * 50}%`, background: toneColor }} />
    </div>
  ) : null;
  const toneLine = deviation !== null ? (
    <p className="text-[13px] font-medium" style={{ color: toneColor }}>
      {toneText}{delta !== null && tone !== 'on' ? <> by <span className="data">{Math.abs(delta)}&nbsp;W</span></> : null}
    </p>
  ) : null;
  const targetText = targetWatts !== null || prescribedTarget ? (
    <span className="text-[13px] text-[var(--text-secondary)]">
      {ergOn ? 'ERG target' : 'Target'}{' '}
      <span className="ride-numeral text-xl !text-[var(--text-secondary)]">{targetWatts ?? prescribedTarget}</span>
      {targetWatts !== null ? <span className="ml-1 text-[12px] text-[var(--text-muted)]">W</span> : null}
    </span>
  ) : null;

  if (isPhone) {
    const closeSheet = () => phoneSheetRef.current?.close();
    const sheetMetric = (label: string, value: string, unitText?: string, color?: string) => (
      <div className="min-w-0">
        <dt className="truncate text-[12px] text-[var(--text-secondary)]">{label}</dt>
        <dd className="mt-1 flex items-baseline gap-1"><span className="ride-numeral text-xl" style={{ color }}>{value}</span>{unitText && value !== '--' ? <span className="text-[12px] text-[var(--text-muted)]">{unitText}</span> : null}</dd>
      </div>
    );
    const phoneAvg = (label: string, power: number | null | undefined, heartRate: number | null | undefined) => (
      <div className="min-w-0">
        <p className="text-[12px] text-[var(--text-secondary)]">{label}</p>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-3">
          <span className="inline-flex items-baseline gap-1"><span className="ride-numeral text-2xl">{display(power)}</span>{power != null ? <span className="text-[12px] text-[var(--text-muted)]">W</span> : null}</span>
          <span className="inline-flex items-baseline gap-1"><span className="ride-numeral text-2xl" style={{ color: heartRate != null ? 'var(--ride-hr)' : undefined }}>{display(heartRate)}</span>{heartRate != null ? <span className="text-[12px] text-[var(--text-muted)]">bpm</span> : null}</span>
        </p>
      </div>
    );
    const nextText = currentStep
      ? nextStep ? `next: ${stepLabel(stepIndex + 1)}${nextTarget !== null ? ` – ${nextTarget} W` : nextPrescription ? ` – ${nextPrescription}` : ''}` : 'free ride next'
      : 'After workout plan';

    return (
      <div className="ride-mode flex h-dvh flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-[var(--border)] px-2">
          {backLink}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-medium text-[var(--text)]">{sessionTitle}</h1>
            <p className="truncate text-[12px] text-[var(--text-muted)]">
              {status === 'paused' ? 'Paused' : 'Riding'}, {connectedCount === 0 ? 'no devices' : `${connectedCount} ${connectedCount === 1 ? 'device' : 'devices'}`}
            </p>
          </div>
          {phoneEntertainmentButton}
          {ergButton}
          <button type="button" className={iconControlClassName} aria-label="More controls and data" aria-haspopup="dialog" onClick={openSheet}>
            <Ellipsis aria-hidden="true" size={18} strokeWidth={1.8} />
          </button>
        </header>

        {lostDevices.length ? (
          <p role="status" className="shrink-0 truncate border-b border-[var(--status-warning-border)] bg-[var(--status-warning-tint)] px-4 py-1.5 text-[12px] text-[var(--text)]">
            {lostDevices.map((role) => ROLE_LABEL[role]).join(' and ')} disconnected. Reconnecting…
          </p>
        ) : null}
        {status === 'paused' ? <p role="status" className="shrink-0 border-b border-[var(--border)] bg-[var(--raised)] px-4 py-1.5 text-[12px] text-[var(--text)]">Paused. The timer is stopped.</p> : null}

        <main id="ride" aria-label="Ride" className="flex min-h-0 flex-1 flex-col px-4">
          <section aria-label="Current block" className="shrink-0 pt-3">
            <div className="flex items-end justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-base font-medium text-[var(--text)]">{stepLabel(stepIndex)}</h2>
                <p className="truncate text-[12px] text-[var(--text-secondary)]">
                  {currentStep ? `Block ${stepIndex + 1} of ${plan.steps.length}, ` : ''}<span className="data">{nextText}</span>
                </p>
              </div>
              <p className="flex shrink-0 items-baseline gap-1.5 text-[12px] text-[var(--text-secondary)]">
                <span className="ride-numeral !leading-none text-[1.75rem]">{formatClock(stepTime)}</span>
                {currentStep ? 'block left' : 'free ride'}
              </p>
            </div>
            {currentStep ? <ProgressBar value={stepProgress} label="Block progress" color={intervalColor} className="mt-2 h-1" /> : null}
            <dl aria-label="Time" className="mt-2 flex items-baseline justify-between gap-3 text-[12px] text-[var(--text-secondary)]">
              <div className="flex items-baseline gap-1.5"><dt>Elapsed</dt><dd className="ride-numeral !leading-none text-lg">{formatClock(timerSec)}</dd></div>
              {remainingSec > 0 ? <div className="flex items-baseline gap-1.5"><dt>Workout left</dt><dd className="ride-numeral !leading-none text-lg">{formatClock(remainingSec)}</dd></div> : null}
            </dl>
          </section>

          <section aria-label="Ride metrics" className="shrink-0">
            <div className="pt-3">
              <div className="flex items-baseline justify-between gap-3 text-[12px] text-[var(--text-secondary)]">
                <span>3 s power</span>
                {targetWatts !== null || prescribedTarget ? (
                  <span>
                    {ergOn ? 'ERG target' : 'Target'}{' '}
                    <span className="ride-numeral text-xl !text-[var(--text-secondary)]">{targetWatts ?? prescribedTarget}</span>
                    {targetWatts !== null ? <span className="ml-0.5 text-[var(--text-muted)]">W</span> : null}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 flex items-baseline gap-1.5">
                <span className={`ride-numeral !leading-none ${entertainmentOn ? 'text-[3.5rem]' : 'text-[4.5rem]'}`}>{display(threeSecond)}</span>
                {threeSecond !== null ? <span className="text-base text-[var(--text-muted)]">W</span> : null}
              </p>
              {deviation !== null ? (
                <div className="mt-2 flex items-center gap-3">
                  <div className="relative h-1.5 flex-1 rounded-full bg-[var(--raised)]" role="meter" aria-label="Power versus target" aria-valuemin={-100} aria-valuemax={100} aria-valuenow={Math.round(deviation * 100)} aria-valuetext={delta ? `${Math.abs(delta)} watts ${delta > 0 ? 'above' : 'below'} target` : toneText}>
                    <span aria-hidden="true" className="absolute -top-0.5 left-1/2 h-2.5 w-px bg-[var(--text-muted)]" />
                    <span aria-hidden="true" className="ride-state-bar absolute top-0 h-1.5 rounded-full" style={{ left: `${50 + Math.min(0, deviation) * 50}%`, width: `${Math.abs(deviation) * 50}%`, background: toneColor }} />
                  </div>
                  <p className="shrink-0 text-[13px] font-medium" style={{ color: toneColor }}>
                    {tone === 'on' ? 'On target' : <span className="data">{delta !== null && delta > 0 ? '+' : '−'}{Math.abs(delta ?? 0)}&nbsp;W</span>}
                  </p>
                </div>
              ) : threeSecond === null ? (
                <p className="mt-2 text-[13px] text-[var(--text-secondary)]">
                  {prescribedTarget && !plan.ftpWatts ? 'Ride by feel. Add FTP in Profile to see watts.' : devices.trainer.status === 'connected' ? 'Waiting for power' : 'No power source connected'}
                </p>
              ) : null}
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-4 border-t border-[var(--border)] pt-3">
              <div>
                <dt className="text-[12px] text-[var(--text-secondary)]">Heart rate</dt>
                <dd className="mt-1 flex items-baseline gap-1"><span className="ride-numeral !leading-none text-[2.25rem]" style={{ color: live.heartRateBpm !== null ? 'var(--ride-hr)' : undefined }}>{display(live.heartRateBpm)}</span>{live.heartRateBpm !== null ? <span className="text-[12px] text-[var(--text-muted)]">bpm</span> : null}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-[var(--text-secondary)]">Cadence</dt>
                <dd className="mt-1 flex items-baseline gap-1"><span className="ride-numeral !leading-none text-[2.25rem]">{display(live.cadenceRpm)}</span>{live.cadenceRpm !== null ? <span className="text-[12px] text-[var(--text-muted)]">rpm</span> : null}</dd>
              </div>
            </dl>

            {entertainmentOn ? null : (
              <div className="mt-3 grid grid-cols-2 gap-4 border-t border-[var(--border)] pt-3">
                {phoneAvg(currentStep ? 'Block avg' : 'Free ride avg', lap?.averagePowerWatts, lap?.averageHeartRateBpm)}
                {phoneAvg('Workout avg', workout.averagePowerWatts, workout.averageHeartRateBpm)}
              </div>
            )}
          </section>

          {entertainmentOn ? (
            <div className="-mx-4 flex min-h-0 flex-1 flex-col px-2 pb-1 pt-2">{entertainmentStage}</div>
          ) : (
          <section aria-label="Workout profile" className="flex min-h-0 flex-1 flex-col pt-3">
            <div className="min-h-12 flex-1 pb-6 pt-2">
              <WorkoutProfileChart plan={plan} positionSec={positionSec} buckets={buckets} domainSec={domainSec} heartRateMaxBpm={heartRateMaxBpm} activeStepIndex={currentStep ? stepIndex : null} biasPct={recording.biasPct} className="h-full" />
            </div>
          </section>
          )}
        </main>

        <footer className="flex shrink-0 items-center gap-2 border-t border-[var(--border)] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          {status === 'paused' ? (
            <button type="button" className={`${secondaryButtonClassName} !h-12 gap-2`} aria-haspopup="dialog" onClick={openFinish}>
              <Square aria-hidden="true" size={14} strokeWidth={1.8} />Finish ride
            </button>
          ) : (
            <div role="group" aria-label="Block navigation" className="flex gap-2">
              <button type="button" className={`${secondaryButtonClassName} !h-12 gap-1.5 !px-3`} onClick={goBack} disabled={!canGoBack} aria-label="Previous block">
                <SkipBack aria-hidden="true" size={16} strokeWidth={1.7} />Back
              </button>
              <button type="button" className={`${secondaryButtonClassName} !h-12 gap-1.5 !px-3`} onClick={skip} disabled={!currentStep} aria-label="Next block">
                Next<SkipForward aria-hidden="true" size={16} strokeWidth={1.7} />
              </button>
            </div>
          )}
          <button type="button" className={`${status === 'paused' ? primaryButtonClassName : secondaryButtonClassName} ml-auto !h-12 min-w-32 gap-2`} onClick={togglePause}>
            {status === 'paused' ? <Play aria-hidden="true" size={18} strokeWidth={1.8} /> : <Pause aria-hidden="true" size={18} strokeWidth={1.8} />}
            {status === 'paused' ? 'Resume' : 'Pause'}
          </button>
        </footer>

        <dialog
          ref={attachSheet}
          onClose={() => setSheetOpen(false)}
          aria-labelledby="ride-sheet-title"
          className="fixed inset-x-0 bottom-0 top-auto m-0 max-h-[85dvh] w-full max-w-full overflow-y-auto rounded-t-2xl backdrop:bg-black/60 border-t border-[var(--border)] bg-[var(--surface)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 text-[var(--text)] shadow-[var(--shadow-overlay)]"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 id="ride-sheet-title" className="text-base font-medium">Ride controls</h2>
            <button type="button" className={secondaryButtonClassName} autoFocus onClick={closeSheet}>Close</button>
          </div>

          {hasPowerTargets ? (
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-4" role="group" aria-label="Intensity">
              <span className="text-sm text-[var(--text-secondary)]">Intensity</span>
              <div className="flex items-center gap-2">
                <button type="button" className={`${iconControlClassName} !size-11`} onClick={() => bias(-1)} aria-label="Decrease intensity 1%"><Minus aria-hidden="true" size={16} strokeWidth={1.8} /></button>
                <span className="data min-w-14 text-center text-base font-medium" aria-live="polite">{biasText}</span>
                <button type="button" className={`${iconControlClassName} !size-11`} onClick={() => bias(1)} aria-label="Increase intensity 1%"><Plus aria-hidden="true" size={16} strokeWidth={1.8} /></button>
              </div>
            </div>
          ) : null}

          <section aria-labelledby="ride-sheet-data" className="mt-4 border-t border-[var(--border)] pt-4">
            <h3 id="ride-sheet-data" className="text-sm font-medium">All data</h3>
            <dl className="mt-3 grid grid-cols-3 gap-x-4 gap-y-4">
              {sheetMetric('% FTP now', display(ftpPercent), '%')}
              {sheetMetric('Normalized', display(workout.normalizedPowerWatts), 'W')}
              {sheetMetric('Max power', display(workout.maxPowerWatts), 'W')}
              {sheetMetric('Block cadence', display(lap?.averageCadenceRpm), 'rpm')}
              {sheetMetric('Avg cadence', display(workout.averageCadenceRpm), 'rpm')}
              {sheetMetric('Max HR', display(workout.maxHeartRateBpm), 'bpm', workout.maxHeartRateBpm != null ? 'var(--ride-hr)' : undefined)}
              {sheetMetric('Work', display(workout.workKj), 'kJ')}
              {sheetMetric('TSS', display(workout.tss))}
              {sheetMetric('IF', display(workout.intensityFactor, 2))}
              {sheetMetric('Distance', workout.distanceMeters > 0 ? formatDistance(workout.distanceMeters) : '--')}
              {sheetMetric('Elapsed', formatClock(timerSec))}
              {sheetMetric('Plan left', formatClock(remainingSec))}
            </dl>
          </section>

          <div className="mt-5 flex flex-col gap-2 border-t border-[var(--border)] pt-4">
            <button type="button" className={`${secondaryButtonClassName} !h-12 w-full`} aria-haspopup="dialog" onClick={() => { closeSheet(); openConnections(); }}>
              Connections – {connectedCount === 0 ? 'none connected' : `${connectedCount} connected`}
            </button>
            {fullscreenSupported ? <button type="button" className={`${secondaryButtonClassName} !h-12 w-full`} onClick={() => { closeSheet(); toggleFullscreen(); }}>{fullscreen ? 'Exit full screen' : 'Full screen'}</button> : null}
            <button type="button" className={`${secondaryButtonClassName} !h-12 w-full gap-2`} aria-haspopup="dialog" onClick={() => { closeSheet(); openFinish(); }}>
              <Square aria-hidden="true" size={14} strokeWidth={1.8} />Finish ride
            </button>
          </div>
        </dialog>
        {connectionsDialog}
        {switchDialog}
        {finishDialog}
      </div>
    );
  }

  const desktopControls = (
    <>
      <EntertainmentMenu
        value={entertainment}
        open={entertainmentMenuOpen}
        onOpenChange={setEntertainmentMenuOpen}
        onChoose={requestEntertainment}
      />
      <span aria-hidden="true" className="mx-1 hidden h-6 w-px bg-[var(--border-strong)] sm:block" />
      {controls}
    </>
  );
  const banners = (
    <>
      {lostDevices.length ? (
        <p role="status" className="border-b border-[var(--status-warning-border)] bg-[var(--status-warning-tint)] px-5 py-2 text-[13px] text-[var(--text)] sm:px-7">
          {lostDevices.map((role) => ROLE_LABEL[role]).join(' and ')} disconnected. Still recording. Reconnecting…
        </p>
      ) : null}
      {status === 'paused' ? (
        <p role="status" className="border-b border-[var(--border)] bg-[var(--raised)] px-5 py-2 text-[13px] text-[var(--text)] sm:px-7">Paused. The timer is stopped.</p>
      ) : null}
    </>
  );
  const stateLabel = status === 'paused' ? 'Paused' : anyDevice ? 'Riding' : 'Riding, no devices';

  if (entertainmentOn) {
    const railLabel = 'text-[12px] text-[var(--text-secondary)]';
    const railCard = 'border-t border-[var(--border)] pt-3';
    const withRails = entertainmentMode !== 'course';
    const powerRail = (
      <div className="flex min-w-0 flex-col justify-center gap-4">
        <div className="space-y-2">
          <p className={railLabel}>Power</p>
          {nowValue(threeSecond, 'W', 'text-[2.75rem] xl:text-[3.25rem]')}
          {targetText ? <p>{targetText}</p> : null}
          {deviationMeter}
          {toneLine}
        </div>
        <div className={railCard}><p className={`${railLabel} mb-1.5`}>{currentStep ? 'Block avg' : 'Free ride avg'}</p>{avgValue(lap?.averagePowerWatts, 'W')}</div>
        <div className={railCard}><p className={`${railLabel} mb-1.5`}>Workout avg</p>{avgValue(workout.averagePowerWatts, 'W')}</div>
      </div>
    );
    const bodyRail = (
      <div className="flex min-w-0 flex-col justify-center gap-4">
        <div><p className={`${railLabel} mb-1.5`}>Heart rate</p>{nowValue(live.heartRateBpm, 'bpm', 'text-[2.5rem] xl:text-[3rem]', 'var(--ride-hr)')}</div>
        <div className={railCard}><p className={`${railLabel} mb-1.5`}>Cadence</p>{nowValue(live.cadenceRpm, 'rpm', 'text-[2.5rem] xl:text-[3rem]')}</div>
        <div className={railCard}><p className={`${railLabel} mb-1.5`}>{currentStep ? 'Block avg HR' : 'Avg HR'}</p>{avgValue(lap?.averageHeartRateBpm, 'bpm', 'var(--ride-hr)')}</div>
      </div>
    );
    return frame(stateLabel, desktopControls, (
      <>
        {banners}
        <div className="mx-auto flex min-h-0 w-full flex-1 flex-col gap-2 px-4 pb-2 pt-2 sm:px-6">
          <section aria-label="Current block" className="shrink-0 space-y-2">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="min-w-0 flex-1 basis-40">
                <h2 className="truncate text-base font-medium text-[var(--text)]">{stepLabel(stepIndex)}</h2>
                <p className="truncate text-[13px] text-[var(--text-secondary)]">
                  {currentStep ? `Block ${stepIndex + 1} of ${plan.steps.length}` : 'After workout plan'}
                  {currentStep ? <span className="data">{nextStep ? ` – next ${stepLabel(stepIndex + 1)}${nextTarget !== null ? ` – ${nextTarget} W` : ''}` : ' – free ride next'}</span> : null}
                </p>
              </div>
              {rideClocks}
              <div role="group" aria-label="Block navigation" className="flex shrink-0 items-center gap-2 md:border-l md:border-[var(--border)] md:pl-6">
                <button type="button" className={`${secondaryButtonClassName} !h-9 gap-2`} onClick={goBack} disabled={!canGoBack} aria-keyshortcuts="B" title="Go back to the previous block (B)">
                  <SkipBack aria-hidden="true" size={15} strokeWidth={1.7} />Previous
                </button>
                <button type="button" className={`${secondaryButtonClassName} !h-9 gap-2`} onClick={skip} disabled={!currentStep} aria-keyshortcuts="N" title="Skip to the next block (N)">
                  Next block<SkipForward aria-hidden="true" size={15} strokeWidth={1.7} />
                </button>
              </div>
            </div>
            {currentStep ? <ProgressBar value={stepProgress} label="Block progress" color={intervalColor} className="h-1" /> : null}
          </section>

          {withRails ? (
            <section aria-label="Ride metrics" className="flex shrink-0 flex-wrap items-end gap-x-8 gap-y-2 lg:hidden">
              <div className="flex items-baseline gap-3">{nowValue(threeSecond, 'W', 'text-[2.25rem]')}{targetText}</div>
              {nowValue(live.heartRateBpm, 'bpm', 'text-[1.75rem]', 'var(--ride-hr)')}
              {nowValue(live.cadenceRpm, 'rpm', 'text-[1.75rem]')}
            </section>
          ) : null}

          <div className={`grid min-h-0 flex-1 gap-4 ${withRails ? 'lg:grid-cols-[9.5rem_minmax(0,1fr)_8rem] xl:grid-cols-[10rem_minmax(0,1fr)_8.5rem]' : ''}`}>
            {withRails ? <section aria-label="Power" className="hidden min-h-0 lg:flex">{powerRail}</section> : null}
            <div className="min-h-0 min-w-0">{entertainmentStage}</div>
            {withRails ? <section aria-label="Heart rate and cadence" className="hidden min-h-0 lg:flex">{bodyRail}</section> : null}
          </div>

          <section aria-label="Workout profile" className="shrink-0 pt-3">
            <WorkoutProfileChart plan={plan} positionSec={positionSec} buckets={buckets} domainSec={domainSec} heartRateMaxBpm={heartRateMaxBpm} activeStepIndex={currentStep ? stepIndex : null} biasPct={recording.biasPct} className="mb-5 h-24 xl:h-28" />
          </section>
          <div className="shrink-0 border-t border-[var(--border)] pt-2 [@media(max-height:820px)]:hidden">{shortcutLegend}</div>
        </div>
      </>
    ), 'Ride', true);
  }

  const metric = (label: string, value: string, unitText: string | undefined, size: string, color?: string) => (
    <RideMetric label={label} value={value} unit={value === '--' ? undefined : unitText} size={size} color={value === '--' ? undefined : color} />
  );
  const averageSize = 'text-[1.75rem] xl:text-[2rem]';
  const nowSize = 'text-[2.5rem] xl:text-[3.25rem]';
  const detailSize = 'text-2xl';
  const columnClassName = 'min-w-0 lg:border-l lg:border-[var(--border)] lg:px-6 xl:px-9';

  return frame(stateLabel, desktopControls, (
    <>
      {banners}
      <div className="flex w-full flex-1 flex-col px-4 sm:px-8 xl:px-10">
        <div id="ride-data" className="grid gap-x-8 gap-y-6 border-b border-[var(--border)] py-5 sm:grid-cols-2 lg:grid-cols-[1.25fr_1fr_1fr] lg:gap-0">
          <section aria-labelledby="ride-now" className="min-w-0 sm:col-span-2 lg:col-span-1 lg:pr-6 xl:pr-9">
            <ColumnHeading id="ride-now" title="Now" />
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
              <span className="sr-only">Power</span>
              {nowValue(threeSecond, 'W', 'text-[4rem] lg:text-[4.5rem] xl:text-[6rem]')}
              {targetWatts !== null || prescribedTarget ? (
                <span className="whitespace-nowrap text-sm text-[var(--text-secondary)]">
                  {ergOn ? 'ERG target' : 'Target'}{' '}
                  <span className="ride-numeral ml-1 text-[2rem] xl:text-[2.25rem]">{targetWatts ?? prescribedTarget}</span>
                  {targetWatts !== null ? <span className="ml-1 text-sm text-[var(--text-muted)]">W</span> : null}
                </span>
              ) : null}
            </div>
            {deviation !== null ? (
              <div className="mt-4 space-y-2.5">
                <div className="relative h-3 rounded-full bg-[var(--raised)]" role="meter" aria-label="Power versus target" aria-valuemin={-100} aria-valuemax={100} aria-valuenow={Math.round(deviation * 100)} aria-valuetext={delta ? `${Math.abs(delta)} watts ${delta > 0 ? 'above' : 'below'} target` : toneText}>
                  <span aria-hidden="true" className="absolute -top-1 left-1/2 h-5 w-0.5 -translate-x-1/2 bg-[var(--text-muted)]" />
                  <span aria-hidden="true" className="ride-state-bar absolute top-0 h-3 min-w-2 rounded-full" style={{ [deviation < 0 ? 'right' : 'left']: '50%', width: `${Math.abs(deviation) * 50}%`, background: toneColor }} />
                </div>
                <p className="text-xl font-medium leading-tight" style={{ color: toneColor }}>
                  {toneText}{delta !== null && tone !== 'on' ? <> by <span className="data">{Math.abs(delta)}&nbsp;W</span></> : null}
                </p>
              </div>
            ) : threeSecond === null ? (
              <p className="mt-3 text-sm text-[var(--text-secondary)]">
                {prescribedTarget && !plan.ftpWatts ? (
                  <>Ride by feel. <Link href={PROFILE_FTP_HREF} className="text-[var(--text)] underline underline-offset-2 hover:text-[var(--brand)]">Add FTP in Profile</Link> to see watts.</>
                ) : devices.trainer.status === 'connected' ? 'Waiting for power' : 'No power source connected'}
              </p>
            ) : null}
            <dl className="mt-5 grid grid-cols-3 gap-x-4">
              {metric('Heart rate', display(live.heartRateBpm), 'bpm', nowSize, 'var(--ride-hr)')}
              {metric('Cadence', display(live.cadenceRpm), 'rpm', nowSize)}
              {metric('% of FTP', display(ftpPercent), '%', nowSize)}
            </dl>
          </section>

          <section aria-labelledby="ride-block" className={columnClassName}>
            <ColumnHeading id="ride-block" title={currentStep ? 'This block' : 'Free ride'} detail={currentStep ? `${stepLabel(stepIndex)} – ${stepIndex + 1} of ${plan.steps.length}` : 'After workout plan'} />
            <ColumnClock value={formatClock(stepTime)} detail={currentStep ? `left of ${formatClock(currentStep.durationSec)}` : 'ridden'} />
            {currentStep ? <ProgressBar value={stepProgress} label="Block progress" color={intervalColor} className="mt-3.5 h-1.5" /> : <div aria-hidden="true" className="mt-3.5 h-1.5" />}
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4">
              {metric('Avg power', display(lap?.averagePowerWatts), 'W', averageSize)}
              {metric('Avg heart rate', display(lap?.averageHeartRateBpm), 'bpm', averageSize, 'var(--ride-hr)')}
              {moreData ? metric('Avg cadence', display(lap?.averageCadenceRpm), 'rpm', detailSize) : null}
            </dl>
            {currentStep ? (
              <p className="mt-5 break-words text-base text-[var(--text)]">
                <span className="text-[var(--text-secondary)]">Next </span>
                {nextStep ? <>{stepLabel(stepIndex + 1)}<span className="data">{nextTarget !== null ? ` – ${nextTarget} W` : nextPrescription ? ` – ${nextPrescription}` : ` – Z${nextStep.zone}`} – {shortDuration(nextStep.durationSec)}</span></> : 'Free ride'}
              </p>
            ) : null}
            <div role="group" aria-label="Block navigation" className="mt-3.5 flex flex-wrap items-center gap-2">
              <button type="button" className={`${secondaryButtonClassName} !h-10 gap-2 lg:max-xl:!px-2.5`} onClick={goBack} disabled={!canGoBack} aria-keyshortcuts="B" title="Go back to the previous block (B)">
                <SkipBack aria-hidden="true" size={16} strokeWidth={1.7} />Previous
              </button>
              <button type="button" className={`${secondaryButtonClassName} !h-10 gap-2 lg:max-xl:!px-2.5`} onClick={skip} disabled={!currentStep} aria-keyshortcuts="N" title="Skip to the next block (N)">
                Next block<SkipForward aria-hidden="true" size={16} strokeWidth={1.7} />
              </button>
            </div>
          </section>

          <section aria-labelledby="ride-workout" className={`${columnClassName} lg:!pr-0`}>
            <ColumnHeading id="ride-workout" title="Workout" detail={sessionTitle} />
            {remainingSec > 0
              ? <ColumnClock value={formatClock(remainingSec)} detail={`left of ${formatClock(plan.totalSec)}`} />
              : <ColumnClock value={formatClock(timerSec)} detail="elapsed" />}
            <ProgressBar value={plan.totalSec > 0 ? positionSec / plan.totalSec : 1} label="Workout progress" className="mt-3.5 h-1.5" />
            <dl className={`mt-4 grid gap-x-4 gap-y-4 grid-cols-2 ${moreData ? 'xl:grid-cols-3' : ''}`}>
              {metric('Avg power', display(workout.averagePowerWatts), 'W', averageSize)}
              {metric('Avg heart rate', display(workout.averageHeartRateBpm), 'bpm', averageSize, 'var(--ride-hr)')}
              {remainingSec > 0 ? metric('Elapsed', formatClock(timerSec), undefined, averageSize) : null}
              {moreData ? (
                <>
                  {metric('Avg cadence', display(workout.averageCadenceRpm), 'rpm', detailSize)}
                  {metric('Normalized', display(workout.normalizedPowerWatts), 'W', detailSize)}
                  {metric('TSS', display(workout.tss), undefined, detailSize)}
                  {metric('Work', display(workout.workKj), 'kJ', detailSize)}
                  {metric('Max power', display(workout.maxPowerWatts), 'W', detailSize)}
                </>
              ) : null}
            </dl>
            <button type="button" className={`mt-4 inline-flex items-center gap-1.5 rounded-md text-sm text-[var(--text-secondary)] hover:text-[var(--text)] ${buttonFocusClassName}`} aria-expanded={moreData} aria-controls="ride-data" onClick={toggleMoreData}>
              {moreData ? 'Less data' : 'More data'}
              {moreData ? <ChevronUp aria-hidden="true" size={15} /> : <ChevronDown aria-hidden="true" size={15} />}
            </button>
          </section>
        </div>

        <section aria-label="Workout profile" className="flex flex-1 flex-col pb-5 pt-5">
          <WorkoutProfileChart plan={plan} positionSec={positionSec} buckets={buckets} domainSec={domainSec} heartRateMaxBpm={heartRateMaxBpm} activeStepIndex={currentStep ? stepIndex : null} biasPct={recording.biasPct} className="mb-6 min-h-36 flex-1" />
        </section>

        <div className="border-t border-[var(--border)] pb-5 pt-3 [@media(max-height:820px)]:hidden">{shortcutLegend}</div>
      </div>
    </>
  ), 'Ride');
}

function threeSecondPower(recording: RideRecording, live: RideReading): number | null {
  const values = recording.samples.slice(-3).map((sample) => sample.p).filter((value): value is number => value !== null);
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : live.powerWatts;
}
