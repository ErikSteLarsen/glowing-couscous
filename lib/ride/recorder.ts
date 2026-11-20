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
export const MAX_IMPORT_POINTS = 20000;
const MAX_GAP_SEC = 12 * 60 * 60;
/** Short gaps (a throttled timer) repeat the last values; longer gaps record no sensor data. */
const HOLD_GAP_SEC = 5;

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
export function advanceStep(recording: RideRecording, plan: RidePlan): RideRecording {
  if (recording.stepIndex >= plan.steps.length || recording.status === 'finished') return recording;
  let next = closeLap(recording);
  next = skipZeroLengthSteps({ ...next, stepIndex: next.stepIndex + 1, stepElapsedSec: 0 }, plan);
  return recording.status === 'ready' ? next : openLap(next);
}

export function startRecording(recording: RideRecording, plan: RidePlan, nowMs: number): RideRecording {
  if (recording.status !== 'ready') return recording;
  const started = skipZeroLengthSteps({ ...recording, status: 'running', startedAtMs: nowMs, lastTickAtMs: nowMs }, plan);
  return openLap(started);
}

/** Advances the recording to `nowMs`, writing one sample per whole elapsed second. */
export function tick(recording: RideRecording, plan: RidePlan, nowMs: number, latest: RideReading = emptyReading): RideRecording {
  if (recording.status === 'ready' || recording.status === 'finished') return recording;
  if (recording.lastTickAtMs === null) return { ...recording, lastTickAtMs: nowMs };
  const whole = Math.min(MAX_GAP_SEC, Math.floor((nowMs - recording.lastTickAtMs) / 1000));
  if (whole <= 0) return recording;
  const lastTickAtMs = recording.lastTickAtMs + whole * 1000;
  if (recording.status === 'paused') return { ...recording, elapsedSec: recording.elapsedSec + whole, lastTickAtMs };

  const first: RideReading = {
    powerWatts: average(recording.pending.power, latest.powerWatts),
    heartRateBpm: average(recording.pending.hr, latest.heartRateBpm),
    cadenceRpm: average(recording.pending.cad, latest.cadenceRpm),
    speedMetersPerSecond: average(recording.pending.spd, latest.speedMetersPerSecond),
  };
  let next: RideRecording = { ...recording, lastTickAtMs, pending: emptyAccumulator() };
  const samples = [...recording.samples];
  for (let second = 0; second < whole; second += 1) {
    const reading = second === 0 || second < HOLD_GAP_SEC ? first : emptyReading;
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
      elapsedSec: next.elapsedSec + 1,
      movingSec: next.movingSec + (moving ? 1 : 0),
      stepElapsedSec: next.stepElapsedSec + 1,
      distanceMeters,
    };
    if (step && next.stepElapsedSec >= step.durationSec) next = advanceStep(next, plan);
  }
  return { ...next, samples };
}

export function pauseRecording(recording: RideRecording, plan: RidePlan, nowMs: number, latest?: RideReading): RideRecording {
  if (recording.status !== 'running') return recording;
  return { ...tick(recording, plan, nowMs, latest), status: 'paused' };
}

export function resumeRecording(recording: RideRecording, plan: RidePlan, nowMs: number): RideRecording {
  if (recording.status !== 'paused') return recording;
  const ticked = recording.lastTickAtMs === null ? recording : tick(recording, plan, nowMs);
  return { ...ticked, status: 'running', lastTickAtMs: nowMs, pending: emptyAccumulator() };
}

export function finishRecording(recording: RideRecording, plan: RidePlan, nowMs: number, latest?: RideReading): RideRecording {
  if (recording.status === 'finished' || recording.status === 'ready') return recording;
  const ticked = recording.status === 'running' ? tick(recording, plan, nowMs, latest) : recording;
  return { ...closeLap(ticked), status: 'finished', finishedAtMs: nowMs };
}

