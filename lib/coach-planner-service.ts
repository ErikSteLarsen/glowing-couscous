import { plannerSessionInput } from './session-write-input.ts';
import { createSessionEditorBlockData } from './session-editor.ts';
import { addDays, differenceInCalendarDays, endOfMonth, endOfWeek, format, formatISO, isValid, parseISO, startOfMonth, startOfWeek } from 'date-fns';
import { prisma } from './prisma.ts';
import { derivePlannerSessionMetrics } from './planner-source-metrics.ts';
import {
  serializePlannerDraftForSave,
  validatePlannerSessionDraft,
} from './planner-draft.ts';
import { createSessionSnapshotJson } from './session-snapshot-service.ts';

type CoachPlannerDeps = {
  db?: typeof prisma;
  now?: () => Date;
};

type TempoBlockRecord = {
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
  sortOrder: number;
};

type SessionBlockCreate = TempoBlockRecord;

export function createCoachPlannerService({ db = prisma, now = () => new Date() }: CoachPlannerDeps = {}) {
  return {
    async loadWorkspace(coachId: number, referenceDateInput?: string) {
      const referenceDate = parseReferenceDate(referenceDateInput);
      const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(referenceDate, { weekStartsOn: 1 });
      const calendarStart = startOfWeek(startOfMonth(referenceDate), { weekStartsOn: 1 });
      const calendarEnd = endOfWeek(endOfMonth(referenceDate), { weekStartsOn: 1 });
      const [athletes, librarySessions, trainingPlans, sessions, calendarSessions] = await Promise.all([
        db.user.findMany({
          where: { coachId, role: 'ATHLETE' },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, email: true, performanceProfileJson: true },
        }),
        db.session.findMany({
          where: { coachOwnerId: coachId, athleteId: null, trainingPlanId: null },
          include: { blocks: { orderBy: { sortOrder: 'asc' } } },
          orderBy: [{ date: 'asc' }, { title: 'asc' }],
        }),
        db.trainingPlan.findMany({
          where: { coachOwnerId: coachId },
          include: {
            sessions: {
              include: { blocks: { orderBy: { sortOrder: 'asc' } } },
              orderBy: { planWeekday: 'asc' },
            },
          },
          orderBy: [{ sport: 'asc' }, { name: 'asc' }],
        }),
        db.session.findMany({
          where: {
            athlete: { coachId },
            date: { gte: weekStart, lte: weekEnd },
          },
          include: { blocks: { orderBy: { sortOrder: 'asc' } } },
          orderBy: [{ date: 'asc' }, { title: 'asc' }],
        }),
        db.session.findMany({
          where: {
            athlete: { coachId },
            date: { gte: calendarStart, lte: calendarEnd },
          },
          include: { blocks: { orderBy: { sortOrder: 'asc' } } },
          orderBy: [{ date: 'asc' }, { title: 'asc' }],
        }),
      ]);

      const shapeSession = (session: typeof sessions[number]) => {
        const metrics = derivePlannerSessionMetrics(session.blocks);

        return {
          id: session.id,
          athleteId: session.athleteId,
          templateId: session.templateId,
          assignedById: session.assignedById,
          scheduledDate: session.date ? formatISO(session.date, { representation: 'date' }) : '',
          sport: session.sport,
          title: session.title,
          summary: session.summary,
          status: session.status,
          source: session.source,
          adjusted: session.adjusted,
          sportMetricsJson: session.sportMetricsJson ?? null,
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
         athletes: athletes.map((athlete) => ({ ...athlete, name: athlete.name ?? '' })),
        librarySessions: librarySessions.map((session) => ({
          ...session,
          date: session.date ? formatISO(session.date, { representation: 'date' }) : null,
        })),
        trainingPlans: trainingPlans.map((plan) => ({
          ...plan,
          sessions: plan.sessions.map((session) => ({
            ...session,
            date: session.date ? formatISO(session.date, { representation: 'date' }) : null,
          })),
        })),
        calendarDays,
        days,
      };
    },

    async saveSession(coachId: number, input: unknown, sessionId?: number) {
      const parsed = plannerSessionInput.safeParse(input);
      if (!parsed.success) return { ok: false as const, status: 400, error: 'Invalid session draft.' };
      const draft = parsed.data;
      const validationError = validatePlannerSessionDraft(draft);
      if (validationError) {
        return { ok: false as const, error: validationError, status: 400 };
      }

      if (!draft.athleteId) {
        return { ok: false as const, error: 'Choose an athlete before saving.', status: 400 };
      }

      if (!draft.scheduledDate) {
        return { ok: false as const, error: 'A scheduled date is required.', status: 400 };
      }

      const athlete = await db.user.findFirst({
        where: { id: draft.athleteId, coachId, role: 'ATHLETE' },
        select: { id: true },
      });
      if (!athlete) {
        return { ok: false as const, error: 'Athlete not found in your roster.', status: 404 };
      }

      if (sessionId !== undefined) {
        const existing = await db.session.findUnique({
          where: { id: sessionId },
          select: { id: true, athleteId: true, adjusted: true, activity: { select: { id: true } } },
        });
        if (!existing || existing.athleteId !== draft.athleteId) {
          return { ok: false as const, error: 'Session not found.', status: 404 };
        }
        if (existing.activity) {
          return { ok: false as const, error: 'Completed sessions are immutable.', status: 409 };
        }
      }

       const scheduledDate = parseISO(`${draft.scheduledDate}T00:00:00.000Z`);
      const weekStart = startOfWeek(scheduledDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(scheduledDate, { weekStartsOn: 1 });
      const plan =
        (await db.plan.findFirst({
          where: { athleteId: draft.athleteId, startDate: weekStart, endDate: weekEnd },
          orderBy: { id: 'desc' },
        })) ??
        (await db.plan.create({
          data: {
            athleteId: draft.athleteId,
            name: `Week of ${format(weekStart, 'd MMM yyyy')}`,
            startDate: weekStart,
            endDate: weekEnd,
          },
        }));

      const serialized = serializePlannerDraftForSave(draft);
      const blocks = createSessionEditorBlockData(serialized.blocks);
      const sessionData = {
        athleteId: draft.athleteId,
        planId: plan.id,
        templateId: null,
        assignedById: coachId,
        date: scheduledDate,
        timeLabel: null,
        sport: draft.sport,
        title: draft.title.trim(),
        summary: draft.summary.trim() || null,
        status: 'planned',
        source: 'coach',
        adjusted: false,
        coachBaselineJson: createSessionSnapshotJson({
          athleteId: draft.athleteId,
          planId: plan.id,
          templateId: null,
          assignedById: coachId,
          scheduledDate: draft.scheduledDate,
          sport: draft.sport,
          title: draft.title,
          summary: draft.summary,
          sportMetrics: draft.sportMetrics,
          status: 'planned',
          source: 'coach',
          blocks: serialized.blocks,
        }),
        coachNotes: null,
        rpe: null,
      };

      const savedSession =
        sessionId === undefined
          ? await db.session.create({
              data: {
                ...sessionData,
                adjusted: false,
                blocks: { create: blocks },
              },
            })
          : await updateExistingSession(db, sessionId, sessionData, blocks);

      const assignedAt = now();
      await db.assignment.upsert({
        where: { sessionId_athleteId: { sessionId: savedSession.id, athleteId: draft.athleteId } },
        update: { assignedBy: coachId, assignedAt, targetDate: scheduledDate },
        create: { sessionId: savedSession.id, athleteId: draft.athleteId, assignedBy: coachId, assignedAt, targetDate: scheduledDate },
      });

      return { ok: true as const, sessionId: savedSession.id };
    },

    async deleteSession(coachId: number, sessionId: number) {
      const session = await db.session.findUnique({
        where: { id: sessionId },
        select: {
          id: true,
          athleteId: true,
          activity: { select: { id: true } },
          athlete: { select: { coachId: true } },
        },
      });
      if (!session || !session.athlete || session.athlete.coachId !== coachId) {
        return { ok: false as const, error: 'Session not found.', status: 404 };
      }
      if (session.activity) {
        return { ok: false as const, error: 'Completed sessions are immutable.', status: 409 };
      }

      await db.session.delete({ where: { id: sessionId } });
      return { ok: true as const, sessionId };
    },
  };
}

async function updateExistingSession(
  db: typeof prisma,
  sessionId: number,
  sessionData: {
    athleteId: number;
    planId: number;
    templateId: number | null;
    assignedById: number;
    date: Date;
    timeLabel: null;
    sport: string;
    title: string;
    summary: string | null;
    status: string;
    source: string;
    adjusted: boolean;
    coachBaselineJson: string;
    coachNotes: string | null;
    rpe: number | null;
  },
  blocks: SessionBlockCreate[],
) {
  const [, savedSession] = await db.$transaction([
    db.block.deleteMany({ where: { sessionId } }),
    db.session.update({
      where: { id: sessionId },
      data: {
        ...sessionData,
        blocks: { create: blocks },
      },
    }),
  ]);
  return savedSession;
}

function parseReferenceDate(input?: string) {
  const parsed = input ? parseISO(input) : new Date();
  return isValid(parsed) ? parsed : new Date();
}

export const coachPlannerService = createCoachPlannerService();
