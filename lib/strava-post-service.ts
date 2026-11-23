import { prisma } from './prisma.ts';
import { parseActivityTelemetry } from './activity-metrics.ts';
import { parsePerformanceProfileJson } from './performance-profile.ts';
import { buildWorkoutProfile, type WorkoutProfileBlock } from './workout-profile.ts';
import type { WorkoutTarget, WorkoutTargetReference } from './workout-targets.ts';
import { activityTcxFilename, buildActivityTcx } from './tcx-writer.ts';
import { buildPostChartSvg, type PostChartStep } from './strava-post-chart.ts';
import {
  buildStravaPostDraft,
  createStravaUploadClient,
  effortsFromRide,
  powerShape,
  statsFromPoints,
  stravaActivityUrl,
  StravaUploadError,
  validateStravaPostText,
  type StravaPostBlock,
  type StravaPostDraft,
} from './strava-post.ts';
import { stravaApiBase, stravaService, StravaProviderError, type StravaWriteAccess } from './strava-service.ts';

/** A stale claim (a crashed request) can be taken over after this long. */
const POST_CLAIM_MS = 90_000;

export type StravaPostAvailability = 'ready' | 'posted' | 'from-strava' | 'no-data';

export type StravaPostView = {
  activityId: number;
  availability: StravaPostAvailability;
  posted: { activityId: string; url: string } | null;
  /** An upload Strava had not finished processing; posting again checks it instead of uploading twice. */
  processing: boolean;
  /** Recorded samples exist, so a .tcx file can be downloaded. */
  hasSamples: boolean;
  access: StravaWriteAccess;
  draft: StravaPostDraft;
};

export type StravaPostResult =
  | { ok: true; activityId: string; url: string; duplicate: boolean }
  | { ok: false; status: 202 | 400 | 404 | 409 | 422 | 502; error: string; reason?: 'needs-scope' | 'not-connected' | 'processing' };

async function loadActivity(userId: number, activityId: number) {
  if (!Number.isSafeInteger(activityId) || activityId <= 0) return null;
  return prisma.activity.findFirst({
    where: { id: activityId, athleteId: userId },
    include: {
      session: { include: { blocks: { orderBy: { sortOrder: 'asc' } } } },
      athlete: { select: { performanceProfileJson: true } },
    },
  });
}

type LoadedActivity = NonNullable<Awaited<ReturnType<typeof loadActivity>>>;

function postAvailability({ fromStrava, posted, hasSamples }: { fromStrava: boolean; posted: boolean; hasSamples: boolean }): StravaPostAvailability {
  if (fromStrava) return 'from-strava';
  if (posted) return 'posted';
  return hasSamples ? 'ready' : 'no-data';
}

function prepare(activity: LoadedActivity) {
  const telemetry = parseActivityTelemetry(activity.telemetryJson);
  const points = telemetry?.points ?? [];
  const profile = parsePerformanceProfileJson(activity.athlete.performanceProfileJson);
  const ftpWatts = profile.cycling.ftpWatts;
  const blocks = activity.session.blocks;
  const title = activity.session.title?.trim() || activity.importTitle?.trim() || 'Tempo activity';
  const stats = statsFromPoints(points, activity.durationSec, activity.tss);
  const postBlocks: StravaPostBlock[] = blocks.map((block) => ({ kind: block.kind, zone: block.zone, durationSec: block.durationSec, reps: block.reps, skipped: block.skipped }));
  const draft = buildStravaPostDraft({
    title,
    stats,
    blocks: postBlocks,
    distanceMeters: activity.distanceMeters ?? telemetry?.distanceMeters ?? null,
    shape: powerShape(points, activity.durationSec),
    efforts: effortsFromRide({ points, durationSec: activity.durationSec, laps: telemetry?.laps, blocks: postBlocks }),
  });
  const startedAt = activity.startedAt ?? new Date(activity.completedAt.getTime() - activity.durationSec * 1000);
  const fromStrava = activity.externalSource === 'STRAVA' || activity.metricsSource === 'strava-import';
  const hasSamples = points.length >= 2;
  const availability = postAvailability({ fromStrava, posted: Boolean(activity.stravaPostActivityId), hasSamples });
  return { telemetry, points, ftpWatts, profile, blocks, title, stats, draft, startedAt, availability, hasSamples };
}

