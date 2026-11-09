import { addDays, addMonths, differenceInCalendarDays, endOfDay, endOfMonth, endOfWeek, format, isSameDay, startOfMonth, startOfWeek } from 'date-fns';
import { Prisma } from '@prisma/client';
import { readOverviewCardsFromPrefsJson } from './overview-preferences.ts';
import { prisma } from './prisma.ts';
import { deriveSessionMetrics } from './session-math.ts';
import { getTempoZoneMeta } from './tempo-blocks.ts';
import { parseActivitySegments } from './activity-metrics.ts';
import { createSessionEditorDraftFromPersisted } from './session-editor.ts';
import { plannedMetrics } from './training-load-service.ts';
import { addDayKeys, classifyCompliance, fromDayKey, summarizeWeeks, toDayKey, type WeekSession } from './training-load.ts';
import { parseCalendarDay } from './calendar-navigation.ts';
import { formatWorkoutTarget } from './workout-target-resolution.ts';
import { normalizeWorkoutTarget } from './workout-targets.ts';
import { ACTIVITY_PAGE_SIZE, parseActivityFilters, type ActivityFilters } from './activity-navigation.ts';

type AthleteServiceDeps = {
  db?: typeof prisma;
};

/** Sessions the athlete placed themselves; coach-owned work keeps its coach's schedule. */
export function isSelfPlanned(session: { coachOwnerId?: number | null; assignedById?: number | null; trainingPlanId?: number | null }) {
  return !session.coachOwnerId && !session.assignedById && !session.trainingPlanId;
}

function selectPrimaryRequest<T extends { status: string }>(requests: T[]) {
  return requests.find((request) => request.status === 'PENDING') ?? requests[0] ?? null;
}

