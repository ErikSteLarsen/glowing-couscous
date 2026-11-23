import { addDays, endOfWeek, format, isValid, parseISO, startOfWeek } from 'date-fns';
import { prisma } from './prisma.ts';
import { createSessionSnapshotJson } from './session-snapshot-service.ts';
import { isAssignmentDate } from './template-period.ts';

type AssignmentResult =
  | { ok: true; sessionId: number }
  | { ok: false; error: string; status: number };

export type AssignmentSource =
  | { kind: 'library-session'; sessionId: number }
  | { kind: 'training-plan'; trainingPlanId: number };

export type AssignSourceCommand = {
  coachId: number;
  athleteId: number;
  source: AssignmentSource;
  scheduledDate?: string;
  weekStart?: string;
};

type SourceSession = {
  id: number;
  sport: string;
  title: string;
  summary: string | null;
  sportMetricsJson: string | null;
  timeLabel: string | null;
  planWeekday: number | null;
  blocks: AssignmentBlock[];
};

type SourceAssignmentDb = {
  user: { findFirst(args: unknown): Promise<{ id: number } | null> };
  session: {
    findFirst(args: unknown): Promise<SourceSession | { id: number } | null>;
    create(args: unknown): Promise<{ id: number }>;
  };
  plan: {
    findFirst(args: unknown): Promise<{ id: number } | null>;
    create(args: unknown): Promise<{ id: number }>;
  };
  assignment: {
    findFirst(args: unknown): Promise<{ sessionId: number } | null>;
    create(args: unknown): Promise<unknown>;
  };
  trainingPlan: {
    findFirst(args: unknown): Promise<{ id: number; name: string; sessions: SourceSession[] } | null>;
  };
  trainingPlanAssignment: {
    findUnique(args: unknown): Promise<{ id: number; assignments: Array<{ sessionId: number }> } | null>;
    create(args: unknown): Promise<{ id: number }>;
  };
  $transaction<T>(callback: (tx: SourceAssignmentDb) => Promise<T>): Promise<T>;
};

type AssignmentBlock = {
  kind: string;
  zone: number;
  durationSec: number;
  reps: number | null;
  targetType: string | null;
  targetMode?: string;
  targetReference?: string | null;
  targetLow: number | null;
  targetHigh: number | null;
  targetLowDecimal?: string | null;
  targetHighDecimal?: string | null;
  note: string | null;
  skipped?: boolean;
  sortOrder: number;
};

export function createAssignmentService({ db = prisma as unknown as SourceAssignmentDb }: { db?: SourceAssignmentDb } = {}) {
  return {
    async assignSourceToAthlete(command: AssignSourceCommand): Promise<AssignmentResult | { ok: true; sessionIds: number[] }> {
      const sourceDb = db as unknown as SourceAssignmentDb;
      if (command.source.kind === 'library-session') {
        return assignLibrarySession(sourceDb, command);
      }

      return assignTrainingPlan(sourceDb, command);
    },

    async assignSourcesToAthlete(command: AssignSourceCommand, scheduledDates: string[]): Promise<AssignmentResult | { ok: true; sessionIds: number[] }> {
      if (scheduledDates.some((date) => !isAssignmentDate(date))) return { ok: false, error: 'Choose valid calendar dates.', status: 400 };
      const dates = Array.from(new Set(scheduledDates)).sort();
      if (dates.length === 0) return { ok: false, error: 'Choose at least one target date.', status: 400 };
      if (command.source.kind === 'training-plan') {
        return this.assignSourceToAthlete({ ...command, scheduledDate: dates[0] });
      }
      const sessionIds: number[] = [];
      for (const date of dates) {
        const result = await this.assignSourceToAthlete({ ...command, scheduledDate: date });
        if (!result.ok) return result;
        if ('sessionIds' in result) sessionIds.push(...result.sessionIds);
        else sessionIds.push(result.sessionId);
      }
      return { ok: true, sessionIds };
    },
  };
}

