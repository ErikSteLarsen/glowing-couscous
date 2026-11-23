import { isValid, parseISO } from 'date-fns';
import { SPORT_OPTIONS } from './sport.ts';
import { prisma } from './prisma.ts';
import { listImportPairingCandidates, snapshotPlannedSession, dateRangeForDay } from './athlete-import-pairing.ts';

const MAX_TITLE_LENGTH = 120;
const MAX_NOTES_LENGTH = 2000;
const MAX_DURATION_MINUTES = 1440;
const MAX_DISTANCE_KILOMETERS = 1000;

type ManualActivityInput = {
  sport: unknown;
  title: unknown;
  completedOn: unknown;
  durationMinutes: unknown;
  distanceKm: unknown;
  rpe: unknown;
  notes: unknown;
  requestKey: unknown;
  pairingChoice?: unknown;
};

type ManualActivityCorrectionInput = Record<string, unknown>;

type ParsedManualActivityFields = {
  sport: string;
  title: string;
  completedAt: Date;
  durationSec: number;
  distanceMeters: number | null;
  rpe: number | null;
  notes: string | null;
};

type ParsedManualMetrics = Pick<ParsedManualActivityFields, 'durationSec' | 'distanceMeters' | 'rpe' | 'notes'>;

type ParsedManualCorrection =
  | { kind: 'manual-unplanned'; expectedUpdatedAt: Date; fields: ParsedManualActivityFields }
  | { kind: 'manual-paired'; expectedUpdatedAt: Date; fields: ParsedManualMetrics };

type ParsedManualActivity =
  | { ok: false; error: string }
  | { ok: true; value: ParsedManualActivityFields & { requestKey: string; pairingSessionId: number | null } };

type ParsedManualActivityFieldsResult =
  | { ok: false; error: string }
  | { ok: true; value: ParsedManualActivityFields };

type ParsedManualMetricsResult =
  | { ok: false; error: string }
  | { ok: true; value: ParsedManualMetrics };

type ManualActivityDatabase = typeof prisma;

export type ManualActivityResult =
  | { ok: true; sessionId: number; completedAt: Date }
  | { ok: false; status: 400 | 404 | 409; error: string };

export type ManualActivityCorrectionResult =
  | { ok: true; activityId: number; sessionId: number; completedAt: Date; updatedAt: Date }
  | { ok: false; status: 400 | 404 | 409; error: string };

function parseManualMetrics(input: Pick<ManualActivityInput, 'durationMinutes' | 'distanceKm' | 'rpe' | 'notes'>): ParsedManualMetricsResult {
  if (!Number.isInteger(input.durationMinutes) || Number(input.durationMinutes) < 1 || Number(input.durationMinutes) > MAX_DURATION_MINUTES) {
    return { ok: false, error: `Duration must be between 1 and ${MAX_DURATION_MINUTES} minutes.` };
  }
  const hasDistance = input.distanceKm !== null && input.distanceKm !== undefined && input.distanceKm !== '';
  if (hasDistance && (typeof input.distanceKm !== 'number' || !Number.isFinite(input.distanceKm) || input.distanceKm < 0.01 || input.distanceKm > MAX_DISTANCE_KILOMETERS)) {
    return { ok: false, error: `Distance must be between 0.01 and ${MAX_DISTANCE_KILOMETERS} km.` };
  }
  if (input.rpe !== null && input.rpe !== '' && (!Number.isInteger(input.rpe) || Number(input.rpe) < 1 || Number(input.rpe) > 10)) {
    return { ok: false, error: 'RPE must be a whole number from 1 to 10.' };
  }
  if (input.notes !== null && input.notes !== undefined && (typeof input.notes !== 'string' || input.notes.length > MAX_NOTES_LENGTH)) {
    return { ok: false, error: `Notes must be ${MAX_NOTES_LENGTH} characters or fewer.` };
  }

  return {
    ok: true,
    value: {
      durationSec: Number(input.durationMinutes) * 60,
      distanceMeters: hasDistance ? Math.round(Number(input.distanceKm) * 1000) : null,
      rpe: input.rpe === null || input.rpe === '' ? null : Number(input.rpe),
      notes: typeof input.notes === 'string' && input.notes.trim() ? input.notes.trim() : null,
    },
  };
}

