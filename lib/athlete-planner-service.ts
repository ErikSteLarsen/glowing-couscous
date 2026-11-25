import { parseTemplateRoutine, expandTemplateRoutine, validateRoutineDates } from './template-routine.ts';
import { createHash } from 'node:crypto';

import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { catalogLineageOf, type CatalogLineage } from './catalog-lineage.ts';
import { catalogWorkoutToSourceEntry } from './workout-catalog/session.ts';
import { getBuiltInPlan } from './plan-catalog/index.ts';
import { selectPlanWorkouts } from './plan-catalog/selection.ts';
import { isAssignmentDate, validateTemplateDateRange } from './template-period.ts';
import { addDays, differenceInCalendarDays, endOfMonth, endOfWeek, format, formatISO, isValid, parseISO, startOfMonth, startOfWeek } from 'date-fns';

import { prisma } from './prisma.ts';
import { parsePerformanceProfileJson } from './performance-profile.ts';
import { derivePlannerSessionMetrics } from './planner-source-metrics.ts';
import { parseActivitySegments } from './activity-metrics.ts';
import { parseCalendarDay } from './calendar-navigation.ts';
import { parsePlannedTime } from './planned-time.ts';
import {
  normalizeSessionEditorDraft,
  createSessionEditorBlockData,
  serializeSessionEditorDraft,
  validateSessionEditorDraft,
} from './session-editor.ts';

// Planner cards only need activity summaries; telemetry and measurement series stay unloaded.
const plannerSessionInclude = {
  blocks: { orderBy: { sortOrder: 'asc' } },
  activity: { select: { durationSec: true, distanceMeters: true, tss: true, segmentsJson: true } },
  athlete: { select: { performanceProfileJson: true } },
} satisfies Prisma.SessionInclude;

const planSelectionSchema = z.object({
  sourceId: z.string().min(1).max(80),
  version: z.number().int().positive(),
  choices: z.record(z.string(), z.string()),
});

const BUILT_IN_PLAN_SOURCE = 'athlete-plan-catalog';

type AthletePlannerDeps = {
  db?: typeof prisma;
};

