import { randomUUID } from 'node:crypto';
import { prisma } from './prisma.ts';
import { parseActivityTelemetry } from './activity-metrics.ts';
import { parsePerformanceProfileJson } from './performance-profile.ts';
import { ACTIVITY_ANALYZER_VERSION, analyzeActivity, type ActivityAnalysisResult } from './activity-analysis.ts';
import { activityAnalysisInputHash, isActivityAnalysisEligible, newActivityAnalysisJob } from './activity-analysis-job.ts';
import { interpretActivityEvidence } from './activity-analysis-llm.ts';

export type AnalysisCorrection = { repetitions: number; durationSec: number; recoverySec: number | null; paceSecPerKm: number | null };
export type ActivityAnalysisView = { eligible: boolean; status: string; result: ActivityAnalysisResult | null;
  correction: AnalysisCorrection | null; updatedAt: string | null; error: string | null; profileChanged: boolean };
export function validateAnalysisCorrection(input: unknown): AnalysisCorrection | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  const valid = (n: unknown, min: number, max: number) => typeof n === 'number' && Number.isInteger(n) && n >= min && n <= max;
  if (!valid(value.repetitions, 1, 100) || !valid(value.durationSec, 1, 3600) ||
    (value.recoverySec !== null && !valid(value.recoverySec, 0, 3600)) ||
    (value.paceSecPerKm !== null && !valid(value.paceSecPerKm, 120, 1800))) return null;
  return { repetitions: Number(value.repetitions), durationSec: Number(value.durationSec),
    recoverySec: value.recoverySec as number | null, paceSecPerKm: value.paceSecPerKm as number | null };
}
function parseJson<T>(value: string | null): T | null { try { return value ? JSON.parse(value) as T : null; } catch { return null; } }
const fail = (status: number, error: string) => ({ ok: false as const, status, error });

