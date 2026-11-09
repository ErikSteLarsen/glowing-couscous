import { createHash } from 'node:crypto';

import { Prisma } from '@prisma/client';
import { getTemplateCadence, isAssignmentDate, validateTemplateDateRange } from './template-cadence.ts';
import { addDays, differenceInCalendarDays, endOfMonth, endOfWeek, format, formatISO, isValid, parseISO, startOfMonth, startOfWeek } from 'date-fns';

import { prisma } from './prisma.ts';
import { parseCalendarDay } from './calendar-navigation.ts';
import { deriveSessionMetrics } from './session-math.ts';
import {
  normalizeSessionEditorDraft,
  serializeSessionEditorDraft,
  validateSessionEditorDraft,
} from './session-editor.ts';

type AthletePlannerDeps = {
  db?: typeof prisma;
};

export function createAthletePlannerService({ db = prisma }: AthletePlannerDeps = {}) {
  return {
    async loadWorkspace(athleteId: number, referenceDateInput?: string) {
      const referenceDate = parseReferenceDate(referenceDateInput);
      const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(referenceDate, { weekStartsOn: 1 });
      const calendarStart = startOfWeek(startOfMonth(referenceDate), { weekStartsOn: 1 });
      const calendarEnd = endOfWeek(endOfMonth(referenceDate), { weekStartsOn: 1 });
      const [sessions, templates, calendarSessions] = await Promise.all([
        db.session.findMany({
          where: { athleteId, date: { gte: weekStart, lte: weekEnd } },
          include: { blocks: { orderBy: { sortOrder: 'asc' } } },
          orderBy: [{ date: 'asc' }, { title: 'asc' }],
        }),
        db.template.findMany({
          where: { ownerId: athleteId },
          include: { blocks: { orderBy: { sortOrder: 'asc' } } },
          orderBy: [{ sport: 'asc' }, { name: 'asc' }],
        }),
        db.session.findMany({
          where: { athleteId, date: { gte: calendarStart, lte: calendarEnd } },
          include: { blocks: { orderBy: { sortOrder: 'asc' } } },
          orderBy: [{ date: 'asc' }, { title: 'asc' }],
        }),
      ]);

      const shapeSession = (session: typeof sessions[number]) => {
        const metrics = deriveSessionMetrics(
          session.blocks.map((block) => ({
            kind: toTempoKind(block.kind),
            zone: toTempoZone(block.zone),
            durationSec: block.durationSec,
            reps: block.reps,
            target:
              block.targetType && block.targetLow !== null && block.targetHigh !== null
                 ? { metric: toTargetType(block.targetType), mode: block.targetMode === 'relative' ? 'relative' : 'absolute', reference: block.targetReference as 'ftp' | 'threshold-pace' | 'css' | 'threshold-hr' | null, low: Number(block.targetLowDecimal ?? block.targetLow), high: Number(block.targetHighDecimal ?? block.targetHigh) }
               : null,
          })),
        );

        return {
          id: session.id,
          athleteId: session.athleteId,
          templateId: session.templateId,
          scheduledDate: session.date ? formatISO(session.date, { representation: 'date' }) : '',
          timeLabel: session.timeLabel,
          sport: session.sport,
          title: session.title,
          summary: session.summary,
          status: session.status,
          source: session.source,
          adjusted: session.adjusted,
          sportMetricsJson: session.sportMetricsJson,
          durationSec: metrics.durationSec,
          tss: metrics.tss,
          segments: metrics.segments,
          blocks: session.blocks,
        };
      };

      const days = Array.from({ length: 7 }, (_, index) => {
        const date = addDays(weekStart, index);
        const isoDate = formatISO(date, { representation: 'date' });

        return {
          isoDate,
          label: format(date, 'EEE'),
          dateLabel: format(date, 'd MMM'),
          sessions: sessions
            .filter((session): session is typeof session & { date: Date } => session.date !== null)
            .filter((session) => formatISO(session.date, { representation: 'date' }) === isoDate)
            .map(shapeSession),
        };
      });

      const calendarDays = Array.from({ length: differenceInCalendarDays(calendarEnd, calendarStart) + 1 }, (_, index) => {
        const date = addDays(calendarStart, index);
        const isoDate = formatISO(date, { representation: 'date' });
        return {
          isoDate,
          label: format(date, 'EEE'),
          dateLabel: format(date, 'd MMM'),
          inMonth: date.getMonth() === referenceDate.getMonth() && date.getFullYear() === referenceDate.getFullYear(),
          sessions: calendarSessions
            .filter((session): session is typeof session & { date: Date } => session.date !== null)
            .filter((session) => formatISO(session.date, { representation: 'date' }) === isoDate)
            .map(shapeSession),
        };
      });

      return {
        period: {
          start: weekStart,
          end: weekEnd,
          label: `${format(weekStart, 'd MMM')} - ${format(weekEnd, 'd MMM yyyy')}`,
        },
        calendar: {
          start: calendarStart,
          end: calendarEnd,
          label: format(referenceDate, 'MMMM yyyy'),
        },
        days,
        calendarDays,
        templates,
      };
    },

    async assignSource(athleteId: number, input: unknown) {
      const record = asRecord(input);
      const sourceKind = record.sourceKind === 'workout' || record.sourceKind === 'template'
        ? record.sourceKind
        : null;
      const sourceId = typeof record.sourceId === 'number' && Number.isInteger(record.sourceId) && record.sourceId > 0
        ? record.sourceId
        : null;
      const requestKey = typeof record.requestKey === 'string' && record.requestKey.trim().length > 0 && record.requestKey.length <= 128
        ? record.requestKey.trim()
        : null;
      if (!Array.isArray(record.dates) || record.dates.some((date) => !isAssignmentDate(date))) {
        return { ok: false as const, error: 'Choose valid calendar dates.', status: 400 };
      }
      const requestedDates = uniqueDates(record.dates);

      if (!sourceKind || sourceId === null) {
        return { ok: false as const, error: 'Choose a defined workout or template.', status: 400 };
      }
      if (!requestKey) {
        return { ok: false as const, error: 'Placement request key is required.', status: 400 };
      }
      if (requestedDates.length === 0) {
        return { ok: false as const, error: 'Choose at least one target day.', status: 400 };
      }

      const payloadHash = createHash('sha256')
        .update(JSON.stringify({ sourceKind, sourceId, dates: requestedDates }))
        .digest('hex');
      const replay = await db.placementRequest.findUnique({
        where: { userId_requestKey: { userId: athleteId, requestKey } },
      });
      if (replay) return placementReplayResult(replay, payloadHash);

      try {
        const sessionIds = await db.$transaction(async (transaction) => {
          const tx = transaction as typeof prisma;
          const existing = await tx.placementRequest.findUnique({
            where: { userId_requestKey: { userId: athleteId, requestKey } },
          });
          if (existing) {
            const result = placementReplayResult(existing, payloadHash);
            if (!result.ok) throw new PlacementError(result.error, result.status);
            return result.sessionIds;
          }

          let source:
            | {
                kind: 'template' | 'workout';
                id: number;
                sport: string;
                title: string;
                summary: string | null;
                sportMetricsJson: string | null;
                timeLabel: string | null;
                blocks: Parameters<typeof createSourceCopyData>[0]['blocks'];
              };

          if (sourceKind === 'template') {
            const template = await tx.template.findFirst({
              where: { id: sourceId, ownerId: athleteId },
              include: { blocks: { orderBy: { sortOrder: 'asc' } } },
            });
            if (!template) throw new PlacementError('Template not found.', 404);
            const rangeError = validateTemplateDateRange(requestedDates, getTemplateCadence(template.cadence));
            if (rangeError) throw new PlacementError(rangeError, 400);
            source = {
              kind: 'template',
              id: template.id,
              sport: template.sport,
              title: template.name,
              summary: template.summary,
              sportMetricsJson: null,
              timeLabel: null,
              blocks: template.blocks,
            };
          } else {
            const workout = await tx.session.findFirst({
              where: {
                id: sourceId,
                athleteId,
                coachOwnerId: null,
                trainingPlanId: null,
                planId: null,
                date: null,
              },
              include: { blocks: { orderBy: { sortOrder: 'asc' } } },
            });
            if (!workout) throw new PlacementError('Workout not found in your library.', 404);
            source = {
              kind: 'workout',
              id: workout.id,
              sport: workout.sport,
              title: workout.title,
              summary: workout.summary,
              sportMetricsJson: workout.sportMetricsJson,
              timeLabel: workout.timeLabel,
              blocks: workout.blocks,
            };
          }

          await tx.placementRequest.create({
            data: { userId: athleteId, requestKey, payloadHash, sessionIdsJson: '[]' },
          });

          const createdSessionIds: number[] = [];
          for (const date of requestedDates) {
            const plan = await findOrCreatePlan(tx, athleteId, date);
            const created = await tx.session.create({
              data: createSourceCopyData({
                athleteId,
                planId: plan.id,
                date,
                templateId: source.kind === 'template' ? source.id : null,
                source: source.kind === 'template' ? 'athlete-template' : 'athlete-library-copy',
                sport: source.sport,
                title: source.title,
                summary: source.summary,
                sportMetricsJson: source.sportMetricsJson,
                timeLabel: source.timeLabel,
                blocks: source.blocks,
              }),
            });
            createdSessionIds.push(created.id);
          }

          await tx.placementRequest.update({
            where: { userId_requestKey: { userId: athleteId, requestKey } },
            data: { sessionIdsJson: JSON.stringify(createdSessionIds) },
          });
          return createdSessionIds;
        });

        return { ok: true as const, sessionIds };
      } catch (error) {
        if (error instanceof PlacementError) {
          return { ok: false as const, error: error.message, status: error.status };
        }
        if (isPlacementRaceError(error)) {
          const winner = await db.placementRequest.findUnique({
            where: { userId_requestKey: { userId: athleteId, requestKey } },
          });
          if (winner) return placementReplayResult(winner, payloadHash);
        }
        throw error;
      }
    },
    async saveSession(athleteId: number, input: unknown, sessionId?: number) {
      const inputRecord = asRecord(input);
      const rawDates = Array.isArray(inputRecord.dates) ? inputRecord.dates : [];
      const dates = uniqueDates(
        rawDates.length > 0
          ? rawDates
          : typeof inputRecord.scheduledDate === 'string'
            ? [inputRecord.scheduledDate]
            : [],
      );

      if (dates.length === 0) {
        return { ok: false as const, error: 'Choose at least one day.', status: 400 };
      }
      if (sessionId !== undefined && dates.length !== 1) {
        return { ok: false as const, error: 'Edit one scheduled day at a time.', status: 400 };
      }

      const draft = normalizeSessionEditorDraft({
        ...inputRecord,
        scheduledDate: dates[0],
        athleteId,
        mode: sessionId ? 'planned' : 'create',
      });
      const validationError = validateSessionEditorDraft(draft);
      if (validationError) {
        return { ok: false as const, error: validationError, status: 400 };
      }

      if (draft.templateId !== null) {
        const template = await db.template.findFirst({
          where: { id: draft.templateId, ownerId: athleteId },
          select: { id: true },
        });
        if (!template) {
          return { ok: false as const, error: 'Template not found.', status: 404 };
        }
      }

      const serialized = serializeSessionEditorDraft(draft);
      const blocks = serialized.blocks.map((block) => ({
        kind: block.kind,
        zone: block.zone,
        durationSec: block.durationSec,
        reps: block.reps,
        targetType: block.targetType,
        targetMode: block.targetMode,
        targetReference: block.targetReference,
        targetLow: block.targetLow,
        targetHigh: block.targetHigh,
        targetLowDecimal: block.targetLowDecimal,
        targetHighDecimal: block.targetHighDecimal,
        note: block.note,
        skipped: block.skipped,
        sortOrder: block.sortOrder,
      }));

      if (sessionId !== undefined) {
        const existing = await db.session.findFirst({
          where: { id: sessionId, athleteId },
          select: { id: true, activity: { select: { id: true } } },
        });
        if (!existing) return { ok: false as const, error: 'Session not found.', status: 404 };
        if (existing.activity) {
          return { ok: false as const, error: 'Completed sessions are immutable.', status: 409 };
        }

        const plan = await findOrCreatePlan(db, athleteId, dates[0]);
        await db.$transaction([
          db.block.deleteMany({ where: { sessionId } }),
          db.session.update({
            where: { id: sessionId },
            data: createSessionData(athleteId, plan.id, serialized, blocks, dates[0]),
          }),
        ]);

        return { ok: true as const, sessionIds: [sessionId] };
      }

      const sessionIds: number[] = [];
      for (const date of dates) {
        const plan = await findOrCreatePlan(db, athleteId, date);
        const created = await db.session.create({
          data: createSessionData(athleteId, plan.id, serialized, blocks, date),
        });
        sessionIds.push(created.id);
      }

      return { ok: true as const, sessionIds };
    },

    /**
     * Moves one of the athlete's own open sessions to another day without
     * touching its content. Completed and coach-owned sessions stay put.
     */
    async rescheduleSession(athleteId: number, sessionId: number, input: unknown) {
      const date = parseCalendarDay(asRecord(input).date);
      if (!date) return { ok: false as const, error: 'Choose a valid day.', status: 400 };

      try {
        return await db.$transaction(async (tx) => {
          const existing = await tx.session.findFirst({
            where: { id: sessionId, athleteId },
            select: {
              date: true,
              status: true,
              coachOwnerId: true,
              assignedById: true,
              trainingPlanId: true,
              activity: { select: { id: true } },
            },
          });
          if (!existing?.date) throw new PlacementError('Session not found.', 404);
          if (existing.activity || existing.status === 'completed') {
            throw new PlacementError('Completed sessions are immutable.', 409);
          }
          if (existing.coachOwnerId || existing.assignedById || existing.trainingPlanId) {
            throw new PlacementError("Coach-assigned sessions keep the day your coach chose.", 409);
          }

          const plan = await findOrCreatePlan(tx, athleteId, date);
          const nextDate = parseISO(date);
          nextDate.setHours(existing.date.getHours(), existing.date.getMinutes(), existing.date.getSeconds(), existing.date.getMilliseconds());
          const moved = await tx.session.updateMany({
            where: {
              id: sessionId,
              athleteId,
              date: existing.date,
              status: existing.status,
              coachOwnerId: null,
              assignedById: null,
              trainingPlanId: null,
              activity: { is: null },
            },
            data: {
              date: nextDate,
              planId: plan.id,
              ...(existing.status === 'missed' ? { status: 'planned' } : {}),
            },
          });
          if (moved.count !== 1) throw new PlacementError('The session changed. Refresh the calendar and try again.', 409);
          return { ok: true as const, sessionId, date };
        });
      } catch (error) {
        if (error instanceof PlacementError) return { ok: false as const, error: error.message, status: error.status };
        throw error;
      }
    },

    async deleteSession(athleteId: number, sessionId: number) {
      const existing = await db.session.findFirst({
        where: { id: sessionId, athleteId },
        select: { id: true, activity: { select: { id: true } } },
      });
      if (!existing) return { ok: false as const, error: 'Session not found.', status: 404 };
      if (existing.activity) {
        return { ok: false as const, error: 'Completed sessions are immutable.', status: 409 };
      }

      await db.session.delete({ where: { id: sessionId } });
      return { ok: true as const, sessionId };
    },
  };
}

