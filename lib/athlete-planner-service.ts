import { addDays, endOfWeek, format, formatISO, isValid, parseISO, startOfWeek } from 'date-fns';

import { prisma } from './prisma.ts';
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
      const [sessions, templates] = await Promise.all([
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
      ]);

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
            .map((session) => {
              const metrics = deriveSessionMetrics(
                session.blocks.map((block) => ({
                  kind: toTempoKind(block.kind),
                  zone: toTempoZone(block.zone),
                  durationSec: block.durationSec,
                  reps: block.reps,
                  target:
                    block.targetType && block.targetLow !== null && block.targetHigh !== null
                      ? { type: toTargetType(block.targetType), low: block.targetLow, high: block.targetHigh }
                      : null,
                })),
              );

              return {
                id: session.id,
                athleteId: session.athleteId,
                templateId: session.templateId,
                scheduledDate: isoDate,
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
            }),
        };
      });

      return {
        period: {
          start: weekStart,
          end: weekEnd,
          label: `${format(weekStart, 'd MMM')} - ${format(weekEnd, 'd MMM yyyy')}`,
        },
        days,
        templates,
      };
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
        targetLow: block.targetLow,
        targetHigh: block.targetHigh,
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

async function findOrCreatePlan(db: typeof prisma, athleteId: number, dateInput: string) {
  const date = parseISO(`${dateInput}T00:00:00.000Z`);
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
    targetLow: number | null;
    targetHigh: number | null;
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
  return input === 'power' || input === 'pace' || input === 'hr' ? input : 'power';
}

export const athletePlannerService = createAthletePlannerService();
