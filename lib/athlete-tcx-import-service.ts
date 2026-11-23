import { createHash } from 'node:crypto';
import { prisma } from './prisma.ts';
import { parseTcxActivity, type ParsedTcxActivity } from './tcx-activity.ts';
import { attachImportedActivity, listImportPairingCandidates } from './athlete-import-pairing.ts';

type Database = typeof prisma;

export type TcxImportResult =
  | { ok: true; activity: ParsedTcxActivity; duplicate: boolean; sessionId?: number; candidates?: Awaited<ReturnType<typeof listImportPairingCandidates>> }
  | { ok: false; status: 400 | 404 | 409; error: string };

export function createAthleteTcxImportService({ db = prisma }: { db?: Database } = {}) {
  async function getAthlete(athleteId: number) {
    const athlete = await db.user.findUnique({ where: { id: athleteId }, select: { id: true, role: true } });
    return athlete?.role === 'ATHLETE';
  }

  return {
    async preview(athleteId: number, bytes: Uint8Array): Promise<TcxImportResult> {
      if (!(await getAthlete(athleteId))) return { ok: false, status: 404, error: 'Account not found.' };
      let xml: string;
      try { xml = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
      catch { return { ok: false, status: 400, error: 'This TCX file can’t be read. Export it again from your device or app.' }; }
      const parsed = parseTcxActivity(xml);
      if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
      const fingerprint = createHash('sha256').update(bytes).digest('hex');
      const duplicate = await db.activity.findFirst({ where: { athleteId, importFingerprint: fingerprint }, select: { sessionId: true } });
      const candidates = duplicate ? [] : await listImportPairingCandidates(db, athleteId, parsed.activity);
      return { ok: true, activity: parsed.activity, duplicate: Boolean(duplicate), candidates, ...(duplicate ? { sessionId: duplicate.sessionId } : {}) };
    },

    async import(athleteId: number, bytes: Uint8Array, confirmed: boolean, pairingSessionId?: number | null): Promise<TcxImportResult> {
      if (!confirmed) return { ok: false, status: 400, error: 'Check the activity, then choose Import activity.' };
      if (!(await getAthlete(athleteId))) return { ok: false, status: 404, error: 'Account not found.' };
      let xml: string;
      try {
        xml = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      } catch {
        return { ok: false, status: 400, error: 'This TCX file can’t be read. Export it again from your device or app.' };
      }
      const parsed = parseTcxActivity(xml);
      if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
      const fingerprint = createHash('sha256').update(bytes).digest('hex');
      const existing = await db.activity.findFirst({ where: { athleteId, importFingerprint: fingerprint }, select: { sessionId: true, completedAt: true } });
      if (existing) return { ok: true, activity: parsed.activity, duplicate: true, sessionId: existing.sessionId };

      if (pairingSessionId !== undefined && pairingSessionId !== null) {
        try {
          const attached = await attachImportedActivity({
            db,
            athleteId,
            sessionId: pairingSessionId,
            activity: parsed.activity,
            metricsSource: 'tcx-import',
            fingerprint,
          });
          if (attached === 'stale') {
            const retry = await db.activity.findFirst({ where: { athleteId, importFingerprint: fingerprint }, select: { sessionId: true } });
            if (retry) return { ok: true, activity: parsed.activity, duplicate: true, sessionId: retry.sessionId };
            return { ok: false, status: 409, error: 'That planned workout is no longer available. Check the file again and choose another workout.' };
          }
          return { ok: true, activity: parsed.activity, duplicate: false, sessionId: pairingSessionId };
        } catch {
          const retry = await db.activity.findFirst({ where: { athleteId, importFingerprint: fingerprint }, select: { sessionId: true } });
          if (retry) return { ok: true, activity: parsed.activity, duplicate: true, sessionId: retry.sessionId };
          const paired = await db.activity.findUnique({ where: { sessionId: pairingSessionId }, select: { id: true } });
          if (paired) return { ok: false, status: 409, error: 'That planned workout already has an activity. Check the file again and choose another workout.' };
          throw new Error('Could not save this activity. Try again.');
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
            source: 'athlete-tcx-import',
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
                metricsSource: 'tcx-import',
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
        throw new Error('Could not save this activity. Try again.');
      }
    },
  };
}

export const athleteTcxImportService = createAthleteTcxImportService();
