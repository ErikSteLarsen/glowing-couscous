import { addDays, endOfWeek, format, formatISO, isValid, parseISO, startOfWeek } from 'date-fns';
import { prisma } from './prisma.ts';
import { deriveSessionMetrics } from './session-math.ts';
import {
  serializePlannerDraftForSave,
  validatePlannerSessionDraft,
  type PlannerSessionDraft,
} from './planner-draft.ts';

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
  targetLow: number | null;
  targetHigh: number | null;
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
      const [athletes, templates, librarySessions, trainingPlans, sessions] = await Promise.all([
        db.user.findMany({
          where: { coachId, role: 'ATHLETE' },
          orderBy: { name: 'asc' },
          select: { id: true, name: true, email: true },
        }),
        db.template.findMany({
          where: { ownerId: coachId },
          include: { blocks: { orderBy: { sortOrder: 'asc' } } },
          orderBy: [{ sport: 'asc' }, { name: 'asc' }],
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
                assignedById: session.assignedById,
                scheduledDate: isoDate,
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
            }),
        };
      });

      return {
        period: {
          start: weekStart,
          end: weekEnd,
          label: `${format(weekStart, 'd MMM')} - ${format(weekEnd, 'd MMM yyyy')}`,
        },
        athletes,
        templates,
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
        days,
      };
    },

    async saveSession(coachId: number, draft: PlannerSessionDraft, sessionId?: number) {
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
          select: { id: true, athleteId: true, adjusted: true },
        });
        if (!existing || existing.athleteId !== draft.athleteId) {
          return { ok: false as const, error: 'Session not found.', status: 404 };
        }
      }

      const scheduledDate = parseISO(draft.scheduledDate);
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
      const blocks = serialized.blocks.map((block) => ({
        kind: block.kind,
        zone: block.zone,
        durationSec: block.durationSec,
        reps: block.reps,
        targetType: block.targetType,
        targetLow: block.targetLow,
        targetHigh: block.targetHigh,
        note: block.note,
        sortOrder: block.sortOrder,
      }));
      const sessionData = {
        athleteId: draft.athleteId,
        planId: plan.id,
        templateId: draft.sourceTemplateId,
        assignedById: coachId,
        date: scheduledDate,
        timeLabel: null,
        sport: draft.sport,
        title: draft.title.trim(),
        summary: draft.summary.trim() || null,
        status: 'planned',
        source: draft.sourceTemplateId ? 'template' : 'coach',
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
        update: { assignedBy: coachId, assignedAt },
        create: { sessionId: savedSession.id, athleteId: draft.athleteId, assignedBy: coachId, assignedAt },
      });

      return { ok: true as const, sessionId: savedSession.id };
    },

    async deleteSession(coachId: number, sessionId: number) {
      const session = await db.session.findUnique({
        where: { id: sessionId },
        select: { id: true, athleteId: true, athlete: { select: { coachId: true } } },
      });
      if (!session || !session.athlete || session.athlete.coachId !== coachId) {
        return { ok: false as const, error: 'Session not found.', status: 404 };
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

function toTempoKind(input: string) {
  return input === 'warmup' || input === 'work' || input === 'recovery' || input === 'cooldown' ? input : 'work';
}

function toTempoZone(input: number) {
  return input >= 1 && input <= 5 ? (Math.round(input) as 1 | 2 | 3 | 4 | 5) : 2;
}

function toTargetType(input: string) {
  return input === 'power' || input === 'pace' || input === 'hr' ? input : 'power';
}

export const coachPlannerService = createCoachPlannerService();