async function assignLibrarySession(db: SourceAssignmentDb, command: AssignSourceCommand): Promise<AssignmentResult> {
  if (!command.scheduledDate) return { ok: false, error: 'A scheduled date is required.', status: 400 };
  const scheduledDate = parseISO(command.scheduledDate);
  if (!isValid(scheduledDate)) return { ok: false, error: 'A valid scheduled date is required.', status: 400 };

  const athlete = await db.user.findFirst({
    where: { id: command.athleteId, coachId: command.coachId, role: 'ATHLETE' },
  });
  if (!athlete) return { ok: false, error: 'Athlete not found in your roster.', status: 404 };

  const source = await db.session.findFirst({
    where: {
      id: command.source.kind === 'library-session' ? command.source.sessionId : -1,
      coachOwnerId: command.coachId,
      athleteId: null,
      trainingPlanId: null,
    },
    include: { blocks: { orderBy: { sortOrder: 'asc' } } },
  }) as SourceSession | null;
  if (!source || !('blocks' in source)) return { ok: false, error: 'Workout not found.', status: 404 };

  const weekStart = startOfWeek(scheduledDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(scheduledDate, { weekStartsOn: 1 });
  const plan =
    (await db.plan.findFirst({ where: { athleteId: command.athleteId, startDate: weekStart, endDate: weekEnd }, orderBy: { id: 'desc' } })) ??
    (await db.plan.create({
      data: { athleteId: command.athleteId, name: `Week of ${format(weekStart, 'd MMM yyyy')}`, startDate: weekStart, endDate: weekEnd },
    }));

  const existing = await db.assignment.findFirst({
    where: { sourceSessionId: source.id, athleteId: command.athleteId, targetDate: scheduledDate },
  });
  if (existing) return { ok: true, sessionId: existing.sessionId };

  return db.$transaction(async (tx) => {
    const copied = await tx.session.create({
      data: {
        athleteId: command.athleteId,
        planId: plan.id,
        templateId: null,
        assignedById: command.coachId,
        date: scheduledDate,
        planWeekday: null,
        timeLabel: source.timeLabel,
        sport: source.sport,
        title: source.title,
        summary: source.summary,
        sportMetricsJson: source.sportMetricsJson,
        status: 'planned',
        source: 'library-copy',
        adjusted: false,
        coachBaselineJson: createSessionSnapshotJson({
          athleteId: command.athleteId,
          planId: plan.id,
          assignedById: command.coachId,
          scheduledDate,
          timeLabel: source.timeLabel,
          sport: source.sport,
          title: source.title,
          summary: source.summary,
          sportMetricsJson: source.sportMetricsJson,
          status: 'planned',
          source: 'library-copy',
          blocks: source.blocks,
        }),
        coachNotes: null,
        rpe: null,
        blocks: { create: source.blocks.map((block) => ({ ...block, skipped: block.skipped ?? false })) },
      },
    });
    await tx.assignment.create({
      data: {
        sessionId: copied.id,
        athleteId: command.athleteId,
        assignedBy: command.coachId,
        sourceSessionId: source.id,
        targetDate: scheduledDate,
      },
    });
    return { ok: true, sessionId: copied.id };
  });
}

async function assignTrainingPlan(db: SourceAssignmentDb, command: AssignSourceCommand): Promise<{ ok: true; sessionIds: number[] } | { ok: false; error: string; status: number }> {
  if (!command.weekStart) return { ok: false, error: 'A target week is required.', status: 400 };
  const requestedWeek = parseISO(command.weekStart);
  if (!isValid(requestedWeek)) return { ok: false, error: 'A valid target week is required.', status: 400 };
  const weekStart = startOfWeek(requestedWeek, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });

  const athlete = await db.user.findFirst({ where: { id: command.athleteId, coachId: command.coachId, role: 'ATHLETE' } });
  if (!athlete) return { ok: false, error: 'Athlete not found in your roster.', status: 404 };
  const source = await db.trainingPlan.findFirst({
    where: { id: command.source.kind === 'training-plan' ? command.source.trainingPlanId : -1, coachOwnerId: command.coachId },
    include: { sessions: { include: { blocks: { orderBy: { sortOrder: 'asc' } } }, orderBy: { planWeekday: 'asc' } } },
  });
  if (!source) return { ok: false, error: 'Training plan not found.', status: 404 };
  if (source.sessions.some((session) => session.planWeekday === null || session.planWeekday < 1 || session.planWeekday > 7)) {
    return { ok: false, error: 'Training plan contains an invalid weekday.', status: 400 };
  }

  const plan =
    (await db.plan.findFirst({ where: { athleteId: command.athleteId, startDate: weekStart, endDate: weekEnd }, orderBy: { id: 'desc' } })) ??
    (await db.plan.create({ data: { athleteId: command.athleteId, name: `${source.name ?? 'Training plan'}, week of ${format(weekStart, 'd MMM yyyy')}`, startDate: weekStart, endDate: weekEnd } }));
  const existing = await db.trainingPlanAssignment.findUnique({
    where: { trainingPlanId_athleteId_weekStart: { trainingPlanId: source.id, athleteId: command.athleteId, weekStart } },
    include: { assignments: { select: { sessionId: true } } },
  });
  if (existing) return { ok: true, sessionIds: existing.assignments.map((assignment) => assignment.sessionId) };

  return db.$transaction(async (tx) => {
    const parent = await tx.trainingPlanAssignment.create({
      data: { trainingPlanId: source.id, athleteId: command.athleteId, weekStart, assignedBy: command.coachId },
    }) as { id: number };
    const sessionIds: number[] = [];
    for (const sourceSession of source.sessions) {
      const targetDate = addDays(weekStart, sourceSession.planWeekday! - 1);
      const copied = await tx.session.create({
        data: {
          athleteId: command.athleteId,
          planId: plan.id,
          trainingPlanId: null,
          templateId: null,
          assignedById: command.coachId,
          date: targetDate,
          planWeekday: null,
          timeLabel: sourceSession.timeLabel,
          sport: sourceSession.sport,
          title: sourceSession.title,
          summary: sourceSession.summary,
          sportMetricsJson: sourceSession.sportMetricsJson,
          status: 'planned',
          source: 'training-plan-copy',
          adjusted: false,
          coachBaselineJson: createSessionSnapshotJson({
            athleteId: command.athleteId,
            planId: plan.id,
            assignedById: command.coachId,
            scheduledDate: targetDate,
            planWeekday: null,
            timeLabel: sourceSession.timeLabel,
            sport: sourceSession.sport,
            title: sourceSession.title,
            summary: sourceSession.summary,
            sportMetricsJson: sourceSession.sportMetricsJson,
            status: 'planned',
            source: 'training-plan-copy',
            blocks: sourceSession.blocks,
          }),
          coachNotes: null,
          rpe: null,
          blocks: { create: sourceSession.blocks.map((block) => ({ ...block, skipped: block.skipped ?? false })) },
        },
      });
      await tx.assignment.create({
        data: {
          sessionId: copied.id,
          athleteId: command.athleteId,
          assignedBy: command.coachId,
          sourceSessionId: sourceSession.id,
          targetDate,
          trainingPlanAssignmentId: parent.id,
        },
      });
      sessionIds.push(copied.id);
    }
    return { ok: true, sessionIds };
  });
}

export const assignmentService = createAssignmentService();