class PlacementError extends Error {
  readonly status: 400 | 404 | 409;

  constructor(message: string, status: 400 | 404 | 409) {
    super(message);
    this.status = status;
  }
}

function placementReplayResult(
  request: { payloadHash: string; sessionIdsJson: string },
  payloadHash: string,
) {
  if (request.payloadHash !== payloadHash) {
    return { ok: false as const, error: 'This placement key was already used for different dates or source content.', status: 409 as const };
  }
  try {
    const sessionIds = JSON.parse(request.sessionIdsJson);
    if (Array.isArray(sessionIds) && sessionIds.every((id) => Number.isInteger(id) && id > 0)) {
      return { ok: true as const, sessionIds: sessionIds as number[] };
    }
  } catch {
    // A malformed row cannot safely be replayed.
  }
  return { ok: false as const, error: 'Could not confirm the earlier placement.', status: 409 as const };
}

function isPlacementRaceError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError
    && (error.code === 'P2002' || error.code === 'P1008' || error.code === 'P2028');
}

async function findOrCreatePlan(db: Pick<Prisma.TransactionClient, 'plan'>, athleteId: number, dateInput: string) {
  const date = parseISO(dateInput);
  const startDate = startOfWeek(date, { weekStartsOn: 1 });
  const endDate = endOfWeek(date, { weekStartsOn: 1 });
  return (
    (await db.plan.findFirst({
      where: { athleteId, startDate, endDate },
      orderBy: { id: 'desc' },
    })) ??
    (await db.plan.create({
      data: {
        athleteId,
        name: `Week of ${format(startDate, 'd MMM yyyy')}`,
        startDate,
        endDate,
      },
    }))
  );
}