function parseManualActivityFields(input: Pick<ManualActivityInput, 'sport' | 'title' | 'completedOn' | 'durationMinutes' | 'distanceKm' | 'rpe' | 'notes'>): ParsedManualActivityFieldsResult {
  if (typeof input.sport !== 'string' || !SPORT_OPTIONS.some((sport) => sport === input.sport) || input.sport === 'REST') {
    return { ok: false, error: 'Choose a valid sport.' };
  }
  if (typeof input.title !== 'string' || input.title.trim().length === 0 || input.title.trim().length > MAX_TITLE_LENGTH) {
    return { ok: false, error: `Title must be between 1 and ${MAX_TITLE_LENGTH} characters.` };
  }
  if (typeof input.completedOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(input.completedOn)) {
    return { ok: false, error: 'Choose a valid date.' };
  }
  const completedAt = parseISO(`${input.completedOn}T12:00:00.000Z`);
  if (!isValid(completedAt) || completedAt.toISOString().slice(0, 10) !== input.completedOn) {
    return { ok: false, error: 'Choose a valid date.' };
  }
  const metrics = parseManualMetrics(input);
  if (!metrics.ok) return metrics;

  return {
    ok: true,
    value: {
      sport: input.sport,
      title: input.title.trim(),
      completedAt,
      ...metrics.value,
    },
  };
}

function parseManualActivity(input: ManualActivityInput): ParsedManualActivity {
  const fields = parseManualActivityFields(input);
  if (!fields.ok) return fields;
  if (typeof input.requestKey !== 'string' || !/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(input.requestKey)) {
    return { ok: false, error: 'Reload the page and try again.' };
  }
  if (input.pairingChoice !== 'separate' && !(typeof input.pairingChoice === 'number' && Number.isSafeInteger(input.pairingChoice) && input.pairingChoice > 0)) return { ok: false, error: 'Choose a planned workout, or save this on its own.' };
  return {
    ok: true,
    value: {
      ...fields.value,
      requestKey: input.requestKey,
      pairingSessionId: input.pairingChoice === 'separate' ? null : Number(input.pairingChoice),
    },
  };
}

function parseExpectedUpdatedAt(value: unknown) {
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return isValid(date) && date.toISOString() === value ? date : null;
}

function parseManualCorrection(input: ManualActivityCorrectionInput, kind: string): { ok: false; error: string } | { ok: true; value: ParsedManualCorrection } {
  const expectedUpdatedAt = parseExpectedUpdatedAt(input.expectedUpdatedAt);
  if (!expectedUpdatedAt) return { ok: false, error: 'Reload the page and try again.' };

  if (kind === 'manual-unplanned') {
    const fields = parseManualActivityFields({
      sport: input.sport,
      title: input.title,
      completedOn: input.completedOn,
      durationMinutes: input.durationMinutes,
      distanceKm: input.distanceKm,
      rpe: input.rpe,
      notes: input.notes,
    });
    return fields.ok
      ? { ok: true, value: { kind, expectedUpdatedAt, fields: fields.value } }
      : fields;
  }

  if (kind !== 'manual-paired') return { ok: false, error: 'This activity can’t be edited here.' };
  if (Object.hasOwn(input, 'sport') || Object.hasOwn(input, 'title') || Object.hasOwn(input, 'completedOn')) {
    return { ok: false, error: 'You can’t change the planned workout from here.' };
  }
  const fields = parseManualMetrics({
    durationMinutes: input.durationMinutes,
    distanceKm: input.distanceKm,
    rpe: input.rpe,
    notes: input.notes,
  });
  return fields.ok
    ? { ok: true, value: { kind, expectedUpdatedAt, fields: fields.value } }
    : fields;
}

class ManualActivityCorrectionConflict extends Error {}