export function createAthletePlannerService({ db = prisma }: AthletePlannerDeps = {}) {
  return {
    async loadWorkspace(athleteId: number, referenceDateInput?: string, { includeWeek = true }: { includeWeek?: boolean } = {}) {
      const referenceDate = parseReferenceDate(referenceDateInput);
      const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(referenceDate, { weekStartsOn: 1 });
      const calendarStart = startOfWeek(startOfMonth(referenceDate), { weekStartsOn: 1 });
      const calendarEnd = endOfWeek(endOfMonth(referenceDate), { weekStartsOn: 1 });
      const loadSessions = (start: Date, end: Date) => db.session.findMany({
        where: { athleteId, date: { gte: start, lte: end } },
        include: plannerSessionInclude,
        orderBy: [{ date: 'asc' }, { title: 'asc' }],
      });
      const [sessions, templates, calendarSessions] = await Promise.all([
        includeWeek ? loadSessions(weekStart, weekEnd) : Promise.resolve([] as Awaited<ReturnType<typeof loadSessions>>),
        db.template.findMany({
          where: { ownerId: athleteId },
          orderBy: [{ name: 'asc' }, { id: 'asc' }],
        }),
        loadSessions(calendarStart, calendarEnd),
      ]);

      const shapeSession = (session: typeof calendarSessions[number]) => {
        const ftpWatts = parsePerformanceProfileJson(session.athlete?.performanceProfileJson).cycling.ftpWatts;
        const metrics = derivePlannerSessionMetrics(session.blocks, session.sport, { ftpWatts });

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
          durationSec: session.activity?.durationSec ?? metrics.durationSec,
          distanceMeters: session.activity?.distanceMeters ?? null,
          tss: session.activity ? session.activity.tss : metrics.tss,
          segments: session.activity?.segmentsJson ? parseActivitySegments(session.activity.segmentsJson) : metrics.segments,
          blocks: session.blocks,
        };
      };

      const days = !includeWeek ? [] : Array.from({ length: 7 }, (_, index) => {
        const date = addDays(weekStart, index);
        const isoDate = formatISO(date, { representation: 'date' });

        return {
          isoDate,
          label: format(date, 'EEE'),
          dateLabel: format(date, 'd\u00A0MMM'),
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
          dateLabel: format(date, 'd\u00A0MMM'),
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
          label: `${format(weekStart, 'd\u00A0MMM')} - ${format(weekEnd, 'd\u00A0MMM\u00A0yyyy')}`,
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
      const sourceKind = record.sourceKind;
      const builtIn = sourceKind === 'built-in-plan';
      if (!builtIn && sourceKind !== 'workout' && sourceKind !== 'template') {
        return { ok: false as const, error: 'Choose a workout or training plan.', status: 400 };
      }
      const sourceId = record.sourceId;
      const planSelection = builtIn ? planSelectionSchema.safeParse(record) : null;
      if (planSelection && !planSelection.success) {
        return { ok: false as const, error: 'Choose a valid training plan and its workout options.', status: 400 };
      }
      if (!builtIn && (typeof sourceId !== 'number' || !Number.isSafeInteger(sourceId) || sourceId <= 0)) {
        return { ok: false as const, error: 'Choose a workout or training plan.', status: 400 };
      }
      const selection = planSelection?.data;
      const requestKey = typeof record.requestKey === 'string' && record.requestKey.trim().length > 0 && record.requestKey.length <= 128
        ? record.requestKey.trim()
        : null;
      if (!Array.isArray(record.dates) || record.dates.some((date) => !isAssignmentDate(date))) {
        return { ok: false as const, error: 'Choose valid calendar dates.', status: 400 };
      }
      const requestedDates = uniqueDates(record.dates);

      if (!requestKey) {
        return { ok: false as const, error: 'Something went wrong. Reload the page and try again.', status: 400 };
      }
      if (requestedDates.length === 0) {
        return { ok: false as const, error: 'Choose at least one day.', status: 400 };
      }
      const plannedTime = parsePlannedTime(record.timeLabel);
      if (!plannedTime.ok) {
        return { ok: false as const, error: plannedTime.error, status: 400 };
      }
      const timeLabel = plannedTime.timeLabel;
      if (selection && timeLabel !== null) {
        return { ok: false as const, error: 'Set a start time on each workout after adding the plan.', status: 400 };
      }
      const planIdentity = selection ? {
        version: selection.version,
        choices: Object.entries(selection.choices).sort(([a], [b]) => a.localeCompare(b)),
      } : null;

      const payloadHash = createHash('sha256')
        .update(JSON.stringify({ sourceKind, sourceId, dates: requestedDates, timeLabel, ...planIdentity }))
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

          let placements: Array<{
            date: string;
            entry: Pick<Parameters<typeof createSourceCopyData>[0], 'sport' | 'title' | 'summary' | 'sportMetricsJson' | 'blocks'>;
            source: string;
            lineage: CatalogLineage;
          }>;
          let templateId: number | null = null;

          if (selection) {
            const plan = getBuiltInPlan(selection.sourceId);
            if (!plan) throw new PlacementError('Training plan not found.', 404);
            if (plan.version !== selection.version) {
              throw new PlacementError('This training plan has changed. Reload the page to see the latest version.', 409);
            }
            const rangeError = validateTemplateDateRange(requestedDates, 'week');
            if (rangeError) throw new PlacementError(rangeError, 400);
            for (const [slotId, optionId] of Object.entries(selection.choices)) {
              const slot = plan.slots.find((item) => item.id === slotId);
              if (!slot?.options.some((option) => option.id === optionId)) {
                throw new PlacementError('One of those workout options is unavailable. Choose another option.', 400);
              }
            }
            placements = selectPlanWorkouts(plan.slots, selection.choices).flatMap(({ weekday, option }) => option.workout
              ? [{
                  date: requestedDates[weekday],
                  entry: catalogWorkoutToSourceEntry(option.workout),
                  source: BUILT_IN_PLAN_SOURCE,
                  lineage: { catalogWorkoutSlug: option.id, catalogPlanSlug: plan.slug, catalogPlanVersion: plan.version },
                }]
              : []);
          } else if (sourceKind === 'template' && typeof sourceId === 'number') {
            const template = await tx.template.findFirst({ where: { id: sourceId, ownerId: athleteId } });
            if (!template) throw new PlacementError('Training plan not found.', 404);
            const routine = parseTemplateRoutine(template.routineJson);
            if (!routine) throw new PlacementError('This training plan can’t be read. Edit it and save it again.', 400);
            const rangeError = validateRoutineDates(requestedDates);
            if (rangeError) throw new PlacementError(rangeError, 400);
            templateId = template.id;
            placements = expandTemplateRoutine(routine, requestedDates).map((placement) => ({
              ...placement,
              source: 'athlete-template',
              lineage: {
                catalogWorkoutSlug: placement.entry.catalogWorkoutSlug ?? placement.entry.sourceCatalogWorkoutSlug ?? null,
                catalogPlanSlug: template.catalogPlanSlug,
                catalogPlanVersion: template.catalogPlanVersion,
              },
            }));
          } else if (sourceKind === 'workout' && typeof sourceId === 'number') {
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
            placements = requestedDates.map(date => ({ date, entry: workout, source: 'athlete-library-copy', lineage: catalogLineageOf(workout) }));
          } else {
            throw new PlacementError('Choose a workout or training plan.', 400);
          }

          await tx.placementRequest.create({
            data: { userId: athleteId, requestKey, payloadHash, sessionIdsJson: '[]' },
          });

          const createdSessionIds: number[] = [];
          for (const { date, entry, source, lineage } of placements) {
            const plan = await findOrCreatePlan(tx, athleteId, date);
            const created = await tx.session.create({
              data: createSourceCopyData({
                athleteId,
                planId: plan.id,
                date,
                templateId,
                source,
                lineage,
                sport: entry.sport,
                title: entry.title,
                summary: entry.summary,
                sportMetricsJson: entry.sportMetricsJson,
                timeLabel,
                blocks: entry.blocks,
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
    async saveSession(athleteId: number, input: unknown, sessionId?: number, lineage?: Partial<CatalogLineage>) {
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
          return { ok: false as const, error: 'Training plan not found.', status: 404 };
        }
      }

      const serialized = serializeSessionEditorDraft(draft);
      const blocks = createSessionEditorBlockData(serialized.blocks);

      if (sessionId !== undefined) {
        const existing = await db.session.findFirst({
          where: { id: sessionId, athleteId },
          select: { id: true, status: true, updatedAt: true, activity: { select: { id: true } } },
        });
        if (!existing) return { ok: false as const, error: 'Workout not found.', status: 404 };
        if (existing.activity || existing.status === 'completed') {
          return { ok: false as const, error: 'Workouts marked as done can’t be changed.', status: 409 };
        }

        const plan = await findOrCreatePlan(db, athleteId, dates[0]);
        const { blocks: blockWrite, ...sessionData } = createSessionData(athleteId, plan.id, serialized, blocks, dates[0]);
        // Claim the revision read above so a ride or completion that commits in between wins.
        const claimed = await db.$transaction(async (tx) => {
          const claim = await tx.session.updateMany({
            where: { id: sessionId, athleteId, status: existing.status, updatedAt: existing.updatedAt, activity: { is: null } },
            data: sessionData,
          });
          if (claim.count !== 1) return false;
          await tx.block.deleteMany({ where: { sessionId } });
          await tx.session.update({ where: { id: sessionId }, data: { blocks: blockWrite } });
          return true;
        });
        if (!claimed) {
          return { ok: false as const, error: 'This workout changed while you were editing it. Reload the page and try again.', status: 409 };
        }

        return { ok: true as const, sessionIds: [sessionId] };
      }

      const sessionIds: number[] = [];
      for (const date of dates) {
        const plan = await findOrCreatePlan(db, athleteId, date);
        const created = await db.session.create({
          data: {
            ...createSessionData(athleteId, plan.id, serialized, blocks, date),
            source: serialized.templateId ? 'athlete-template' : 'athlete',
            ...lineage,
          },
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
          if (!existing?.date) throw new PlacementError('Workout not found.', 404);
          if (existing.activity || existing.status === 'completed') {
            throw new PlacementError('Workouts marked as done can’t be changed.', 409);
          }
          if (existing.coachOwnerId || existing.assignedById || existing.trainingPlanId) {
            throw new PlacementError('Workouts from your coach stay on the day your coach chose.', 409);
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
          if (moved.count !== 1) throw new PlacementError('This workout has changed. Reload your Calendar and try again.', 409);
          return { ok: true as const, sessionId, date };
        });
      } catch (error) {
        if (error instanceof PlacementError) return { ok: false as const, error: error.message, status: error.status };
        throw error;
      }
    },

    async deleteSession(athleteId: number, sessionId: number) {
      return db.$transaction(async (tx) => {
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
        if (!existing) return { ok: false as const, error: 'Workout not found.', status: 404 };
        if (!existing.date) {
          return { ok: false as const, error: 'Only planned workouts can be removed.', status: 409 };
        }
        if (existing.activity || existing.status === 'completed') {
          return { ok: false as const, error: 'Workouts marked as done can’t be changed.', status: 409 };
        }
        if (existing.coachOwnerId || existing.assignedById || existing.trainingPlanId) {
          return { ok: false as const, error: 'Workouts from your coach can’t be removed.', status: 409 };
        }

        const deleted = await tx.session.deleteMany({
          where: {
            id: sessionId,
            athleteId,
            date: { not: null },
            status: existing.status,
            coachOwnerId: null,
            assignedById: null,
            trainingPlanId: null,
            activity: { is: null },
          },
        });
        if (deleted.count !== 1) {
          return { ok: false as const, error: 'This workout has changed. Reload the page and try again.', status: 409 };
        }
        return { ok: true as const, sessionId };
      });
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
    return { ok: false as const, error: 'Something went wrong. Reload the page and try again.', status: 409 as const };
  }
  try {
    const sessionIds = JSON.parse(request.sessionIdsJson);
    if (Array.isArray(sessionIds) && sessionIds.every((id) => Number.isInteger(id) && id > 0)) {
      return { ok: true as const, sessionIds: sessionIds as number[] };
    }
  } catch {
    // A malformed row cannot safely be replayed.
  }
  return { ok: false as const, error: 'Could not confirm that this was added. Check your Calendar before you try again.', status: 409 as const };
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
  lineage: CatalogLineage;
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
    ...input.lineage,
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

export const athletePlannerService = createAthletePlannerService();
