import { addDays, addMonths, differenceInCalendarDays, endOfDay, endOfMonth, endOfWeek, format, isSameDay, startOfMonth, startOfWeek } from 'date-fns';
import { readOverviewCardsFromPrefsJson } from './overview-preferences.ts';
import { prisma } from './prisma.ts';
import { deriveSessionMetrics } from './session-math.ts';
import { getTempoZoneMeta } from './tempo-blocks.ts';
import { parseActivitySegments } from './activity-metrics.ts';
import { createSessionEditorDraftFromPersisted } from './session-editor.ts';
import { plannedMetrics } from './training-load-service.ts';
import { classifyCompliance, toDayKey } from './training-load.ts';

type AthleteServiceDeps = {
  db?: typeof prisma;
};

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

    const targetBlock = session.blocks.find(
      (block) =>
        block.targetType !== null && block.targetLow !== null && block.targetHigh !== null,
    );

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
      targetLabel:
        targetBlock && targetBlock.targetType
          ? `${targetBlock.targetLow}-${targetBlock.targetHigh} ${
              targetBlock.targetType === 'power'
                ? 'W'
                : targetBlock.targetType === 'hr'
                  ? 'bpm'
                  : 'pace'
            }`
          : null,
      durationSec: metrics.durationSec,
      tss: session.activity?.tss ?? metrics.tss,
      segments: session.activity?.segmentsJson
        ? parseActivitySegments(session.activity.segmentsJson)
        : metrics.segments,
      compliancePct: session.activity?.compliancePct ?? null,
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
      const todayCoachNote = datedSessions.find(
        (session) => isSameDay(session.date, today) && session.coachNotes && session.coachNotes.trim(),
      );
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
      const referenceDate = new Date(dateRef);
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
        .map(mapSessionSummary);
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

      return {
        athlete: {
          id: athlete.id,
          name: athlete.name ?? '',
        },
        coachName: athlete.coach?.name ?? null,
        view: resolvedView,
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

    async loadActivityFeed(userId: number) {
      const athlete = await db.user.findUnique({
        where: { id: userId },
        include: {
          activities: {
            orderBy: { completedAt: 'desc' },
            take: 12,
            include: {
              session: {
                include: {
                  blocks: {
                    orderBy: { sortOrder: 'asc' },
                  },
                },
              },
            },
          },
        },
      });

      if (!athlete || athlete.role !== 'ATHLETE') {
        return null;
      }

      const totals = athlete.activities.reduce(
        (summary, activity) => {
          summary.durationSec += activity.durationSec;
          summary.tss += activity.tss;
          return summary;
        },
        { durationSec: 0, tss: 0 },
      );

      return {
        athlete: {
          id: athlete.id,
          name: athlete.name ?? '',
        },
        totals,
        activities: athlete.activities.map((activity) => ({
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

      return {
        athlete: {
          id: session.athlete.id,
          name: session.athlete.name ?? '',
        },
        coachName: session.athlete.coach?.name ?? null,
        session: {
          ...summary,
          notes: session.activity?.notes ?? '',
          editor: createSessionEditorDraftFromPersisted(session.activity ? 'actual' : 'planned', {
            ...session,
            scheduledDate: session.date,
            blocks: session.blocks,
          }),
          blocks: session.blocks.map((block) => {
            const meta = getTempoZoneMeta(block.zone as 1 | 2 | 3 | 4 | 5);
            return {
              id: block.id,
              label: `${meta.label} ${meta.name}`,
              kind: block.kind,
              zone: block.zone,
              durationSec: block.durationSec,
              reps: block.reps,
              targetLabel:
                block.targetType && block.targetLow !== null && block.targetHigh !== null
                  ? `${block.targetLow}-${block.targetHigh} ${
                      block.targetType === 'power'
                        ? 'W'
                        : block.targetType === 'hr'
                          ? 'bpm'
                          : 'pace'
              }`
                  : null,
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