export function createActivityAnalysisService({ db = prisma, now = () => new Date(), interpret = interpretActivityEvidence }: {
  db?: typeof prisma; now?: () => Date; interpret?: (value: ActivityAnalysisResult) => Promise<ActivityAnalysisResult>;
} = {}) {
  async function owned(userId: number, activityId: number) {
    if (!Number.isSafeInteger(activityId) || activityId < 1) return null;
    return db.activity.findFirst({ where: { id: activityId, athleteId: userId },
      include: { session: { select: { sport: true } }, analysis: true, athlete: { select: { performanceProfileJson: true } } } });
  }
  return {
    async readForUser(userId: number, activityId: number): Promise<ActivityAnalysisView | null> {
      const activity = await owned(userId, activityId);
      if (!activity) return null;
      const row = activity.analysis;
      return { eligible: isActivityAnalysisEligible(activity), status: row?.status ?? 'not-requested',
        result: parseJson<ActivityAnalysisResult>(row?.resultJson ?? null), correction: parseJson<AnalysisCorrection>(row?.correctionJson ?? null),
        error: row?.lastError ?? null, updatedAt: row?.updatedAt.toISOString() ?? null,
        profileChanged: Boolean(row && row.profileJson !== (activity.athlete.performanceProfileJson ?? '{}')) };
    },
    async requestForUser(userId: number, activityId: number) {
      if (!Number.isSafeInteger(activityId) || activityId < 1) return fail(404, 'Imported activity not found.');
      return db.$transaction(async tx => {
        // Serialize with import/account deletion and other requests. No jobs outlive their Activity.
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
        const locked = await tx.$queryRaw<Array<{ id: number }>>`SELECT "id" FROM "Activity" WHERE "id" = ${activityId} AND "athleteId" = ${userId} FOR UPDATE`;
        if (!locked.length) return fail(404, 'Imported activity not found.');
        const activity = await tx.activity.findUnique({ where: { id: activityId }, include: {
          session: { select: { sport: true } }, athlete: { select: { performanceProfileJson: true } }, analysis: true } });
        if (!activity || !isActivityAnalysisEligible(activity)) return fail(400, 'Analysis is only available for runs imported from a file.');
        if (!activity.telemetryJson) return fail(400, 'This activity has no recorded data.');
        if (activity.analysis && ['queued', 'processing', 'retry'].includes(activity.analysis.status)) return { ok: true as const };
        if (activity.analysis && now().getTime() - activity.analysis.updatedAt.getTime() < 60_000) return fail(429, 'Wait a minute before you analyze again.');
        const active = await tx.activityAnalysis.count({ where: { activity: { athleteId: userId }, status: { in: ['queued', 'processing', 'retry'] } } });
        if (active >= 10) return fail(429, 'TempoBuilder is still analyzing other workouts. Try again when they’re done.');
        const data = newActivityAnalysisJob(activity.telemetryJson, activity.durationSec, activity.athlete.performanceProfileJson ?? '{}');
        await tx.activityAnalysis.upsert({ where: { activityId }, create: { activityId, ...data },
          update: { ...data, status: 'queued', attemptCount: 0, leaseToken: null, leaseUntil: null, nextAttemptAt: now(), resultJson: null, lastError: null } });
        return { ok: true as const };
      });
    },
    async correctForUser(userId: number, activityId: number, input: unknown) {
      const correction = validateAnalysisCorrection(input);
      if (!correction) return fail(400, 'Check the reps, effort time, recovery time and pace.');
      const saved = await db.activityAnalysis.updateMany({ where: { activityId, activity: { athleteId: userId, metricsSource: 'file-import', externalSource: null, session: { sport: 'RUNNING' } },
        status: { in: ['completed', 'insufficient-data'] } }, data: { correctionJson: JSON.stringify(correction) } });
      return saved.count ? { ok: true as const } : fail(404, 'Analyze this workout first.');
    },
    async processPending(ownerId?: number, limit = 2) {
      const due = await db.activityAnalysis.findMany({ where: { ...(ownerId === undefined ? {} : { activity: { athleteId: ownerId } }), OR: [
        { status: { in: ['queued', 'retry'] }, nextAttemptAt: { lte: now() } }, { status: 'processing', leaseUntil: { lte: now() } } ] },
        orderBy: { nextAttemptAt: 'asc' }, take: Math.min(limit, 2), select: { activityId: true } });
      for (const row of due) await this.processOne(row.activityId, ownerId);
      return due.length;
    },
    async processOne(activityId: number, ownerId?: number) {
      const token = randomUUID(), current = now();
      const claim = await db.$transaction(async tx => {
        // Serialize only the short claims, not detection/model calls; cap global concurrency.
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(73421901)`;
        const owner = ownerId === undefined ? {} : { activity: { athleteId: ownerId } };
        await tx.activityAnalysis.updateMany({ where: { activityId, ...owner, status: 'processing', leaseUntil: { lte: current }, attemptCount: { gte: 3 } },
          data: { status: 'failed', leaseToken: null, leaseUntil: null, lastError: 'The analysis took too long. Choose Try again.' } });
        if (await tx.activityAnalysis.count({ where: { status: 'processing', leaseUntil: { gt: current } } }) >= 4) return { count: 0 };
        return tx.activityAnalysis.updateMany({ where: { activityId, ...owner, attemptCount: { lt: 3 }, OR: [
          { status: { in: ['queued', 'retry'] }, nextAttemptAt: { lte: current } }, { status: 'processing', leaseUntil: { lte: current } } ] },
          data: { status: 'processing', leaseToken: token, leaseUntil: new Date(current.getTime() + 120_000), attemptCount: { increment: 1 } } });
      });
      if (!claim.count) return;
      const row = await db.activityAnalysis.findUnique({ where: { activityId }, include: { activity: { include: { session: { select: { sport: true } } } } } });
      if (!row || row.leaseToken !== token) return;
      try {
        const activity = row.activity;
        if (!isActivityAnalysisEligible(activity) || !activity.telemetryJson || row.version !== ACTIVITY_ANALYZER_VERSION) {
          await db.activityAnalysis.updateMany({ where: { activityId, leaseToken: token }, data: { status: 'cancelled', leaseToken: null, leaseUntil: null, resultJson: null, lastError: row.version !== ACTIVITY_ANALYZER_VERSION ? 'TempoBuilder’s analysis has been updated. Analyze again.' : 'This activity can’t be analyzed.' } });
          return;
        }
        const telemetry = parseActivityTelemetry(activity.telemetryJson);
        if (!telemetry) throw new Error('Invalid telemetry');
        const measured = analyzeActivity(telemetry, activity.durationSec, parsePerformanceProfileJson(row.profileJson));
        const result = await interpret(measured);
        await db.$transaction(async tx => {
          const locked = await tx.$queryRaw<Array<{ id: number }>>`SELECT "id" FROM "Activity" WHERE "id" = ${activityId} FOR UPDATE`;
          if (!locked.length) return;
          const latest = await tx.activity.findUnique({ where: { id: activityId }, include: { session: { select: { sport: true } } } });
          if (!latest || !isActivityAnalysisEligible(latest) || !latest.telemetryJson ||
            activityAnalysisInputHash(latest.telemetryJson, latest.durationSec, row.profileJson) !== row.inputHash) {
            await tx.activityAnalysis.updateMany({ where: { activityId, leaseToken: token }, data: { status: 'cancelled', resultJson: null, leaseToken: null, leaseUntil: null, lastError: 'The recorded data changed. Analyze again.' } });
            return;
          }
          await tx.activityAnalysis.updateMany({ where: { activityId, leaseToken: token, status: 'processing', leaseUntil: { gt: now() }, inputHash: row.inputHash },
            data: { status: measured.workSummary.coverage > 0.3 ? 'completed' : 'insufficient-data', resultJson: JSON.stringify(result), lastError: null, leaseToken: null, leaseUntil: null } });
        });
      } catch {
        await db.activityAnalysis.updateMany({ where: { activityId, leaseToken: token, status: 'processing' },
          data: { status: row.attemptCount >= 3 ? 'failed' : 'retry', leaseToken: null, leaseUntil: null,
            nextAttemptAt: new Date(now().getTime() + 30_000 * 2 ** Math.min(row.attemptCount, 5) + Math.floor(Math.random() * 5000)),
            lastError: 'The analysis couldn’t finish. Your recorded data is still here.' } });
      }
    },
  };
}
export const activityAnalysisService = createActivityAnalysisService();
