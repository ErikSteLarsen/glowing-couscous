import { createHash } from 'node:crypto';
import { prisma } from './prisma.ts';
import { parseFitActivity, type ParsedFitActivity } from './fit-activity.ts';
import { attachImportedActivity, listImportPairingCandidates } from './athlete-import-pairing.ts';

type Database = typeof prisma;

export type FitImportResult =
  | { ok: true; activity: ParsedFitActivity; duplicate: boolean; sessionId?: number; candidates?: Awaited<ReturnType<typeof listImportPairingCandidates>> }
  | { ok: false; status: 400 | 404 | 409; error: string };

export function createAthleteFitImportService({ db = prisma }: { db?: Database } = {}) {
  async function isAthlete(athleteId: number) {
    const athlete = await db.user.findUnique({ where: { id: athleteId }, select: { id: true, role: true } });
    return athlete?.role === 'ATHLETE';
  }

  return {
    async preview(athleteId: number, bytes: Uint8Array): Promise<FitImportResult> {
      if (!(await isAthlete(athleteId))) return { ok: false, status: 404, error: 'Athlete not found.' };
      const parsed = parseFitActivity(bytes);
      if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
      const fingerprint = createHash('sha256').update(bytes).digest('hex');
      const duplicate = await db.activity.findFirst({ where: { athleteId, importFingerprint: fingerprint }, select: { sessionId: true } });
      const candidates = duplicate ? [] : await listImportPairingCandidates(db, athleteId, parsed.activity);
      return { ok: true, activity: parsed.activity, duplicate: Boolean(duplicate), candidates, ...(duplicate ? { sessionId: duplicate.sessionId } : {}) };
    },

    async import(athleteId: number, bytes: Uint8Array, confirmed: boolean, pairingSessionId?: number | null): Promise<FitImportResult> {
      if (!confirmed) return { ok: false, status: 400, error: 'Review the activity and confirm before saving.' };
      if (!(await isAthlete(athleteId))) return { ok: false, status: 404, error: 'Athlete not found.' };
      const parsed = parseFitActivity(bytes);
      if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
      const fingerprint = createHash('sha256').update(bytes).digest('hex');
      const existing = await db.activity.findFirst({ where: { athleteId, importFingerprint: fingerprint }, select: { sessionId: true } });
      if (existing) return { ok: true, activity: parsed.activity, duplicate: true, sessionId: existing.sessionId };

      if (pairingSessionId !== undefined && pairingSessionId !== null) {
        try {
          const attached = await attachImportedActivity({
            db,
            athleteId,
            sessionId: pairingSessionId,
            activity: parsed.activity,
            metricsSource: 'fit-import',
            fingerprint,
          });
          if (attached === 'stale') {
            const retry = await db.activity.findFirst({ where: { athleteId, importFingerprint: fingerprint }, select: { sessionId: true } });
            if (retry) return { ok: true, activity: parsed.activity, duplicate: true, sessionId: retry.sessionId };
            return { ok: false, status: 409, error: 'That planned session is no longer available for this import. Review the file again and choose an available session.' };
          }
          return { ok: true, activity: parsed.activity, duplicate: false, sessionId: pairingSessionId };
        } catch {
          const retry = await db.activity.findFirst({ where: { athleteId, importFingerprint: fingerprint }, select: { sessionId: true } });
          if (retry) return { ok: true, activity: parsed.activity, duplicate: true, sessionId: retry.sessionId };
          const paired = await db.activity.findUnique({ where: { sessionId: pairingSessionId }, select: { id: true } });
          if (paired) return { ok: false, status: 409, error: 'That planned session already has an activity. Review the file again and choose an available session.' };
          throw new Error('Failed to save imported activity transactionally.');
        }
      }

      try {
        const session = await db.session.create({
          data: {
            athleteId,
            date: new Date(`${parsed.activity.completedOn}T12:00:00.000Z`),
            sport: parsed.activity.sport,
            title: parsed.activity.title,
            status: 'completed',
            source: 'athlete-fit-import',
            adjusted: false,
            coachBaselineJson: null,
            activity: {
              create: {
                athleteId,
                startedAt: parsed.activity.startedAt,
                completedAt: parsed.activity.completedAt,
                sourceTimezoneOffsetMinutes: parsed.activity.sourceTimezoneOffsetMinutes,
                durationSec: parsed.activity.durationSec,
                distanceMeters: parsed.activity.distanceMeters,
                tss: null,
                compliancePct: null,
                zoneDistributionJson: '{}',
                segmentsJson: '[]',
                metricsSource: 'fit-import',
                importFingerprint: fingerprint,
              },
            },
          },
          select: { id: true },
        });
        return { ok: true, activity: parsed.activity, duplicate: false, sessionId: session.id };
      } catch {
        const retry = await db.activity.findFirst({ where: { athleteId, importFingerprint: fingerprint }, select: { sessionId: true } });
        if (retry) return { ok: true, activity: parsed.activity, duplicate: true, sessionId: retry.sessionId };
        throw new Error('Failed to save imported activity transactionally.');
      }
    },
  };
}

export const athleteFitImportService = createAthleteFitImportService();
