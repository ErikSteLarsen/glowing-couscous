import { prisma } from './prisma.ts';
import { parsePerformanceProfileJson } from './performance-profile.ts';
import { normalizeOverviewCards, parsePrefsJson } from './overview-preferences.ts';

const MAX_ROWS = 5000;
const blockFields = { kind: true, zone: true, durationSec: true, reps: true, targetType: true, targetLow: true, targetHigh: true, targetMode: true, targetReference: true, targetLowDecimal: true, targetHighDecimal: true, note: true, skipped: true, sortOrder: true } as const;

export function createAccountExportService({ db = prisma } = {}) {
  return {
    async exportForUser(userId: number) {
      return db.$transaction(async (tx) => {
        const account = await tx.user.findUnique({ where: { id: userId }, select: { email: true, name: true, createdAt: true, prefsJson: true, performanceProfileJson: true } });
        if (!account) return { ok: false as const, status: 404, error: 'Account not found.' };
        // Provider measurement data stays outside this export until its export policy is reviewed.
        const sessionWhere = { OR: [{ athleteId: userId }, { coachOwnerId: userId, athleteId: null }], NOT: { source: 'activity-import', activity: { is: { externalSource: 'STRAVA' } } } };
        const outcomeWhere = { athleteId: userId, OR: [{ externalSource: null }, { externalSource: { not: 'STRAVA' } }] };
        const counts = await Promise.all([tx.session.count({ where: sessionWhere }), tx.template.count({ where: { ownerId: userId } }), tx.activity.count({ where: outcomeWhere }), tx.plan.count({ where: { athleteId: userId } }), tx.trainingPlan.count({ where: { coachOwnerId: userId } })]);
        if (counts.some((count) => count > MAX_ROWS)) return { ok: false as const, status: 413, error: 'This account is too large for a single download. No partial export was created.' };
        const blockCount = await tx.block.count({ where: { OR: [{ session: { is: sessionWhere } }, { template: { is: { ownerId: userId } } }] } });
        if (blockCount > 10_000) return { ok: false as const, status: 413, error: 'This account exceeds the workout-block download limit. No partial export was created.' };
        const [sessions, templates, outcomes, personalPlans, libraryPlans] = await Promise.all([
          tx.session.findMany({ where: sessionWhere, take: MAX_ROWS, orderBy: { id: 'asc' }, select: { id: true, date: true, planWeekday: true, timeLabel: true, sport: true, title: true, summary: true, athleteNotes: true, rpe: true, status: true, source: true, planId: true, trainingPlanId: true, createdAt: true, updatedAt: true, blocks: { select: blockFields, orderBy: { sortOrder: 'asc' }, take: 1001 } } }),
          tx.template.findMany({ where: { ownerId: userId }, take: MAX_ROWS, orderBy: { id: 'asc' }, select: { id: true, name: true, sport: true, cadence: true, summary: true, blocks: { select: blockFields, orderBy: { sortOrder: 'asc' }, take: 1001 } } }),
          tx.activity.findMany({ where: outcomeWhere, take: MAX_ROWS, orderBy: { id: 'asc' }, select: { id: true, sessionId: true, completedAt: true, durationSec: true, tss: true, compliancePct: true, notes: true, metricsSource: true, distanceMeters: true, elevationGainMeters: true, rpe: true } }),
          tx.plan.findMany({ where: { athleteId: userId }, take: MAX_ROWS, orderBy: { id: 'asc' }, select: { id: true, name: true, startDate: true, endDate: true, goalRace: true } }),
          tx.trainingPlan.findMany({ where: { coachOwnerId: userId }, take: MAX_ROWS, orderBy: { id: 'asc' }, select: { id: true, name: true, summary: true, sport: true } }),
        ]);
        if ([...sessions, ...templates].some((entry) => entry.blocks.length > 1000)) return { ok: false as const, status: 413, error: 'A workout exceeds the download limit. No partial export was created.' };
        const data = { format: 'tempo-account-export', version: 1, exportedAt: new Date().toISOString(), exclusions: ['Strava measurements and standalone Strava imports', 'Provider tokens and credentials', 'Other people’s accounts and assignments', 'Local browser drafts', 'Raw sensor recordings and internal snapshots'], account: { email: account.email, name: account.name, createdAt: account.createdAt, performanceProfile: parsePerformanceProfileJson(account.performanceProfileJson), preferences: { overviewCards: normalizeOverviewCards(parsePrefsJson(account.prefsJson).overviewCards) } }, sessions, templates, outcomes, personalPlans, libraryPlans };
        const json = JSON.stringify(data, null, 2);
        if (Buffer.byteLength(json, 'utf8') > 20_000_000) return { ok: false as const, status: 413, error: 'This account exceeds the download size limit. No partial export was created.' };
        return { ok: true as const, json };
      }, { isolationLevel: 'RepeatableRead', timeout: 30_000 });
    },
  };
}

export const accountExportService = createAccountExportService();