function createSessionData(
  athleteId: number,
  planId: number,
  serialized: ReturnType<typeof serializeSessionEditorDraft>,
  blocks: Array<{
    kind: string;
    zone: number;
    durationSec: number;
    reps: number | null;
    targetType: string | null;
    targetMode: string;
    targetReference: string | null;
    targetLow: number | null;
    targetHigh: number | null;
    targetLowDecimal: string | null;
    targetHighDecimal: string | null;
    note: string | null;
    skipped: boolean;
    sortOrder: number;
  }>,
  date: string,
) {
  return {
    athleteId,
    coachOwnerId: null,
    trainingPlanId: null,
    planId,
    templateId: serialized.templateId,
    assignedById: null,
    date: parseISO(`${date}T00:00:00.000Z`),
    planWeekday: null,
    timeLabel: serialized.timeLabel,
    sport: serialized.sport,
    title: serialized.title,
    summary: serialized.summary,
    coachNotes: null,
    athleteNotes: serialized.athleteNotes,
    rpe: serialized.rpe,
    sportMetricsJson: JSON.stringify(serialized.sportMetrics),
    status: 'planned',
    source: serialized.templateId ? 'athlete-template' : 'athlete',
    adjusted: false,
    blocks: { create: blocks },
  };
}

function createSourceCopyData(input: {
  athleteId: number;
  planId: number;
  date: string;
  templateId: number | null;
  source: string;
  sport: string;
  title: string;
  summary: string | null;
  sportMetricsJson: string | null;
  timeLabel: string | null;
  blocks: Array<{
    kind: string;
    zone: number;
    durationSec: number;
    reps: number | null;
    targetType: string | null;
    targetMode?: string | null;
    targetReference?: string | null;
    targetLow: number | null;
    targetHigh: number | null;
    targetLowDecimal?: string | null;
    targetHighDecimal?: string | null;
    note: string | null;
    skipped?: boolean;
    sortOrder: number;
  }>,
}) {
  return {
    athleteId: input.athleteId,
    coachOwnerId: null,
    trainingPlanId: null,
    planId: input.planId,
    templateId: input.templateId,
    assignedById: null,
    date: parseISO(`${input.date}T00:00:00.000Z`),
    planWeekday: null,
    timeLabel: input.timeLabel,
    sport: input.sport,
    title: input.title,
    summary: input.summary,
    coachNotes: null,
    athleteNotes: null,
    rpe: null,
    sportMetricsJson: input.sportMetricsJson,
    status: 'planned',
    source: input.source,
    adjusted: false,
    blocks: {
      create: input.blocks.map((block) => ({
        kind: block.kind,
        zone: block.zone,
        durationSec: block.durationSec,
        reps: block.reps,
        targetType: block.targetType,
        targetMode: block.targetMode ?? 'absolute',
        targetReference: block.targetReference ?? null,
        targetLow: block.targetLow,
        targetHigh: block.targetHigh,
        targetLowDecimal: block.targetLowDecimal ?? (block.targetLow === null ? null : String(block.targetLow)),
        targetHighDecimal: block.targetHighDecimal ?? (block.targetHigh === null ? null : String(block.targetHigh)),
        note: block.note,
        skipped: block.skipped ?? false,
        sortOrder: block.sortOrder,
      })),
    },
  };
}

function uniqueDates(values: unknown[]) {
  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.trim())
        .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
        .filter((value) => isValid(parseISO(`${value}T00:00:00.000Z`))),
    ),
  ).sort();
}

function asRecord(input: unknown): Record<string, unknown> {
  return typeof input === 'object' && input !== null && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
}

function parseReferenceDate(input?: string) {
  const parsed = input ? parseISO(input) : new Date();
  return isValid(parsed) ? parsed : new Date();
}

function toTempoKind(input: string) {
  return input === 'warmup' || input === 'work' || input === 'recovery' || input === 'cooldown' ? input : 'work';
}

function toTempoZone(input: number) {
  return input >= 1 && input <= 5 ? (Math.round(input) as 1 | 2 | 3 | 4 | 5) : 2;
}

function toTargetType(input: string) {
  return input === 'power' || input === 'pace' || input === 'hr' || input === 'rpe' ? input : 'power';
}

export const athletePlannerService = createAthletePlannerService();