export function createAthleteService({ db = prisma }: AthleteServiceDeps = {}) {
  function mapSessionSummary(session: {
    id: number;
    title: string;
    summary: string | null;
    sport: string;
    date: Date;
    timeLabel: string | null;
    status: string;
    adjusted: boolean;
    coachBaselineJson?: string | null;
    blocks: Array<{
      id: number;
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
    }>;
    activity?: {
      tss: number;
      durationSec?: number;
      compliancePct?: number | null;
      segmentsJson?: string | null;
      metricsSource?: string;
    } | null;
  }) {
    const metrics = deriveSessionMetrics(
      session.blocks.filter((block) => !block.skipped).map((block) => ({
        kind: block.kind as 'warmup' | 'work' | 'recovery' | 'cooldown',
        zone: block.zone as 1 | 2 | 3 | 4 | 5,
        durationSec: block.durationSec,
        reps: block.reps,
        target:
          block.targetType && block.targetLow !== null && block.targetHigh !== null
            ? {
                metric: block.targetType as 'power' | 'pace' | 'hr' | 'rpe',
                mode: block.targetMode === 'relative' ? 'relative' : 'absolute',
                reference: block.targetReference as 'ftp' | 'threshold-pace' | 'css' | 'threshold-hr' | null,
                low: block.targetLow,
                high: block.targetHigh,
              }
            : null,
      })),
    );

    const target = session.blocks
      .filter((block) => !block.skipped)
      .map((block) => normalizeWorkoutTarget({
        metric: block.targetType,
        mode: block.targetMode ?? 'absolute',
        reference: block.targetReference ?? null,
        low: block.targetLowDecimal ?? block.targetLow,
        high: block.targetHighDecimal ?? block.targetHigh,
      }))
      .find((candidate) => candidate !== null);

    const status = (
      session.activity
        ? 'completed'
        : session.status === 'missed'
          ? 'missed'
          : session.adjusted
            ? 'adjusted'
            : 'planned'
    ) as 'planned' | 'completed' | 'adjusted' | 'missed';
    const planned = plannedMetrics(
      { coachBaselineJson: session.coachBaselineJson ?? null, blocks: session.blocks.map((block) => ({ ...block, skipped: Boolean(block.skipped) })) },
      { completed: status === 'completed', metricsSource: session.activity?.metricsSource },
    );
    const compliance = classifyCompliance({
      status,
      day: toDayKey(session.date),
      today: toDayKey(new Date()),
      plannedDurationSec: planned.durationSec,
      plannedTss: planned.tss,
      actualDurationSec: session.activity?.durationSec ?? null,
      actualTss: session.activity?.tss ?? null,
      compliancePct: session.activity?.compliancePct ?? null,
    });

    return {
      id: session.id,
      title: session.title,
      summary: session.summary,
      sport: session.sport,
      date: session.date,
      timeLabel: session.timeLabel ?? format(session.date, 'HH:mm'),
      status,
      compliance,
      plannedDurationSec: planned.durationSec,
      plannedTss: planned.tss,
      targetLabel: target ? formatWorkoutTarget(target) : null,
      durationSec: metrics.durationSec,
      tss: session.activity?.tss ?? metrics.tss,
      segments: session.activity?.segmentsJson
        ? parseActivitySegments(session.activity.segmentsJson)
        : metrics.segments,
      compliancePct: session.activity?.compliancePct ?? null,
      actualDurationSec: session.activity ? (session.activity.durationSec ?? null) : null,
      actualTss: session.activity ? session.activity.tss : null,
      metricsSource: session.activity?.metricsSource ?? null,
      blockCount: session.blocks.length,
    };
  }

  async function listRequestsForAthlete(userId: number) {
    const requests = await db.coachRequest.findMany({
      where: { athleteId: userId },
      include: {
        coach: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });

    return requests.map((request) => ({
      ...request,
      coach: { ...request.coach, name: request.coach.name ?? '' },
    }));
  }

  async function loadAthleteIdentity(userId: number) {
    return db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        coachId: true,
        selfCoached: true,
        name: true,
        email: true,
      },
    });
  }

  return {
    async findProfileByUserId(userId: number) {
      const athlete = await loadAthleteIdentity(userId);
      if (!athlete || athlete.role !== 'ATHLETE') {
        return null;
      }

      if (!athlete.coachId && !athlete.selfCoached) {
        return null;
      }

      return {
        id: athlete.id,
        coachId: athlete.coachId,
        selfCoached: athlete.selfCoached,
        name: athlete.name ?? '',
        email: athlete.email,
      };
    },

    async loadHomeDashboard(userId: number) {
      const now = new Date();
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
      // Late in the week, the next few days reach into next week.
      const lookaheadEnd = endOfDay(addDays(now, 4));
      const athlete = await db.user.findUnique({
        where: { id: userId },
        include: {
          coach: {
            select: { id: true, name: true, email: true },
          },
          sessions: {
            where: {
              date: {
                gte: startOfWeek(now, { weekStartsOn: 1 }),
                lte: lookaheadEnd > weekEnd ? lookaheadEnd : weekEnd,
              },
            },
            include: {
              blocks: {
                orderBy: { sortOrder: 'asc' },
              },
              activity: true,
            },
            orderBy: { date: 'asc' },
          },
          activities: {
            orderBy: { completedAt: 'desc' },
            take: 1,
            include: {
              session: true,
            },
          },
        },
      });

      if (!athlete || athlete.role !== 'ATHLETE') {
        return null;
      }

      const overviewCards = readOverviewCardsFromPrefsJson(athlete.prefsJson);

      const datedSessions = athlete.sessions.filter((s): s is typeof s & { date: Date } => s.date !== null);
      const sessions = datedSessions.map(mapSessionSummary);
      const today = now;
      const todaySessions = sessions.filter((session) => isSameDay(session.date, today));
      const nextSession = todaySessions.find((session) => session.status !== 'completed');
      const todayCoachNote = datedSessions.find((session) => session.id === nextSession?.id);
      const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
      const weekDays = Array.from({ length: 7 }, (_, index) => {
        const day = addDays(currentWeekStart, index);
        return {
          label: format(day, 'EEE'),
          dateLabel: format(day, 'd'),
          isoDate: format(day, 'yyyy-MM-dd'),
          isToday: isSameDay(day, today),
          sessions: sessions.filter((session) => isSameDay(session.date, day)),
        };
      });
      const nextDays = Array.from({ length: 4 }, (_, index) => {
        const day = addDays(today, index + 1);
        const daySessions = sessions.filter((session) => isSameDay(session.date, day));
        return {
          label: format(day, 'EEE'),
          dateLabel: format(day, 'd'),
          isoDate: format(day, 'yyyy-MM-dd'),
          sessions: daySessions,
        };
      });

      const weekTotals = sessions.filter((session) => session.date <= weekEnd).reduce(
        (accumulator, session) => {
          accumulator.durationSec += session.durationSec;
          accumulator.tss += session.tss;
          return accumulator;
        },
        { durationSec: 0, tss: 0 },
      );

      return {
        athlete: {
          id: athlete.id,
          name: athlete.name ?? '',
        },
        coach: athlete.coach
          ? { ...athlete.coach, name: athlete.coach.name ?? '' }
          : null,
        overviewCards,
        todaySessions,
        weekDays,
        nextDays,
        lastActivity: athlete.activities[0]
          ? {
              sessionId: athlete.activities[0].sessionId,
              title: athlete.activities[0].session.title,
              sport: athlete.activities[0].session.sport,
              rpe: athlete.activities[0].rpe,
              notes: athlete.activities[0].notes,
              completedAt: athlete.activities[0].completedAt,
              durationSec: athlete.activities[0].durationSec,
              tss: athlete.activities[0].tss,
            }
          : null,
        weekTotals,
        coachNote:
          athlete.coach && todayCoachNote?.coachNotes
            ? { sessionTitle: todayCoachNote.title, text: todayCoachNote.coachNotes.trim() }
            : null,
      };
    },

    async listForAthlete(userId: number) {
      return listRequestsForAthlete(userId);
    },

    async loadCoachSearchState(userId: number) {
      const [profile, requests] = await Promise.all([
        this.findProfileByUserId(userId),
        listRequestsForAthlete(userId),
      ]);

      return {
        profile,
        requests,
        latestRequest: selectPrimaryRequest(requests),
      };
    },

    async loadProfileState(userId: number) {
      const profile = await this.findProfileByUserId(userId);
      if (profile) {
        return { profile, latestRequest: null };
      }

      const latestRequest = selectPrimaryRequest(await listRequestsForAthlete(userId));

      return { profile: null, latestRequest };
    },

    async loadCalendarView(userId: number, dateRef: Date | string, view: 'week' | 'month' = 'week') {
      // A yyyy-MM-dd reference is a local calendar day, never a UTC instant.
      const dayRef = parseCalendarDay(dateRef);
      const parsedReference = dayRef ? fromDayKey(dayRef) : new Date(dateRef);
      const referenceDate = Number.isNaN(parsedReference.getTime()) ? new Date() : parsedReference;
      const resolvedView = view === 'month' ? 'month' : 'week';
      const periodStart =
        resolvedView === 'month'
          ? startOfMonth(referenceDate)
          : startOfWeek(referenceDate, { weekStartsOn: 1 });
      const queryStart =
        resolvedView === 'month'
          ? startOfWeek(periodStart, { weekStartsOn: 1 })
          : periodStart;
      const queryEnd =
        resolvedView === 'month'
          ? endOfWeek(endOfMonth(periodStart), { weekStartsOn: 1 })
          : endOfWeek(referenceDate, { weekStartsOn: 1 });

      const athlete = await db.user.findUnique({
        where: { id: userId },
        include: {
          coach: {
            select: { id: true, name: true },
          },
          sessions: {
            where: {
              date: {
                gte: queryStart,
                lte: queryEnd,
              },
            },
            include: {
              blocks: {
                orderBy: { sortOrder: 'asc' },
              },
              activity: true,
            },
            orderBy: [{ date: 'asc' }, { id: 'asc' }],
          },
        },
      });

      if (!athlete || athlete.role !== 'ATHLETE') {
        return null;
      }

      const sessions = athlete.sessions
        .filter((s): s is typeof s & { date: Date } => s.date !== null)
        .map((session) => ({
          ...mapSessionSummary(session),
          // Only the athlete's own open sessions can be moved from the calendar.
          canReschedule: !session.activity && session.status !== 'completed' && isSelfPlanned(session),
        }));
      const buildDay = (date: Date) => ({
        label: format(date, 'EEE'),
        dateLabel: format(date, 'd'),
        isoDate: format(date, 'yyyy-MM-dd'),
        isCurrentMonth:
          date.getMonth() === periodStart.getMonth() &&
          date.getFullYear() === periodStart.getFullYear(),
        isToday: isSameDay(date, new Date()),
        sessions: sessions.filter((session) => isSameDay(session.date, date)),
      });
      const days =
        resolvedView === 'week'
          ? Array.from({ length: 7 }, (_, index) => buildDay(addDays(periodStart, index)))
          : [];
      const totalMonthDays =
        resolvedView === 'month' ? differenceInCalendarDays(queryEnd, queryStart) + 1 : 0;
      const weeks =
        resolvedView === 'month'
          ? Array.from({ length: totalMonthDays / 7 }, (_, weekIndex) =>
              Array.from({ length: 7 }, (_, dayIndex) => buildDay(addDays(queryStart, weekIndex * 7 + dayIndex))),
            )
          : [];

      const weekStarts: string[] = [];
      for (let weekStart = toDayKey(queryStart); weekStart <= toDayKey(queryEnd); weekStart = addDayKeys(weekStart, 7)) {
        weekStarts.push(weekStart);
      }
      const weekSessions: WeekSession[] = sessions.map((session) => ({
        day: toDayKey(session.date),
        sport: session.sport,
        plannedDurationSec: session.plannedDurationSec,
        plannedTss: session.plannedTss,
        actualDurationSec: session.actualDurationSec,
        actualTss: session.actualTss,
        compliance: session.compliance,
      }));
      const weekSummaries = summarizeWeeks(weekSessions, weekStarts);

      return {
        athlete: {
          id: athlete.id,
          name: athlete.name ?? '',
        },
        coachName: athlete.coach?.name ?? null,
        view: resolvedView,
        weekSummaries,
        period: {
          start: periodStart,
          previousStart: resolvedView === 'month' ? addMonths(periodStart, -1) : addDays(periodStart, -7),
          nextStart: resolvedView === 'month' ? addMonths(periodStart, 1) : addDays(periodStart, 7),
          label: resolvedView === 'month' ? format(periodStart, 'MMMM yyyy') : `Week of ${format(periodStart, 'd MMM')}`,
        },
        days,
        weeks,
      };
    },

    async loadActivityFeed(userId: number, filters: ActivityFilters = parseActivityFilters({})) {
      const athlete = await loadAthleteIdentity(userId);
      if (!athlete || athlete.role !== 'ATHLETE') {
        return null;
      }
      const scope = Prisma.sql`
        FROM Activity a JOIN Session s ON s.id = a.sessionId
        WHERE a.athleteId = ${userId} AND s.athleteId = ${userId}
          AND (${filters.sport} IS NULL OR s.sport = ${filters.sport})
          AND instr(lower(s.title), lower(${filters.query})) > 0
      `;
      return db.$transaction(async (tx) => {
        const [summary] = await tx.$queryRaw<Array<{ count: bigint; durationSec: bigint; tss: bigint }>>(Prisma.sql`
          SELECT COUNT(*) AS count, COALESCE(SUM(a.durationSec), 0) AS durationSec,
            COALESCE(SUM(a.tss), 0) AS tss ${scope}
        `);
        const count = Number(summary.count);
        const totalPages = Math.max(1, Math.ceil(count / ACTIVITY_PAGE_SIZE));
        const page = Math.min(filters.page, totalPages);
        const matches = await tx.$queryRaw<Array<{ id: number }>>(Prisma.sql`
          SELECT a.id ${scope} ORDER BY a.completedAt DESC, a.id DESC
          LIMIT ${ACTIVITY_PAGE_SIZE} OFFSET ${(page - 1) * ACTIVITY_PAGE_SIZE}
        `);
        const activities = await tx.activity.findMany({
          where: { id: { in: matches.map((match) => match.id) }, athleteId: userId },
          orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
          include: { session: { select: { id: true, title: true, sport: true } } },
        });
        return {
          athlete: {
            id: athlete.id,
            name: athlete.name ?? '',
          },
          count,
          page,
          totalPages,
          totals: { durationSec: Number(summary.durationSec), tss: Number(summary.tss) },
          activities: activities.map((activity) => ({
            id: activity.id,
            sessionId: activity.sessionId,
            title: activity.session.title,
            sport: activity.session.sport,
            completedAt: activity.completedAt,
            durationSec: activity.durationSec,
            tss: activity.tss,
            compliancePct: activity.compliancePct,
            metricsSource: activity.metricsSource,
            notes: activity.notes,
            segments: parseActivitySegments(activity.segmentsJson),
          })),
        };
      });
    },

    async loadSessionDetail(userId: number, sessionId: number) {
      if (!Number.isInteger(sessionId) || sessionId <= 0) {
        return null;
      }

      const athlete = await loadAthleteIdentity(userId);
      if (!athlete || athlete.role !== 'ATHLETE') {
        return null;
      }

      const session = await db.session.findUnique({
        where: { id: sessionId },
        include: {
          athlete: {
            select: {
              id: true,
              name: true,
              coach: {
                select: { id: true, name: true },
              },
            },
          },
          blocks: {
            orderBy: { sortOrder: 'asc' },
          },
          activity: true,
        },
      });

      if (!session || session.athleteId !== userId || !session.date || !session.athlete) {
        return null;
      }

      const summary = mapSessionSummary({ ...session, date: session.date });
      const editor = createSessionEditorDraftFromPersisted(session.activity ? 'actual' : 'planned', {
        ...session,
        scheduledDate: session.date,
        blocks: session.blocks,
      });

      return {
        athlete: {
          id: session.athlete.id,
          name: session.athlete.name ?? '',
        },
        coachName: session.athlete.coach?.name ?? null,
        session: {
          ...summary,
          notes: session.activity?.notes ?? session.athleteNotes ?? '',
          editor,
          blocks: session.blocks.map((block, index) => {
            const meta = getTempoZoneMeta(block.zone as 1 | 2 | 3 | 4 | 5);
            return {
              id: block.id,
              label: `${meta.label} ${meta.name}`,
              kind: block.kind,
              zone: block.zone,
              durationSec: block.durationSec,
              reps: block.reps,
              targetLabel: editor.blocks[index]?.target ? formatWorkoutTarget(editor.blocks[index].target) : null,
              note: block.note,
              skipped: block.skipped,
              color: meta.solid,
              tint: meta.tint,
            };
          }),
        },
      };
    },
  };
}

export const athleteService = createAthleteService();