export function setBias(recording: RideRecording, biasPct: number): RideRecording {
  return { ...recording, biasPct: Math.min(50, Math.max(-50, Math.round(biasPct))) };
}

export function setErg(recording: RideRecording, ergEnabled: boolean): RideRecording {
  return { ...recording, ergEnabled };
}

/** A recording restored after a crash or reload resumes paused, without counting the gap. */
export function restoreRecording(recording: RideRecording): RideRecording {
  if (recording.status !== 'running') return { ...recording, lastTickAtMs: recording.status === 'paused' ? null : recording.lastTickAtMs };
  return { ...recording, status: 'paused', lastTickAtMs: null, pending: emptyAccumulator() };
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

function mean(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

export function normalizedPower(powers: Array<number | null>): number | null {
  const values = powers.map((value) => value ?? 0);
  if (!powers.some((value) => value !== null)) return null;
  if (values.length < 30) return mean(values);
  let windowSum = values.slice(0, 30).reduce((sum, value) => sum + value, 0);
  let fourthPowerSum = (windowSum / 30) ** 4;
  for (let index = 30; index < values.length; index += 1) {
    windowSum += values[index] - values[index - 30];
    fourthPowerSum += (windowSum / 30) ** 4;
  }
  return (fourthPowerSum / (values.length - 29)) ** 0.25;
}

export function summarizeRecording(recording: RideRecording, ftpWatts: number | null): RideSummary {
  const powerSamples = recording.samples.map((sample) => sample.p);
  const powers = powerSamples.filter((value): value is number => value !== null);
  const heartRates = recording.samples.map((sample) => sample.hr).filter((value): value is number => value !== null && value > 0);
  const cadences = recording.samples.map((sample) => sample.cad).filter((value): value is number => value !== null && value > 0);
  const np = normalizedPower(powerSamples);
  const intensityFactor = np !== null && ftpWatts ? np / ftpWatts : null;
  const tss = intensityFactor !== null && ftpWatts && np !== null ? (recording.timerSec * np * intensityFactor) / (ftpWatts * 3600) * 100 : null;
  return {
    timerSec: recording.timerSec,
    elapsedSec: recording.elapsedSec,
    movingSec: recording.movingSec,
    distanceMeters: Math.round(recording.distanceMeters),
    averagePowerWatts: round(mean(powers)),
    normalizedPowerWatts: round(np),
    maxPowerWatts: powers.length ? Math.max(...powers) : null,
    averageHeartRateBpm: round(mean(heartRates)),
    maxHeartRateBpm: heartRates.length ? Math.max(...heartRates) : null,
    averageCadenceRpm: round(mean(cadences)),
    workKj: powers.length ? round(powers.reduce((sum, value) => sum + value, 0) / 1000, 1) : null,
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
  durationSec: number;
  distanceMeters: number | null;
  elevationGainMeters: null;
  plannedSessionId: number;
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
  const distance = inRange(last.d, 0, 2000000);
  if (power !== undefined) point.powerWatts = power;
  if (heartRate !== undefined) point.heartRateBpm = heartRate;
  if (cadence !== undefined) point.cadenceRpm = cadence;
  if (speed !== undefined) point.speedMetersPerSecond = speed;
  if (distance !== undefined && distance > 0) point.distanceMeters = distance;
  return point;
}

/** Averages consecutive samples into buckets so the import stays within the point limit. */
export function downsampleSamples(samples: RideSample[], maxPoints = MAX_IMPORT_POINTS): RideImportPoint[] {
  const bucket = Math.max(1, Math.ceil(samples.length / maxPoints));
  const points: RideImportPoint[] = [];
  for (let index = 0; index < samples.length; index += bucket) points.push(toPoint(samples.slice(index, index + bucket)));
  return points;
}

/** The `/api/activity-imports` body for a finished ride attached to its planned session. */
export function toImportPayload(recording: RideRecording): RideImportPayload {
  const durationSec = Math.max(1, recording.timerSec);
  const points = recording.samples.length ? downsampleSamples(recording.samples) : [{ elapsedSec: 0 }];
  const laps = recording.laps
    .map((lap) => ({ startSec: lap.startSec, endSec: Math.min(durationSec, lap.endSec ?? recording.timerSec) }))
    .filter((lap) => lap.endSec > lap.startSec)
    .slice(0, 500)
    .map((lap) => ({ ...lap, timerSec: lap.endSec - lap.startSec, origin: 'device' as const }));
  return {
    title: recording.sessionTitle.trim().slice(0, 140) || 'Indoor ride',
    sport: 'BIKING',
    startedAt: new Date(recording.startedAtMs ?? recording.finishedAtMs ?? 0).toISOString(),
    durationSec,
    distanceMeters: recording.distanceMeters > 0 ? Math.round(recording.distanceMeters) : null,
    elevationGainMeters: null,
    plannedSessionId: recording.sessionId,
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

const nonNegativeInt = (value: unknown) => Number.isInteger(value) && (value as number) >= 0;
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
  if (!isRecord(value) || value.kind !== 'tempo-ride' || value.version !== RIDE_CHECKPOINT_VERSION || typeof value.savedAtMs !== 'number' || !isRecord(value.recording)) return null;
  const r = value.recording;
  if (
    r.version !== 1 || !Number.isInteger(r.sessionId) || (r.sessionId as number) <= 0 || typeof r.sessionTitle !== 'string' || typeof r.planSignature !== 'string' ||
    !['ready', 'running', 'paused', 'finished'].includes(r.status as string) || !nullableNumber(r.startedAtMs) || !nullableNumber(r.finishedAtMs) || !nullableNumber(r.lastTickAtMs) ||
    !nonNegativeInt(r.elapsedSec) || !nonNegativeInt(r.timerSec) || !nonNegativeInt(r.movingSec) || !nonNegativeInt(r.stepIndex) || !nonNegativeInt(r.stepElapsedSec) ||
    typeof r.biasPct !== 'number' || typeof r.ergEnabled !== 'boolean' || typeof r.distanceMeters !== 'number' || !Array.isArray(r.samples) || !Array.isArray(r.laps) ||
    r.samples.length !== r.timerSec || !isRecord(r.pending)
  ) return null;
  const samplesValid = (r.samples as unknown[]).every((sample, index) => isRecord(sample) && sample.t === index && nullableNumber(sample.p) && nullableNumber(sample.hr) && nullableNumber(sample.cad) && nullableNumber(sample.spd) && typeof sample.d === 'number' && nullableNumber(sample.tgt));
  const lapsValid = (r.laps as unknown[]).every((lap) => isRecord(lap) && nonNegativeInt(lap.stepIndex) && nonNegativeInt(lap.startSec) && (lap.endSec === null || nonNegativeInt(lap.endSec)));
  if (!samplesValid || !lapsValid) return null;
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
  const slice = samples.slice(lap.startSec, lap.endSec ?? samples.length);
  const pick = (read: (sample: RideSample) => number | null, positive = false) =>
    slice.map(read).filter((value): value is number => value !== null && (!positive || value > 0));
  const powers = pick((sample) => sample.p);
  const heartRates = pick((sample) => sample.hr, true);
  return {
    stepIndex: lap.stepIndex,
    startSec: lap.startSec,
    durationSec: slice.length,
    averagePowerWatts: round(mean(powers)),
    maxPowerWatts: powers.length ? Math.max(...powers) : null,
    averageTargetWatts: round(mean(pick((sample) => sample.tgt))),
    averageHeartRateBpm: round(mean(heartRates)),
    maxHeartRateBpm: heartRates.length ? Math.max(...heartRates) : null,
    averageCadenceRpm: round(mean(pick((sample) => sample.cad, true))),
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