function profileBlocks(blocks: LoadedActivity['session']['blocks']): WorkoutProfileBlock[] {
  return blocks.map((block) => {
    const target: WorkoutTarget | null = block.targetType && block.targetLow !== null && block.targetHigh !== null
      ? {
          metric: block.targetType as WorkoutTarget['metric'],
          mode: block.targetMode === 'relative' ? 'relative' : 'absolute',
          reference: block.targetReference as WorkoutTargetReference | null,
          low: Number(block.targetLowDecimal ?? block.targetLow),
          high: Number(block.targetHighDecimal ?? block.targetHigh),
        }
      : null;
    return { id: block.id, kind: block.kind, zone: block.zone, durationSec: block.durationSec, reps: block.reps, target, skipped: block.skipped };
  });
}

function tcxFor(activity: LoadedActivity, prepared: ReturnType<typeof prepare>) {
  return {
    filename: activityTcxFilename(prepared.title, prepared.startedAt),
    xml: buildActivityTcx({
      sport: activity.session.sport,
      title: prepared.title,
      startedAt: prepared.startedAt,
      durationSec: activity.durationSec,
      distanceMeters: activity.distanceMeters ?? prepared.telemetry?.distanceMeters ?? null,
      points: prepared.points,
      laps: prepared.telemetry?.laps,
    }),
  };
}

async function releaseClaim(activityId: number, data: { stravaPostUploadId?: string | null } = {}) {
  await prisma.activity.update({ where: { id: activityId }, data: { stravaPostStartedAt: null, ...data } });
}

