import {
  ACTIVITY_IMPORT_FINISH_TOLERANCE_SEC,
  MAX_ACTIVITY_IMPORT_DISTANCE_METERS,
  MAX_ACTIVITY_IMPORT_DURATION_SEC,
  MAX_ACTIVITY_IMPORT_POINTS,
  MAX_ACTIVITY_IMPORT_SPAN_SEC,
} from '../activity-import-limits.ts';
import { measuredPowerTss, normalizedPowerFrom } from '../measured-power-load.ts';
import { targetWattsAt, type RidePlan } from './ride-plan.ts';

/** The latest value each sensor reported; null when absent or stale. */
export type RideReading = {
  powerWatts: number | null;
  heartRateBpm: number | null;
  cadenceRpm: number | null;
  speedMetersPerSecond: number | null;
};

export const emptyReading: RideReading = { powerWatts: null, heartRateBpm: null, cadenceRpm: null, speedMetersPerSecond: null };

/** One recorded timer second. Short keys keep multi-hour checkpoints small. */
export type RideSample = {
  t: number;
  p: number | null;
  hr: number | null;
  cad: number | null;
  spd: number | null;
  /** Cumulative distance in meters at the end of this second. */
  d: number;
  /** ERG target in effect (after bias), or null during free ride. */
  tgt: number | null;
};

/** Laps follow plan steps; `stepIndex === plan.steps.length` is free riding after the plan. */
export type RideLap = { stepIndex: number; startSec: number; endSec: number | null };

type Accumulator = { power: [number, number]; hr: [number, number]; cad: [number, number]; spd: [number, number] };

export type RideRecording = {
  version: 1;
  sessionId: number;
  sessionTitle: string;
  planSignature: string;
  status: 'ready' | 'running' | 'paused' | 'finished';
  startedAtMs: number | null;
  finishedAtMs: number | null;
  lastTickAtMs: number | null;
  /** Elapsed and active time have independent phases after a pause. Optional in older v1 checkpoints. */
  elapsedTickAtMs?: number | null;
  activeRemainderMs?: number;
  /** Wall-clock seconds since start, including pauses. */
  elapsedSec: number;
  /** Unpaused seconds; equals the number of samples. */
  timerSec: number;
  /** Unpaused seconds with pedalling, or every unpaused second when no sensor reported. */
  movingSec: number;
  stepIndex: number;
  stepElapsedSec: number;
  biasPct: number;
  ergEnabled: boolean;
  distanceMeters: number;
  samples: RideSample[];
  laps: RideLap[];
  pending: Accumulator;
};

export const RIDE_CHECKPOINT_VERSION = 1;

function emptyAccumulator(): Accumulator {
  return { power: [0, 0], hr: [0, 0], cad: [0, 0], spd: [0, 0] };
}

export function planSignature(plan: RidePlan): string {
  return JSON.stringify(plan.steps.map((step) => [step.id, step.durationSec]));
}

export function createRecording(sessionId: number, sessionTitle: string, plan: RidePlan): RideRecording {
  return {
    version: 1,
    sessionId,
    sessionTitle,
    planSignature: planSignature(plan),
    status: 'ready',
    startedAtMs: null,
    finishedAtMs: null,
    lastTickAtMs: null,
    elapsedSec: 0,
    timerSec: 0,
    movingSec: 0,
    stepIndex: 0,
    stepElapsedSec: 0,
    biasPct: 0,
    ergEnabled: true,
    distanceMeters: 0,
    samples: [],
    laps: [],
    pending: emptyAccumulator(),
  };
}

/** Adds an instantaneous reading to the current second's average. */
export function addReading(recording: RideRecording, reading: RideReading): RideRecording {
  if (recording.status !== 'running') return recording;
  const add = ([sum, count]: [number, number], value: number | null): [number, number] => value === null || !Number.isFinite(value) ? [sum, count] : [sum + value, count + 1];
  return {
    ...recording,
    pending: {
      power: add(recording.pending.power, reading.powerWatts),
      hr: add(recording.pending.hr, reading.heartRateBpm),
      cad: add(recording.pending.cad, reading.cadenceRpm),
      spd: add(recording.pending.spd, reading.speedMetersPerSecond),
    },
  };
}

