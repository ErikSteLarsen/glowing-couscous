import { createHash } from 'node:crypto';
import { prisma } from './prisma.ts';
import { parseGpxActivity, type ParsedGpxActivity } from './gpx-activity.ts';
import { attachImportedActivity, listImportPairingCandidates } from './athlete-import-pairing.ts';

type Database = typeof prisma;

export type GpxImportResult =
  | { ok: true; activity: ParsedGpxActivity; duplicate: boolean; sessionId?: number; candidates?: Awaited<ReturnType<typeof listImportPairingCandidates>> }
  | { ok: false; status: 400 | 404 | 409; error: string };

export function createAthleteGpxImportService({ db = prisma }: { db?: Database } = {}) {
  async function isAthlete(athleteId: number) {
    const athlete = await db.user.findUnique({ where: { id: athleteId }, select: { id: true, role: true } });
    return athlete?.role === 'ATHLETE';
  }

  async function parse(bytes: Uint8Array, sport: string) {
    let xml: string;
    try {
      xml = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return { ok: false as const, error: 'This GPX file can’t be read. Export it again from your device or app.' };
    }
    return parseGpxActivity(xml, sport);
  }

  async function existingImport(athleteId: number, fingerprint: string) {
    return db.activity.findFirst({
      where: { athleteId, importFingerprint: fingerprint },
      select: { sessionId: true, session: { select: { sport: true, title: true } } },
    });
  }

  function savedActivity(parsed: ParsedGpxActivity, session: { sport: string; title: string } | null | undefined): ParsedGpxActivity {
    const sport = session?.sport === 'RUNNING' || session?.sport === 'BIKING' || session?.sport === 'SWIMMING'
      ? session.sport
      : parsed.sport;
    return { ...parsed, sport, title: session?.title ?? parsed.title };
  }

  return {
    async preview(athleteId: number, bytes: Uint8Array, sport: string): Promise<GpxImportResult> {
      if (!(await isAthlete(athleteId))) return { ok: false, status: 404, error: 'Account not found.' };
      const parsed = await parse(bytes, sport);
      if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
      const fingerprint = createHash('sha256').update(bytes).digest('hex');
      const duplicate = await existingImport(athleteId, fingerprint);
      const candidates = duplicate ? [] : await listImportPairingCandidates(db, athleteId, parsed.activity);
      return {
        ok: true,
        activity: duplicate ? savedActivity(parsed.activity, duplicate.session) : parsed.activity,
        duplicate: Boolean(duplicate),
        candidates,
        ...(duplicate ? { sessionId: duplicate.sessionId } : {}),
      };
    },

    async import(athleteId: number, bytes: Uint8Array, sport: string, confirmed: boolean, pairingSessionId?: number | null): Promise<GpxImportResult> {
      if (!confirmed) return { ok: false, status: 400, error: 'Check the activity, then choose Import activity.' };
      if (!(await isAthlete(athleteId))) return { ok: false, status: 404, error: 'Account not found.' };
      const parsed = await parse(bytes, sport);
      if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
      const fingerprint = createHash('sha256').update(bytes).digest('hex');
      const existing = await existingImport(athleteId, fingerprint);
      if (existing) return { ok: true, activity: savedActivity(parsed.activity, existing.session), duplicate: true, sessionId: existing.sessionId };

      if (pairingSessionId !== undefined && pairingSessionId !== null) {
        try {
          const attached = await attachImportedActivity({
            db,
            athleteId,
            sessionId: pairingSessionId,
            activity: parsed.activity,
            metricsSource: 'gpx-import',
            fingerprint,
          });
          if (attached === 'stale') {
            const retry = await existingImport(athleteId, fingerprint);
            if (retry) return { ok: true, activity: savedActivity(parsed.activity, retry.session), duplicate: true, sessionId: retry.sessionId };
            return { ok: false, status: 409, error: 'That planned workout is no longer available. Check the file again and choose another workout.' };
          }
          return { ok: true, activity: parsed.activity, duplicate: false, sessionId: pairingSessionId };
        } catch {
          const retry = await existingImport(athleteId, fingerprint);
          if (retry) return { ok: true, activity: savedActivity(parsed.activity, retry.session), duplicate: true, sessionId: retry.sessionId };
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
            source: 'athlete-gpx-import',
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
                metricsSource: 'gpx-import',
                importFingerprint: fingerprint,
              },
            },
          },
          select: { id: true },
        });
        return { ok: true, activity: parsed.activity, duplicate: false, sessionId: session.id };
      } catch {
        const retry = await existingImport(athleteId, fingerprint);
        if (retry) return { ok: true, activity: savedActivity(parsed.activity, retry.session), duplicate: true, sessionId: retry.sessionId };
        throw new Error('Could not save this activity. Try again.');
      }
    },
  };
}

export const athleteGpxImportService = createAthleteGpxImportService();