export const stravaPostService = {
  async loadForUser(userId: number, activityId: number): Promise<StravaPostView | null> {
    const activity = await loadActivity(userId, activityId);
    if (!activity) return null;
    const prepared = prepare(activity);
    const access = prepared.availability === 'ready' ? await stravaService.writeAccessForUser(userId) : { state: 'ready' as const };
    return {
      activityId: activity.id,
      availability: prepared.availability,
      posted: activity.stravaPostActivityId ? { activityId: activity.stravaPostActivityId, url: stravaActivityUrl(activity.stravaPostActivityId) } : null,
      processing: Boolean(activity.stravaPostUploadId) && !activity.stravaPostActivityId,
      hasSamples: prepared.hasSamples,
      access,
      draft: prepared.draft,
    };
  },

  /** The recorded data as a TCX file, for any saved activity with samples. */
  async tcxForUser(userId: number, activityId: number) {
    const activity = await loadActivity(userId, activityId);
    if (!activity) return null;
    const prepared = prepare(activity);
    return prepared.hasSamples ? tcxFor(activity, prepared) : null;
  },

  /** What the shareable image shows: title, stats, the block line and the chart. */
  async imageForUser(userId: number, activityId: number, size: { width: number; height: number }) {
    const activity = await loadActivity(userId, activityId);
    if (!activity) return null;
    const prepared = prepare(activity);
    if (!prepared.hasSamples) return null;
    const model = buildWorkoutProfile(profileBlocks(prepared.blocks), { sport: activity.session.sport, profile: prepared.profile, ftpWatts: prepared.ftpWatts });
    const steps: PostChartStep[] = model.steps.map((step) => ({ startSec: step.startSec, durationSec: step.durationSec, startPct: step.startPct, endPct: step.endPct, zone: step.zone, kind: step.kind }));
    const chart = buildPostChartSvg({ points: prepared.points, durationSec: activity.durationSec, steps, ftpWatts: prepared.ftpWatts, ...size });
    return {
      title: prepared.title,
      statsLine: prepared.draft.statsLine,
      blockLine: prepared.draft.blockLine,
      date: prepared.startedAt,
      chart,
      filename: activityTcxFilename(prepared.title, prepared.startedAt).replace(/\.tcx$/, '.png'),
    };
  },

  async postForUser(userId: number, activityId: number, input: unknown): Promise<StravaPostResult> {
    const text = validateStravaPostText(input);
    if (!text.ok) return { ok: false, status: 400, error: text.error };
    const activity = await loadActivity(userId, activityId);
    if (!activity) return { ok: false, status: 404, error: 'Activity not found.' };
    if (activity.stravaPostActivityId) {
      return { ok: true, activityId: activity.stravaPostActivityId, url: stravaActivityUrl(activity.stravaPostActivityId), duplicate: false };
    }
    const prepared = prepare(activity);
    if (prepared.availability === 'from-strava') return { ok: false, status: 409, error: 'This activity came from Strava, so it’s already there.' };
    if (prepared.availability === 'no-data') return { ok: false, status: 422, error: 'This activity has no recorded data to post.' };
    const access = await stravaService.writeAccessForUser(userId);
    if (access.state === 'not-connected') return { ok: false, status: 409, reason: 'not-connected', error: 'Connect Strava to post this activity.' };
    if (access.state === 'needs-scope') return { ok: false, status: 409, reason: 'needs-scope', error: 'Reconnect Strava to allow posting.' };

    const now = new Date();
    const claim = await prisma.activity.updateMany({
      where: {
        id: activity.id,
        athleteId: userId,
        stravaPostActivityId: null,
        OR: [{ stravaPostStartedAt: null }, { stravaPostStartedAt: { lt: new Date(now.getTime() - POST_CLAIM_MS) } }],
      },
      data: { stravaPostStartedAt: now },
    });
    if (claim.count === 0) return { ok: false, status: 409, error: 'Tempo is already posting this activity. Wait a moment, then reload the page.' };

    try {
      const token = await stravaService.writeTokenForUser(userId);
      const client = createStravaUploadClient({ baseUrl: stravaApiBase() });
      let outcome = activity.stravaPostUploadId
        ? await client.waitForActivity(token, activity.stravaPostUploadId)
        : null;
      if (!outcome) {
        const tcx = tcxFor(activity, prepared);
        outcome = await client.submit(token, {
          file: tcx.xml,
          filename: tcx.filename,
          name: text.name,
          description: text.description,
          externalId: `tempo-activity-${activity.id}`,
        });
        if (outcome.status === 'processing') {
          await prisma.activity.update({ where: { id: activity.id }, data: { stravaPostUploadId: outcome.uploadId } });
          outcome = await client.waitForActivity(token, outcome.uploadId);
        }
      }
      if (outcome.status === 'posted' || outcome.status === 'duplicate') {
        await prisma.activity.update({
          where: { id: activity.id },
          data: { stravaPostActivityId: outcome.activityId, stravaPostedAt: new Date(), stravaPostStartedAt: null, stravaPostUploadId: null },
        });
        return { ok: true, activityId: outcome.activityId, url: stravaActivityUrl(outcome.activityId), duplicate: outcome.status === 'duplicate' };
      }
      if (outcome.status === 'processing') {
        await releaseClaim(activity.id);
        return { ok: false, status: 202, reason: 'processing', error: 'Strava is still processing the upload. Check again in a minute.' };
      }
      await releaseClaim(activity.id, { stravaPostUploadId: null });
      return { ok: false, status: 422, error: outcome.error };
    } catch (error) {
      await releaseClaim(activity.id);
      if (error instanceof StravaUploadError && error.reconnect) return { ok: false, status: 409, reason: 'needs-scope', error: error.message };
      if (error instanceof StravaUploadError || error instanceof StravaProviderError) return { ok: false, status: 502, error: error.message };
      return { ok: false, status: 502, error: 'Could not post to Strava. Try again.' };
    }
  },
};