export function createAthleteManualActivityService({ db = prisma }: { db?: ManualActivityDatabase } = {}) {
  return {
    async candidates(athleteId: number, sport: unknown, completedOn: unknown) {
      const athlete = await db.user.findUnique({ where: { id: athleteId }, select: { id: true, role: true } });
      if (!athlete || athlete.role !== 'ATHLETE' || typeof sport !== 'string' || !SPORT_OPTIONS.some((option) => option === sport) || sport === 'REST' || typeof completedOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(completedOn)) return [];
      const day = parseISO(`${completedOn}T12:00:00.000Z`);
      if (!isValid(day) || day.toISOString().slice(0, 10) !== completedOn) return [];
      return listImportPairingCandidates(db, athleteId, { sport, completedOn });
    },
    async correct(athleteId: number, activityId: number, input: ManualActivityCorrectionInput): Promise<ManualActivityCorrectionResult> {
      if (!Number.isSafeInteger(activityId) || activityId <= 0) return { ok: false, status: 404, error: 'Activity not found.' };
      const athlete = await db.user.findUnique({ where: { id: athleteId }, select: { id: true, role: true } });
      if (!athlete || athlete.role !== 'ATHLETE') return { ok: false, status: 404, error: 'Activity not found.' };

      try {
        return await db.$transaction(async (tx) => {
          const activity = await tx.activity.findUnique({
            where: { id: activityId },
            include: { session: { include: { blocks: { select: { id: true } } } } },
          });
          if (!activity || activity.athleteId !== athleteId || activity.session.athleteId !== athleteId) {
            return { ok: false as const, status: 404 as const, error: 'Activity not found.' };
          }
          if (activity.metricsSource !== 'manual-unplanned' && activity.metricsSource !== 'manual-paired') {
            return { ok: false as const, status: 409 as const, error: 'Only activities you logged by hand can be edited here.' };
          }

          const parsed = parseManualCorrection(input, activity.metricsSource);
          if (!parsed.ok) return { ok: false as const, status: 400 as const, error: parsed.error };
          if (activity.updatedAt.getTime() !== parsed.value.expectedUpdatedAt.getTime()) {
            return { ok: false as const, status: 409 as const, error: 'This activity changed after you opened it. Reload the page before you edit it.' };
          }

          const session = activity.session;
          const isSelfOwnedCompletedSession = session.athleteId === athleteId
            && session.status === 'completed'
            && session.coachOwnerId === null
            && session.assignedById === null
            && session.trainingPlanId === null;
          if (!isSelfOwnedCompletedSession || activity.actualSnapshotJson !== null || activity.importFingerprint !== null) {
            return { ok: false as const, status: 409 as const, error: 'This activity can’t be edited here anymore.' };
          }

          if (parsed.value.kind === 'manual-unplanned') {
            if (session.source !== 'athlete-manual' || session.planId !== null || session.coachBaselineJson !== null || session.blocks.length > 0) {
              return { ok: false as const, status: 409 as const, error: 'This activity can’t be edited here anymore.' };
            }

            const updatedSession = await tx.session.updateMany({
              where: {
                id: session.id,
                athleteId,
                source: 'athlete-manual',
                status: 'completed',
                planId: null,
                coachOwnerId: null,
                assignedById: null,
                trainingPlanId: null,
                updatedAt: session.updatedAt,
              },
              data: {
                title: parsed.value.fields.title,
                sport: parsed.value.fields.sport,
                date: parsed.value.fields.completedAt,
                rpe: parsed.value.fields.rpe,
                athleteNotes: parsed.value.fields.notes,
              },
            });
            if (updatedSession.count !== 1) throw new ManualActivityCorrectionConflict();
          } else if (session.source === 'athlete-manual') {
            return { ok: false as const, status: 409 as const, error: 'This activity can’t be edited here anymore.' };
          }

          const updatedActivity = await tx.activity.updateMany({
            where: parsed.value.kind === 'manual-unplanned'
              ? { id: activityId, athleteId, metricsSource: parsed.value.kind, updatedAt: parsed.value.expectedUpdatedAt }
              : {
                  id: activityId,
                  athleteId,
                  metricsSource: parsed.value.kind,
                  updatedAt: parsed.value.expectedUpdatedAt,
                  session: {
                    is: {
                      athleteId,
                      status: 'completed',
                      updatedAt: session.updatedAt,
                      coachOwnerId: null,
                      assignedById: null,
                      trainingPlanId: null,
                    },
                  },
                },
            data: {
              durationSec: parsed.value.fields.durationSec,
              distanceMeters: parsed.value.fields.distanceMeters,
              rpe: parsed.value.fields.rpe,
              notes: parsed.value.fields.notes,
              ...(parsed.value.kind === 'manual-unplanned' ? { completedAt: parsed.value.fields.completedAt } : {}),
            },
          });
          if (updatedActivity.count !== 1) throw new ManualActivityCorrectionConflict();

          const saved = await tx.activity.findUnique({ where: { id: activityId }, select: { id: true, sessionId: true, completedAt: true, updatedAt: true } });
          if (!saved) throw new ManualActivityCorrectionConflict();
          return { ok: true as const, activityId: saved.id, sessionId: saved.sessionId, completedAt: saved.completedAt, updatedAt: saved.updatedAt };
        });
      } catch (error) {
        if (error instanceof ManualActivityCorrectionConflict) {
          return { ok: false, status: 409, error: 'This activity changed while you were editing it. Reload the page and try again.' };
        }
        throw error;
      }
    },
    async create(athleteId: number, input: ManualActivityInput): Promise<ManualActivityResult> {
      const parsed = parseManualActivity(input);
      if (!parsed.ok) return { ok: false, status: 400, error: parsed.error };
      const athlete = await db.user.findUnique({ where: { id: athleteId }, select: { id: true, role: true } });
      if (!athlete || athlete.role !== 'ATHLETE') return { ok: false, status: 404, error: 'Account not found.' };

      const existing = await db.activity.findUnique({ where: { manualEntryKey: parsed.value.requestKey }, select: { sessionId: true, athleteId: true, completedAt: true } });
      if (existing) {
        if (existing.athleteId !== athleteId) return { ok: false, status: 404, error: 'Activity not found.' };
        return { ok: true, sessionId: existing.sessionId, completedAt: existing.completedAt };
      }

      try {
        if (parsed.value.pairingSessionId !== null) {
          const pairingSessionId = parsed.value.pairingSessionId;
          const dayRange = dateRangeForDay(parsed.value.completedAt.toISOString().slice(0, 10));
          return await db.$transaction(async (tx) => {
            const session = await tx.session.findUnique({ where: { id: pairingSessionId }, include: { blocks: { orderBy: { sortOrder: 'asc' } }, activity: true } });
            if (!session || session.athleteId !== athleteId || session.sport !== parsed.value.sport || !session.date || session.date < dayRange.gte || session.date >= dayRange.lt || (session.status !== 'planned' && session.status !== 'adjusted') || session.activity || session.coachOwnerId !== null || session.assignedById !== null || session.trainingPlanId !== null) return { ok: false as const, status: 409 as const, error: 'That planned workout is no longer available. Choose another, or save this on its own.' };
            const baseline = snapshotPlannedSession(session);
            const updated = await tx.session.updateMany({ where: { id: session.id, athleteId, sport: parsed.value.sport, date: dayRange, status: { in: ['planned', 'adjusted'] }, coachOwnerId: null, assignedById: null, trainingPlanId: null, activity: { is: null } }, data: { status: 'completed', ...(session.coachBaselineJson === null ? { coachBaselineJson: baseline } : {}) } });
            if (updated.count !== 1) return { ok: false as const, status: 409 as const, error: 'That planned workout is no longer available. Choose another, or save this on its own.' };
            const saved = await tx.activity.create({ data: { athleteId, sessionId: session.id, completedAt: parsed.value.completedAt, durationSec: parsed.value.durationSec, distanceMeters: parsed.value.distanceMeters, tss: null, compliancePct: null, zoneDistributionJson: '{}', segmentsJson: '[]', metricsSource: 'manual-paired', manualEntryKey: parsed.value.requestKey, notes: parsed.value.notes, rpe: parsed.value.rpe }, select: { completedAt: true } });
            return { ok: true as const, sessionId: session.id, completedAt: saved.completedAt };
          });
        }
        const session = await db.session.create({
          data: {
            athleteId,
            date: parsed.value.completedAt,
            sport: parsed.value.sport,
            title: parsed.value.title,
            status: 'completed',
            source: 'athlete-manual',
            rpe: parsed.value.rpe,
            athleteNotes: parsed.value.notes,
            adjusted: false,
            coachBaselineJson: null,
            activity: {
              create: {
                athleteId,
                completedAt: parsed.value.completedAt,
                durationSec: parsed.value.durationSec,
                distanceMeters: parsed.value.distanceMeters,
                tss: null,
                compliancePct: null,
                zoneDistributionJson: '{}',
                segmentsJson: '[]',
                metricsSource: 'manual-unplanned',
                manualEntryKey: parsed.value.requestKey,
                notes: parsed.value.notes,
                rpe: parsed.value.rpe,
              },
            },
          },
          select: { id: true, activity: { select: { completedAt: true } } },
        });
        if (!session.activity) return { ok: false, status: 400, error: 'Activity could not be saved.' };
        return { ok: true, sessionId: session.id, completedAt: session.activity.completedAt };
      } catch {
        const retry = await db.activity.findUnique({ where: { manualEntryKey: parsed.value.requestKey }, select: { sessionId: true, athleteId: true, completedAt: true } });
        if (retry?.athleteId === athleteId) return { ok: true, sessionId: retry.sessionId, completedAt: retry.completedAt };
        throw new Error('Could not save this activity. Try again.');
      }
    },
  };
}

export const athleteManualActivityService = createAthleteManualActivityService();