/** Closes earlier sample windows before adding a newly arrived sensor reading. */
export function recordReading(recording: RideRecording, plan: RidePlan, nowMs: number, reading: RideReading): RideRecording {
  return addReading(tick(recording, plan, nowMs), reading);
}

function average([sum, count]: [number, number], fallback: number | null): number | null {
  return count > 0 ? sum / count : fallback;
}

function round(value: number | null, digits = 0): number | null {
  if (value === null) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function skipZeroLengthSteps(recording: RideRecording, plan: RidePlan): RideRecording {
  let next = recording;
  while (next.stepIndex < plan.steps.length && plan.steps[next.stepIndex].durationSec <= 0) {
    next = { ...next, stepIndex: next.stepIndex + 1 };
  }
  return next;
}

function openLap(recording: RideRecording): RideRecording {
  return { ...recording, laps: [...recording.laps, { stepIndex: recording.stepIndex, startSec: recording.timerSec, endSec: null }] };
}

function closeLap(recording: RideRecording): RideRecording {
  const laps = recording.laps.map((lap, index) => index === recording.laps.length - 1 && lap.endSec === null ? { ...lap, endSec: recording.timerSec } : lap);
  return { ...recording, laps };
}

/** Ends the current step (or lap) and moves to the next plan step. */
export function advanceStep(recording: RideRecording, plan: RidePlan, nowMs?: number, latest?: RideReading): RideRecording {
  if (nowMs !== undefined) {
    const caughtUp = tick(recording, plan, nowMs, latest);
    return caughtUp.stepIndex === recording.stepIndex ? advanceStep(caughtUp, plan) : caughtUp;
  }
  if (recording.stepIndex >= plan.steps.length || recording.status === 'finished') return recording;
  let next = closeLap(recording);
  next = skipZeroLengthSteps({ ...next, stepIndex: next.stepIndex + 1, stepElapsedSec: 0 }, plan);
  return recording.status === 'ready' ? next : openLap(next);
}

export function startRecording(recording: RideRecording, plan: RidePlan, nowMs: number): RideRecording {
  if (recording.status !== 'ready') return recording;
  const started = skipZeroLengthSteps({ ...recording, status: 'running', startedAtMs: nowMs, lastTickAtMs: nowMs, elapsedTickAtMs: nowMs }, plan);
  return openLap(started);
}

/** Advances the recording to `nowMs`, writing one sample per whole elapsed second. */
export function tick(recording: RideRecording, plan: RidePlan, nowMs: number, latest: RideReading = emptyReading): RideRecording {
  if (recording.status === 'ready' || recording.status === 'finished') return recording;
  const remaining = MAX_ACTIVITY_IMPORT_DURATION_SEC - recording.timerSec;
  const runningSince = recording.status === 'running' ? recording.lastTickAtMs : null;
  if (runningSince !== null && remaining <= 0) return { ...closeLap(recording), status: 'finished', finishedAtMs: nowMs };
  const activeLimit = runningSince === null ? Infinity : runningSince + remaining * 1000;
  const clockNow = Math.min(nowMs, activeLimit);
  const elapsedAnchor = recording.elapsedTickAtMs ?? recording.lastTickAtMs ?? nowMs;
  const elapsed = Math.max(0, Math.floor((clockNow - elapsedAnchor) / 1000));
  const elapsedUpdate = elapsed > 0 || recording.elapsedTickAtMs === null ? {
    elapsedSec: recording.elapsedSec + elapsed,
    elapsedTickAtMs: elapsedAnchor + elapsed * 1000,
  } : null;
  if (recording.status === 'paused' || recording.lastTickAtMs === null) {
    return elapsedUpdate ? { ...recording, ...elapsedUpdate } : recording;
  }

  const whole = Math.floor((clockNow - recording.lastTickAtMs) / 1000);
  if (whole <= 0) return elapsedUpdate ? { ...recording, ...elapsedUpdate } : recording;
  const lastReading = clockNow === nowMs ? latest : emptyReading;
  const fallback = whole === 1 ? lastReading : emptyReading;
  const first: RideReading = {
    powerWatts: average(recording.pending.power, fallback.powerWatts),
    heartRateBpm: average(recording.pending.hr, fallback.heartRateBpm),
    cadenceRpm: average(recording.pending.cad, fallback.cadenceRpm),
    speedMetersPerSecond: average(recording.pending.spd, fallback.speedMetersPerSecond),
  };
  let next: RideRecording = {
    ...recording,
    ...elapsedUpdate,
    lastTickAtMs: recording.lastTickAtMs + whole * 1000,
    pending: emptyAccumulator(),
  };
  const samples = [...recording.samples];
  for (let second = 0; second < whole; second += 1) {
    const reading = second === 0 ? first : second === whole - 1 ? lastReading : emptyReading;
    const step = plan.steps[next.stepIndex];
    const target = next.ergEnabled ? targetWattsAt(step, next.stepElapsedSec, next.biasPct) : null;
    const speed = reading.speedMetersPerSecond;
    const distanceMeters = next.distanceMeters + (speed ?? 0);
    const anySensor = reading.powerWatts !== null || reading.cadenceRpm !== null || speed !== null;
    const moving = !anySensor || (reading.powerWatts ?? 0) > 0 || (reading.cadenceRpm ?? 0) > 0 || (speed ?? 0) > 0.3;
    samples.push({
      t: next.timerSec,
      p: round(reading.powerWatts),
      hr: round(reading.heartRateBpm),
      cad: round(reading.cadenceRpm),
      spd: round(speed, 2),
      d: Math.round(distanceMeters * 10) / 10,
      tgt: target,
    });
    next = {
      ...next,
      timerSec: next.timerSec + 1,
      movingSec: next.movingSec + (moving ? 1 : 0),
      stepElapsedSec: next.stepElapsedSec + 1,
      distanceMeters,
    };
    if (step && next.stepElapsedSec >= step.durationSec) next = advanceStep(next, plan);
  }
  next = { ...next, samples };
  return next.timerSec === MAX_ACTIVITY_IMPORT_DURATION_SEC
    ? { ...closeLap(next), status: 'finished', finishedAtMs: next.lastTickAtMs }
    : next;
}

export function pauseRecording(recording: RideRecording, plan: RidePlan, nowMs: number, latest?: RideReading): RideRecording {
  if (recording.status !== 'running') return recording;
  const ticked = tick(recording, plan, nowMs, latest);
  if (ticked.status === 'finished') return ticked;
  return {
    ...ticked,
    status: 'paused',
    activeRemainderMs: Math.max(0, nowMs - (ticked.lastTickAtMs ?? nowMs)) % 1000,
  };
}

export function resumeRecording(recording: RideRecording, plan: RidePlan, nowMs: number): RideRecording {
  if (recording.status !== 'paused') return recording;
  const ticked = tick(recording, plan, nowMs);
  return {
    ...ticked,
    status: 'running',
    lastTickAtMs: nowMs - (recording.activeRemainderMs ?? 0),
    elapsedTickAtMs: ticked.elapsedTickAtMs ?? ticked.lastTickAtMs ?? nowMs,
  };
}

export function finishRecording(recording: RideRecording, plan: RidePlan, nowMs: number, latest?: RideReading): RideRecording {
  if (recording.status === 'finished' || recording.status === 'ready') return recording;
  const ticked = tick(recording, plan, nowMs, latest);
  return ticked.status === 'finished' ? ticked : { ...closeLap(ticked), status: 'finished', finishedAtMs: nowMs };
}

export function setBias(recording: RideRecording, biasPct: number): RideRecording {
  return { ...recording, biasPct: Math.min(50, Math.max(-50, Math.round(biasPct))) };
}

export function setErg(recording: RideRecording, ergEnabled: boolean): RideRecording {
  return { ...recording, ergEnabled };
}

/** A recording restored after a crash or reload resumes paused, without counting the gap. */
export function restoreRecording(recording: RideRecording): RideRecording {
  if (recording.status === 'ready' || recording.status === 'finished') return recording;
  return { ...recording, status: 'paused', lastTickAtMs: null, elapsedTickAtMs: null, activeRemainderMs: 0, pending: emptyAccumulator() };
}

export type RideSummary = {
  timerSec: number;
  elapsedSec: number;
  movingSec: number;
  distanceMeters: number;
  averagePowerWatts: number | null;
  normalizedPowerWatts: number | null;
  maxPowerWatts: number | null;
  averageHeartRateBpm: number | null;
  maxHeartRateBpm: number | null;
  averageCadenceRpm: number | null;
  workKj: number | null;
  intensityFactor: number | null;
  tss: number | null;
};

function measure(
  samples: RideSample[],
  field: 'p' | 'hr' | 'cad' | 'tgt',
  start = 0,
  end = samples.length,
) {
  let sum = 0;
  let count = 0;
  let max: number | null = null;
  for (let index = start; index < end; index += 1) {
    const value = samples[index][field];
    if (value === null || ((field === 'hr' || field === 'cad') && value <= 0)) continue;
    sum += value;
    count += 1;
    max = max === null ? value : Math.max(max, value);
  }
  return { sum, count, max, average: count > 0 ? sum / count : null };
}

export function normalizedPower(powers: Array<number | null>): number | null {
  return normalizedPowerFrom(powers.length, (index) => powers[index]);
}

export function summarizeRecording(recording: RideRecording, ftpWatts: number | null): RideSummary {
  const { samples } = recording;
  const power = measure(samples, 'p');
  const heartRate = measure(samples, 'hr');
  const cadence = measure(samples, 'cad');
  const np = normalizedPowerFrom(samples.length, (index) => samples[index].p);
  const load = measuredPowerTss(recording.timerSec, np, ftpWatts);
  const intensityFactor = load?.intensityFactor ?? null;
  const tss = load?.tss ?? null;
  return {
    timerSec: recording.timerSec,
    elapsedSec: recording.elapsedSec,
    movingSec: recording.movingSec,
    distanceMeters: Math.round(recording.distanceMeters),
    averagePowerWatts: round(power.average),
    normalizedPowerWatts: round(np),
    maxPowerWatts: power.max,
    averageHeartRateBpm: round(heartRate.average),
    maxHeartRateBpm: heartRate.max,
    averageCadenceRpm: round(cadence.average),
    workKj: power.count > 0 ? round(power.sum / 1000, 1) : null,
    intensityFactor: round(intensityFactor, 2),
    tss: round(tss),
  };
}

export type RideImportPoint = {
  elapsedSec: number;
  heartRateBpm?: number;
  powerWatts?: number;
  cadenceRpm?: number;
  speedMetersPerSecond?: number;
  distanceMeters?: number;
};

export type RideImportPayload = {
  title: string;
  sport: 'BIKING';
  startedAt: string;
  finishedAt?: string;
  durationSec: number;
  distanceMeters: number | null;
  elevationGainMeters: null;
  plannedSessionId?: number;
  points: RideImportPoint[];
  laps: Array<{ startSec: number; endSec: number; timerSec: number; origin: 'device' }>;
};

function inRange(value: number | null | undefined, min: number, max: number): number | undefined {
  return value === null || value === undefined || !Number.isFinite(value) || value < min || value > max ? undefined : value;
}

function toPoint(samples: RideSample[]): RideImportPoint {
  const avg = (pick: (sample: RideSample) => number | null) => {
    const values = samples.map(pick).filter((value): value is number => value !== null);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  };
  const last = samples[samples.length - 1];
  const point: RideImportPoint = { elapsedSec: samples[0].t };
  const power = inRange(round(avg((sample) => sample.p)), 0, 5000);
  const heartRate = inRange(round(avg((sample) => sample.hr)), 20, 260);
  const cadence = inRange(round(avg((sample) => sample.cad)), 0, 300);
  const speed = inRange(round(avg((sample) => sample.spd), 2), 0, 50);
  const distance = inRange(last.d, 0, MAX_ACTIVITY_IMPORT_DISTANCE_METERS);
  if (power !== undefined) point.powerWatts = power;
  if (heartRate !== undefined) point.heartRateBpm = heartRate;
  if (cadence !== undefined) point.cadenceRpm = cadence;
  if (speed !== undefined) point.speedMetersPerSecond = speed;
  if (distance !== undefined && distance > 0) point.distanceMeters = distance;
  return point;
}

/** Averages consecutive samples into buckets so the import stays within the point limit. */
export function downsampleSamples(samples: RideSample[], maxPoints = MAX_ACTIVITY_IMPORT_POINTS): RideImportPoint[] {
  const bucket = Math.max(1, Math.ceil(samples.length / maxPoints));
  const points: RideImportPoint[] = [];
  for (let index = 0; index < samples.length; index += bucket) points.push(toPoint(samples.slice(index, index + bucket)));
  return points;
}

/** The `/api/activity-imports` body for a finished ride attached to its planned session. */
/** `standalone` drops the planned session so the importer files the ride as its own completed activity. */
export function toImportPayload(recording: RideRecording, { standalone = false }: { standalone?: boolean } = {}): RideImportPayload {
  const durationSec = Math.max(1, recording.timerSec);
  const points = recording.samples.length ? downsampleSamples(recording.samples) : [{ elapsedSec: 0 }];
  const laps = recording.laps
    .map((lap) => ({ startSec: lap.startSec, endSec: Math.min(durationSec, lap.endSec ?? recording.timerSec) }))
    .filter((lap) => lap.endSec > lap.startSec)
    .slice(0, 500)
    .map((lap) => ({ ...lap, timerSec: lap.endSec - lap.startSec, origin: 'device' as const }));
  const startedAtMs = recording.startedAtMs ?? recording.finishedAtMs ?? 0;
  const spanSec = recording.finishedAtMs === null ? null : (recording.finishedAtMs - startedAtMs) / 1000;
  // A finish outside the importer's bounds (e.g. a checkpoint recovered days later) falls back to start + duration.
  const finishedAt = spanSec !== null && spanSec >= durationSec - ACTIVITY_IMPORT_FINISH_TOLERANCE_SEC && spanSec <= MAX_ACTIVITY_IMPORT_SPAN_SEC
    ? new Date(recording.finishedAtMs!).toISOString()
    : undefined;
  return {
    title: recording.sessionTitle.trim().slice(0, 140) || 'Indoor ride',
    sport: 'BIKING',
    startedAt: new Date(startedAtMs).toISOString(),
    ...(finishedAt ? { finishedAt } : {}),
    durationSec,
    distanceMeters: inRange(Math.round(recording.distanceMeters), 1, MAX_ACTIVITY_IMPORT_DISTANCE_METERS) ?? null,
    elevationGainMeters: null,
    ...(standalone ? {} : { plannedSessionId: recording.sessionId }),
    points,
    laps,
  };
}

type RideCheckpoint = { kind: 'tempo-ride'; version: number; savedAtMs: number; recording: RideRecording };

export function serializeCheckpoint(recording: RideRecording, savedAtMs: number): string {
  const checkpoint: RideCheckpoint = { kind: 'tempo-ride', version: RIDE_CHECKPOINT_VERSION, savedAtMs, recording };
  return JSON.stringify(checkpoint);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const nonNegativeInt = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const distance = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const timestamp = (value: unknown): value is number => nonNegativeInt(value) && value <= 8.64e15;
const nullableTimestamp = (value: unknown) => value === null || timestamp(value);
const nullableNumber = (value: unknown) => value === null || (typeof value === 'number' && Number.isFinite(value));

/** Returns the checkpoint when it is a structurally valid version-1 ride; otherwise null. */
export function parseCheckpoint(serialized: string | null): { savedAtMs: number; recording: RideRecording } | null {
  if (!serialized) return null;
  let value: unknown;
  try {
    value = JSON.parse(serialized);
  } catch {
    return null;
  }
  if (!isRecord(value) || value.kind !== 'tempo-ride' || value.version !== RIDE_CHECKPOINT_VERSION || !timestamp(value.savedAtMs) || !isRecord(value.recording)) return null;
  const r = value.recording;
  if (
    r.version !== 1 || !nonNegativeInt(r.sessionId) || r.sessionId === 0 || typeof r.sessionTitle !== 'string' || typeof r.planSignature !== 'string' ||
    (r.status !== 'ready' && r.status !== 'running' && r.status !== 'paused' && r.status !== 'finished') ||
    !(r.status === 'ready' ? r.startedAtMs === null : timestamp(r.startedAtMs)) ||
    !(r.status === 'finished' ? timestamp(r.finishedAtMs) : r.finishedAtMs === null) ||
    !nullableTimestamp(r.lastTickAtMs) || (r.elapsedTickAtMs !== undefined && !nullableTimestamp(r.elapsedTickAtMs)) ||
    (r.activeRemainderMs !== undefined && (!nonNegativeInt(r.activeRemainderMs) || r.activeRemainderMs >= 1000)) ||
    !nonNegativeInt(r.elapsedSec) || !nonNegativeInt(r.timerSec) || !nonNegativeInt(r.movingSec) || r.movingSec > r.timerSec || r.timerSec > r.elapsedSec ||
    !nonNegativeInt(r.stepIndex) || !nonNegativeInt(r.stepElapsedSec) ||
    typeof r.biasPct !== 'number' || !Number.isInteger(r.biasPct) || r.biasPct < -50 || r.biasPct > 50 ||
    typeof r.ergEnabled !== 'boolean' || !distance(r.distanceMeters) || !Array.isArray(r.samples) || !Array.isArray(r.laps) ||
    r.samples.length !== r.timerSec || !isRecord(r.pending)
  ) return null;
  if (!r.samples.every((sample: unknown, index) => isRecord(sample) && sample.t === index && nullableNumber(sample.p) &&
    nullableNumber(sample.hr) && nullableNumber(sample.cad) && nullableNumber(sample.spd) && distance(sample.d) && nullableNumber(sample.tgt))) return null;

  let lapEnd = 0;
  for (const [index, lap] of r.laps.entries()) {
    if (!isRecord(lap) || !nonNegativeInt(lap.stepIndex) || lap.startSec !== lapEnd) return null;
    if (lap.endSec === null) {
      if (index !== r.laps.length - 1 || r.status === 'ready' || r.status === 'finished') return null;
      lapEnd = r.timerSec;
    } else {
      if (!nonNegativeInt(lap.endSec) || lap.endSec < lapEnd || lap.endSec > r.timerSec) return null;
      lapEnd = lap.endSec;
    }
  }
  if (lapEnd !== r.timerSec) return null;
  return { savedAtMs: value.savedAtMs, recording: { ...(r as unknown as RideRecording), pending: emptyAccumulator() } };
}

/** Whether a recording holds anything worth recovering. */
export function hasRecordedData(recording: RideRecording): boolean {
  return recording.timerSec > 0;
}

export type RideLapStats = {
  stepIndex: number;
  startSec: number;
  durationSec: number;
  averagePowerWatts: number | null;
  maxPowerWatts: number | null;
  averageTargetWatts: number | null;
  averageHeartRateBpm: number | null;
  maxHeartRateBpm: number | null;
  averageCadenceRpm: number | null;
};

function lapStatsFor(lap: RideLap, samples: RideSample[]): RideLapStats {
  const start = Math.min(lap.startSec, samples.length);
  const end = Math.min(lap.endSec ?? samples.length, samples.length);
  const power = measure(samples, 'p', start, end);
  const heartRate = measure(samples, 'hr', start, end);
  return {
    stepIndex: lap.stepIndex,
    startSec: lap.startSec,
    durationSec: end - start,
    averagePowerWatts: round(power.average),
    maxPowerWatts: power.max,
    averageTargetWatts: round(measure(samples, 'tgt', start, end).average),
    averageHeartRateBpm: round(heartRate.average),
    maxHeartRateBpm: heartRate.max,
    averageCadenceRpm: round(measure(samples, 'cad', start, end).average),
  };
}

/** Per-lap (per plan step) averages and maxima, including the open lap. */
export function summarizeLaps(recording: Pick<RideRecording, 'laps' | 'samples'>): RideLapStats[] {
  return recording.laps.map((lap) => lapStatsFor(lap, recording.samples));
}

/** Stats for the lap in progress, or null before the ride starts. */
export function currentLapStats(recording: Pick<RideRecording, 'laps' | 'samples'>): RideLapStats | null {
  const lap = recording.laps.at(-1);
  return lap ? lapStatsFor(lap, recording.samples) : null;
}
