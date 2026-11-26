import type { ActivitySeriesPoint } from './activity-series.ts';
import { normalizedPowerFrom } from './measured-power-load.ts';
import { groupSessionStructure, type StructureBlock } from './session-structure.ts';

/** Strava limits are generous; keep posts short and inside what TempoBuilder can show in the preview. */
export const STRAVA_POST_TITLE_MAX = 120;
export const STRAVA_POST_DESCRIPTION_MAX = 1000;

export type StravaPostBlock = { kind: string; zone: number; durationSec: number; reps: number | null; skipped?: boolean };

export type StravaPostStats = {
  durationSec: number;
  averagePowerWatts: number | null;
  normalizedPowerWatts: number | null;
  averageHeartRateBpm: number | null;
  maxHeartRateBpm: number | null;
  tss: number | null;
};

/** One hard block as ridden: its planned length and the average power actually held. */
export type StravaPostEffort = { durationSec: number; averagePowerWatts: number };

export type StravaPostDraft = { name: string; description: string; statsLine: string; blockLine: string | null };

const SHAPE_BARS = '▁▂▃▄▅▆▇█';
const SHAPE_WIDTH = 24;

/** "4 min", "30 s", "3:30", "90 min", "1:05:30". */
export function formatPostDuration(durationSec: number) {
  const total = Math.max(0, Math.round(durationSec));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (total < 60) return `${total} s`;
  if (seconds === 0) return `${total / 60} min`;
  if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Ride time for the stats line: "1h 05m" or "42 min". */
function formatRideTime(durationSec: number) {
  const total = Math.max(0, Math.round(durationSec));
  const hours = Math.floor(total / 3600);
  const minutes = Math.round((total % 3600) / 60);
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  return total < 60 ? `${total} s` : `${Math.max(1, minutes)} min`;
}

function blockIntensity(block: StravaPostBlock) {
  return block.kind === 'pause' ? 'pause' : block.zone <= 1 ? 'easy' : `Z${block.zone}`;
}

function blockPhrase(block: StravaPostBlock) {
  return `${formatPostDuration(block.durationSec)} ${blockIntensity(block)}`;
}

/**
 * One line for the main work, e.g. "4 × 4 min Z5 – 3:30 easy". Warm-up and cool-down are left out;
 * at most three parts are named so the line stays short.
 */
export function summarizeBlocksForPost(blocks: StravaPostBlock[]): string | null {
  // Read every block as effort or easy so repeats fold whatever kind the builder stored.
  const active = blocks
    .filter((block) => !block.skipped && block.durationSec > 0)
    .map((block) => ({
      ...block,
      kind: ['warmup', 'cooldown', 'pause', 'recovery'].includes(block.kind) ? block.kind : block.zone <= 1 ? 'recovery' : 'work',
    }));
  // Easy blocks before the first and after the last hard block act as warm-up and cool-down.
  const hard = (block: StravaPostBlock) => block.kind === 'work' && block.zone >= 3;
  const firstHard = active.findIndex(hard);
  const lastHard = active.findLastIndex(hard);
  const main = firstHard < 0
    ? active.filter((block) => block.kind !== 'warmup' && block.kind !== 'cooldown')
    : active.slice(firstHard, lastHard + 1);
  const structure: StructureBlock[] = main.map((block, index) => ({
    id: index, kind: block.kind, zone: block.zone, durationSec: block.durationSec, reps: block.reps,
    targetLabel: null, note: null, skipped: false,
  }));
  const parts: string[] = [];
  for (const group of groupSessionStructure(structure)) {
    const [first, second] = group.pattern;
    if (group.repeats > 1 && group.recoveryCount > 0 && second) {
      parts.push(`${group.repeats} × ${blockPhrase(first)} – ${blockPhrase(second)}`);
    } else if (group.repeats > 1) {
      parts.push(`${group.repeats} × ${group.pattern.length === 1 ? blockPhrase(first) : `(${group.pattern.map(blockPhrase).join(' + ')})`}`);
    } else {
      for (const block of group.pattern) {
        if (block.kind !== 'work') continue;
        parts.push(block.reps && block.reps > 1 ? `${block.reps} × ${blockPhrase(block)}` : blockPhrase(block));
      }
    }
  }
  if (parts.length === 0) return null;
  return parts.length > 3 ? `${parts.slice(0, 3).join(' + ')} + more` : parts.join(' + ');
}

/** Average and 30-second normalized power, and average heart rate, holding each sample until the next (max 15 s). */
export function statsFromPoints(points: ActivitySeriesPoint[], durationSec: number, tss: number | null): StravaPostStats {
  const length = Math.max(0, Math.round(durationSec));
  const power: Array<number | null> = new Array(length).fill(null);
  const heart: Array<number | null> = new Array(length).fill(null);
  const ordered = [...points].sort((left, right) => left.elapsedSec - right.elapsedSec);
  for (let index = 0; index < ordered.length; index += 1) {
    const start = Math.max(0, ordered[index].elapsedSec);
    const end = Math.min(length, ordered[index + 1]?.elapsedSec ?? length, start + 15);
    for (let second = start; second < end; second += 1) {
      power[second] = ordered[index].powerWatts ?? null;
      heart[second] = ordered[index].heartRateBpm ?? null;
    }
  }
  const average = (values: Array<number | null>) => {
    const present = values.filter((value): value is number => value !== null);
    return present.length ? present.reduce((sum, value) => sum + value, 0) / present.length : null;
  };
  const roundOrNull = (value: number | null) => value === null ? null : Math.round(value);
  return {
    durationSec: length,
    averagePowerWatts: roundOrNull(average(power)),
    // NP needs mostly continuous power; across long gaps it would read as a fraction of the real effort.
    normalizedPowerWatts: power.filter((value) => value !== null).length >= length / 2
      ? roundOrNull(normalizedPowerFrom(length, (index) => power[index]))
      : null,
    averageHeartRateBpm: roundOrNull(average(heart)),
    maxHeartRateBpm: ordered.reduce<number | null>((max, point) => point.heartRateBpm == null ? max : Math.max(max ?? 0, point.heartRateBpm), null),
    tss: tss === null ? null : Math.round(tss),
  };
}

function averagePowerBetween(points: ActivitySeriesPoint[], startSec: number, endSec: number) {
  const values = points
    .filter((point) => point.elapsedSec >= startSec && point.elapsedSec < endSec && point.powerWatts != null)
    .map((point) => point.powerWatts as number);
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
}

/** The ride's power as a row of bars, e.g. "▃▃▃██▁▃█▆▁▅█". Null when power wasn't recorded. */
export function powerShape(points: ActivitySeriesPoint[], durationSec: number, width = SHAPE_WIDTH): string | null {
  const span = Math.max(1, Math.round(durationSec));
  const buckets: Array<number | null> = Array.from({ length: width }, (_, index) => averagePowerBetween(points, (index * span) / width, ((index + 1) * span) / width));
  const present = buckets.filter((value): value is number => value !== null);
  if (present.length < width / 2) return null;
  const low = Math.min(...present);
  const range = Math.max(1, Math.max(...present) - low);
  return buckets.map((value) => value === null ? SHAPE_BARS[0] : SHAPE_BARS[Math.round(((value - low) / range) * (SHAPE_BARS.length - 1))]).join('');
}

const isHardBlock = (block: StravaPostBlock) => block.kind !== 'pause' && block.kind !== 'warmup' && block.kind !== 'cooldown' && block.kind !== 'recovery' && block.zone >= 3;

/**
 * Average power for each hard block as ridden. Uses the recorded laps when they line up one-to-one with
 * the plan (a TempoBuilder Ride recording without skips), otherwise the plan's timing when the ride lasted as
 * long as the plan. Returns null when neither is trustworthy, so the post never states a made-up number.
 */
export function effortsFromRide(input: { points: ActivitySeriesPoint[]; durationSec: number; laps?: { startSec: number; endSec: number }[]; blocks: StravaPostBlock[] }): StravaPostEffort[] | null {
  const planned = input.blocks
    .filter((block) => !block.skipped && block.durationSec > 0)
    .flatMap((block) => Array.from({ length: Math.max(1, block.reps ?? 1) }, () => block));
  if (!planned.some(isHardBlock)) return null;
  let windows: { startSec: number; endSec: number }[] | null = null;
  if (input.laps && input.laps.length === planned.length) {
    windows = input.laps;
  } else if (!input.laps?.length) {
    const plannedSec = planned.reduce((sum, block) => sum + block.durationSec, 0);
    if (Math.abs(plannedSec - input.durationSec) <= Math.max(30, plannedSec * 0.03)) {
      let start = 0;
      windows = planned.map((block) => ({ startSec: start, endSec: (start += block.durationSec) }));
    }
  }
  if (!windows) return null;
  const efforts: StravaPostEffort[] = [];
  for (const [index, block] of planned.entries()) {
    if (!isHardBlock(block)) continue;
    const watts = averagePowerBetween(input.points, windows[index].startSec, windows[index].endSec);
    if (watts === null) return null;
    efforts.push({ durationSec: block.durationSec, averagePowerWatts: watts });
  }
  return efforts;
}

/** "🔥 4 × 4 min: 301 – 300 – 301 – 300 W" when the efforts share a length, otherwise "🔥 Efforts: 320 – 301 W". */
export function formatEffortLine(efforts: StravaPostEffort[]) {
  if (efforts.length === 0) return null;
  const shown = efforts.slice(0, 10).map((effort) => effort.averagePowerWatts).join(' – ');
  const more = efforts.length > 10 ? ' …' : '';
  const sameLength = efforts.every((effort) => effort.durationSec === efforts[0].durationSec);
  if (!sameLength) return `🔥 Efforts: ${shown}${more} W`;
  const length = formatPostDuration(efforts[0].durationSec);
  return efforts.length === 1 ? `🔥 ${length}: ${shown} W` : `🔥 ${efforts.length} × ${length}: ${shown}${more} W`;
}

/**
 * The "clean card" description: grouped numbers with emoji labels, the power shape, and the hard
 * efforts. Lines without data are left out rather than shown as dashes.
 */
export function formatCleanCard(input: { stats: StravaPostStats; distanceMeters: number | null; shape: string | null; efforts: StravaPostEffort[] | null; blockLine: string | null }) {
  const { stats } = input;
  const power = [
    stats.averagePowerWatts !== null ? `${stats.averagePowerWatts} W avg` : null,
    stats.normalizedPowerWatts !== null ? `${stats.normalizedPowerWatts} W NP` : null,
  ].filter(Boolean).join(' – ');
  const heart = [
    stats.averageHeartRateBpm !== null ? `${stats.averageHeartRateBpm} bpm avg` : null,
    stats.maxHeartRateBpm !== null ? `${stats.maxHeartRateBpm} max` : null,
  ].filter(Boolean).join(' – ');
  const time = [
    formatRideTime(stats.durationSec),
    input.distanceMeters && input.distanceMeters > 0 ? `${(input.distanceMeters / 1000).toFixed(1)} km` : null,
    stats.tss !== null ? `TSS ${stats.tss}` : null,
  ].filter(Boolean).join(' – ');
  const numbers = [power ? `⚡ ${power}` : null, heart ? `❤️ ${heart}` : null, `⏱ ${time}`].filter(Boolean).join('\n');
  const work = (input.efforts && formatEffortLine(input.efforts)) ?? (input.blockLine ? `🔥 ${input.blockLine}` : null);
  return [numbers, input.shape, work].filter(Boolean).join('\n\n');
}

export function formatStatsLine(stats: StravaPostStats) {
  return [
    formatRideTime(stats.durationSec),
    stats.averagePowerWatts !== null ? `${stats.averagePowerWatts} W avg` : null,
    stats.normalizedPowerWatts !== null ? `NP ${stats.normalizedPowerWatts} W` : null,
    stats.averageHeartRateBpm !== null ? `${stats.averageHeartRateBpm} bpm` : null,
    stats.tss !== null ? `TSS ${stats.tss}` : null,
  ].filter(Boolean).join(' – ');
}

export function buildStravaPostDraft(input: {
  title: string;
  stats: StravaPostStats;
  blocks: StravaPostBlock[];
  distanceMeters?: number | null;
  shape?: string | null;
  efforts?: StravaPostEffort[] | null;
}): StravaPostDraft {
  const statsLine = formatStatsLine(input.stats);
  const blockLine = summarizeBlocksForPost(input.blocks);
  return {
    name: input.title.trim().slice(0, STRAVA_POST_TITLE_MAX) || 'TempoBuilder ride',
    description: formatCleanCard({ stats: input.stats, distanceMeters: input.distanceMeters ?? null, shape: input.shape ?? null, efforts: input.efforts ?? null, blockLine }),
    statsLine,
    blockLine,
  };
}

export function validateStravaPostText(input: unknown): { ok: true; name: string; description: string } | { ok: false; error: string } {
  const value = input && typeof input === 'object' ? input as Record<string, unknown> : {};
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const description = typeof value.description === 'string' ? value.description.replace(/\r\n/g, '\n').trim() : '';
  if (!name) return { ok: false, error: 'Add a title for the Strava post.' };
  if (name.length > STRAVA_POST_TITLE_MAX) return { ok: false, error: `Keep the title to ${STRAVA_POST_TITLE_MAX} characters.` };
  if (description.length > STRAVA_POST_DESCRIPTION_MAX) return { ok: false, error: `Keep the description to ${STRAVA_POST_DESCRIPTION_MAX} characters.` };
  return { ok: true, name, description };
}

/** Strava returns granted scopes space- or comma-separated. */
export function parseStravaScopes(scopes: string | null | undefined) {
  return (scopes ?? '').split(/[\s,]+/).filter(Boolean);
}

export function hasStravaWriteScope(scopes: string | null | undefined) {
  return parseStravaScopes(scopes).includes('activity:write');
}

/** What TempoBuilder asks for when connecting: read the inbox, and upload activities you choose to post. */
export const STRAVA_REQUESTED_SCOPES = 'activity:read,activity:read_all,activity:write';

export function stravaActivityUrl(activityId: string) {
  return `https://www.strava.com/activities/${activityId}`;
}

/** Only same-origin app paths may be used as a return target after connecting Strava. */
export function safeStravaReturnPath(value: string | null | undefined) {
  if (!value || value.length > 300) return null;
  if (!/^\/athlete\/[A-Za-z0-9/_\-?=&%.]*$/.test(value) || value.includes('//') || value.includes('..')) return null;
  return value;
}

// ── Upload client ────────────────────────────────────────────────────────────

export type StravaUploadOutcome =
  | { status: 'posted'; activityId: string }
  | { status: 'duplicate'; activityId: string }
  | { status: 'processing'; uploadId: string }
  | { status: 'failed'; error: string };

export class StravaUploadError extends Error {
  readonly status: number;
  readonly reconnect: boolean;
  constructor(message: string, status: number, reconnect = false) {
    super(message);
    this.status = status;
    this.reconnect = reconnect;
  }
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export type StravaUploadClientOptions = {
  baseUrl: string;
  fetch?: FetchLike;
  sleep?: (ms: number) => Promise<void>;
  /** Strava asks for at least one second between polls. */
  pollIntervalMs?: number;
  maxPolls?: number;
  pollBudgetMs?: number;
};

type UploadRecord = { id?: unknown; id_str?: unknown; error?: unknown; status?: unknown; activity_id?: unknown };

function idString(value: unknown, fallback?: unknown) {
  if (typeof value === 'string' && /^\d{1,20}$/.test(value)) return value;
  if (typeof fallback === 'number' && Number.isSafeInteger(fallback) && fallback > 0) return String(fallback);
  if (typeof fallback === 'string' && /^\d{1,20}$/.test(fallback)) return fallback;
  return null;
}

/** "… duplicate of activity 123" or "duplicate of <a href='/activities/123'>…</a>". */
export function duplicateActivityId(error: string) {
  const match = error.match(/duplicate of\D{0,80}?(\d{1,20})/i);
  return match ? match[1] : null;
}

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

/** Turns one upload status record into an outcome; `null` while Strava is still processing. */
export function interpretUpload(record: UploadRecord): StravaUploadOutcome | null {
  const error = typeof record.error === 'string' && record.error.trim() ? record.error : null;
  if (error) {
    const duplicate = duplicateActivityId(error);
    if (duplicate) return { status: 'duplicate', activityId: duplicate };
    const reason = stripHtml(error).slice(0, 200);
    return { status: 'failed', error: reason ? `Strava couldn’t use this activity: ${reason}` : 'Strava couldn’t use this activity.' };
  }
  const activityId = idString(undefined, record.activity_id);
  if (activityId) return { status: 'posted', activityId };
  if (typeof record.status === 'string' && /deleted/i.test(record.status)) {
    return { status: 'failed', error: 'The activity was deleted on Strava.' };
  }
  return null;
}

async function readUploadResponse(response: Response): Promise<UploadRecord> {
  let body: unknown = null;
  try { body = await response.json(); } catch { body = null; }
  if (response.ok) return body && typeof body === 'object' ? body as UploadRecord : {};
  if (response.status === 401 || response.status === 403) {
    throw new StravaUploadError('Strava didn’t allow TempoBuilder to post. Reconnect Strava and allow uploads.', response.status, true);
  }
  if (response.status === 429) throw new StravaUploadError('Strava is busy. Try again in a few minutes.', 429);
  // A 400 from /uploads still carries the processing error (for example a duplicate).
  if (response.status === 400 && body && typeof body === 'object' && typeof (body as UploadRecord).error === 'string') return body as UploadRecord;
  throw new StravaUploadError('Strava isn’t responding right now. Try again later.', response.status);
}

export function createStravaUploadClient(options: StravaUploadClientOptions) {
  const doFetch: FetchLike = options.fetch ?? ((input, init) => fetch(input, init));
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const pollIntervalMs = Math.max(1000, options.pollIntervalMs ?? 1500);
  const maxPolls = options.maxPolls ?? 8;
  const pollBudgetMs = options.pollBudgetMs ?? 15_000;
  const base = options.baseUrl.replace(/\/+$/, '');

  return {
    /** POST /uploads; resolves to an outcome or, while processing, the upload id. */
    async submit(token: string, input: { file: string; filename: string; name: string; description: string; externalId: string }): Promise<StravaUploadOutcome> {
      const form = new FormData();
      form.set('file', new Blob([input.file], { type: 'application/vnd.garmin.tcx+xml' }), input.filename);
      form.set('data_type', 'tcx');
      form.set('name', input.name);
      form.set('description', input.description);
      form.set('external_id', input.externalId);
      const record = await readUploadResponse(await doFetch(`${base}/uploads`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
        body: form,
        cache: 'no-store',
        signal: AbortSignal.timeout(20_000),
      }));
      const outcome = interpretUpload(record);
      if (outcome) return outcome;
      const uploadId = idString(record.id_str, record.id);
      if (!uploadId) throw new StravaUploadError('Strava didn’t respond as expected. Try again in a moment.', 502);
      return { status: 'processing', uploadId };
    },

    /** GET /uploads/{id} until an activity id or an error appears, or the poll budget runs out. */
    async waitForActivity(token: string, uploadId: string): Promise<StravaUploadOutcome> {
      const deadline = performance.now() + pollBudgetMs;
      const signal = AbortSignal.timeout(pollBudgetMs);
      try {
        for (let attempt = 0; attempt < maxPolls && deadline - performance.now() >= pollIntervalMs; attempt += 1) {
          await sleep(pollIntervalMs);
          if (signal.aborted) break;
          const record = await readUploadResponse(await doFetch(`${base}/uploads/${encodeURIComponent(uploadId)}`, {
            headers: { authorization: `Bearer ${token}` },
            cache: 'no-store',
            signal,
          }));
          if (signal.aborted) break;
          const outcome = interpretUpload(record);
          if (outcome) return outcome;
        }
      } catch (error) {
        if (!signal.aborted) throw error;
      }
      return { status: 'processing', uploadId };
    },
  };
}
