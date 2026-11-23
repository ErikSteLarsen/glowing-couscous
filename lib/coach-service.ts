import { endOfWeek, format, isSameDay, startOfWeek } from 'date-fns';
import { prisma } from './prisma.ts';
import { getWeekDays } from './week.ts';
import { derivePlannerSessionMetrics, type PlannerSessionMetricBlock } from './planner-source-metrics.ts';
import { parsePerformanceProfileJson } from './performance-profile.ts';
import { parseActivitySegments } from './activity-metrics.ts';
import { getSessionDisplayStatus } from './athlete-session-status-service.ts';

type CoachServiceDeps = {
  db?: typeof prisma;
  now?: () => Date;
};

type SessionRecord = {
  id: number;
  title: string;
  sport: string;
  date: Date;
  status: string;
  adjusted: boolean;
  blocks: PlannerSessionMetricBlock[];
  activity: {
    durationSec: number;
    tss: number | null;
    compliancePct: number | null;
    segmentsJson: string | null;
    metricsSource: string;
  } | null;
};

function mapSessionSummary(session: SessionRecord, ftpWatts: number | null) {
  const metrics = derivePlannerSessionMetrics(session.blocks, session.sport, { ftpWatts });

  return {
    id: session.id,
    title: session.title,
    sport: session.sport,
    date: session.date,
    status: getSessionDisplayStatus(session),
    durationSec: metrics.durationSec,
    actualDurationSec: session.activity?.durationSec ?? null,
    plannedTss: metrics.tss,
    actualTss: session.activity?.tss ?? null,
    tss: session.activity ? session.activity.tss : metrics.tss,
    completionPct: session.activity?.compliancePct ?? null,
    metricsSource: session.activity?.metricsSource ?? null,
    segments: session.activity?.segmentsJson
      ? parseActivitySegments(session.activity.segmentsJson)
      : metrics.segments,
  };
}

export function createCoachService({ db = prisma, now = () => new Date() }: CoachServiceDeps = {}) {
  return {
    async hasAthlete(coachId: number, athleteId: number) {
      const athlete = await db.user.findFirst({
        where: {
          id: athleteId,
          coachId,
          role: 'ATHLETE',
        },
        select: {
          id: true,
        },
      });

      return Boolean(athlete);
    },

    async getOverview(coachId: number) {
      const weekStart = startOfWeek(now(), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now(), { weekStartsOn: 1 });

      const coach = await db.user.findUnique({
        where: { id: coachId },
        include: {
          athletes: {
            include: {
              sessions: {
                where: {
                  date: {
                    gte: weekStart,
                    lte: weekEnd,
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
            },
            orderBy: { name: 'asc' },
          },
          coachRequests: {
            where: { status: 'PENDING' },
            include: {
              athlete: {
                select: { id: true, name: true, email: true },
              },
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!coach || coach.role !== 'COACH') {
        return null;
      }

      const athletes = coach.athletes.map((athlete) => {
        const ftpWatts = parsePerformanceProfileJson(athlete.performanceProfileJson).cycling.ftpWatts;
        const sessions = athlete.sessions
          .filter((s): s is typeof s & { date: Date } => s.date !== null)
          .map((session) =>
            mapSessionSummary({
            id: session.id,
            title: session.title,
            sport: session.sport,
            date: session.date,
            status: session.status,
            adjusted: session.adjusted,
            blocks: session.blocks,
            activity: session.activity
              ? {
                   durationSec: session.activity.durationSec,
                   tss: session.activity.tss,
                   compliancePct: session.activity.compliancePct,
                   segmentsJson: session.activity.segmentsJson,
                   metricsSource: session.activity.metricsSource,
                }
              : null,
          }, ftpWatts),
        );

        // Skipped sessions are excluded from compliance and planned counts.
        const countedSessions = sessions.filter((session) => session.status !== 'skipped');
        const completedCount = countedSessions.filter((session) => session.status === 'completed').length;
        const compliancePct =
          countedSessions.length > 0 ? Math.round((completedCount / countedSessions.length) * 100) : 0;
        const nextSession =
          countedSessions.find((session) => session.status === 'planned' || session.status === 'adjusted')
          ?? countedSessions.find((session) => session.status === 'missed')
          ?? countedSessions[0]
          ?? null;

        return {
          id: athlete.id,
          name: athlete.name ?? '',
          email: athlete.email,
          compliancePct,
          completedCount,
          plannedCount: countedSessions.length,
          flag:
            compliancePct >= 80
              ? { label: 'On track', tone: 'success' as const }
              : countedSessions.length === 0
                ? { label: 'No plan', tone: 'warning' as const }
                : { label: 'Needs attention', tone: 'warning' as const },
          nextSession: nextSession
            ? `${nextSession.title} · ${format(nextSession.date, 'EEE\u00A0d\u00A0MMM')}`
            : 'No session scheduled',
          sessions,
        };
      });

      return {
        id: coach.id,
        name: coach.name ?? '',
        athletes,
        pendingRequests: coach.coachRequests.map((request) => ({
          id: request.id,
          athlete: { ...request.athlete, name: request.athlete.name ?? '' },
          createdAt: request.createdAt,
        })),
      };
    },

    async getAthleteDetail(coachId: number, athleteId: number) {
      const athlete = await db.user.findFirst({
        where: {
          id: athleteId,
          coachId,
          role: 'ATHLETE',
        },
        select: {
          id: true,
          name: true,
          email: true,
          performanceProfileJson: true,
          plans: {
            orderBy: { endDate: 'desc' },
            take: 1,
          },
          coach: {
            select: {
              name: true,
            },
          },
        },
      });

      if (!athlete) {
        return null;
      }

      const weekStart = startOfWeek(now(), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now(), { weekStartsOn: 1 });

      const [weekSessions, recentSessions] = await Promise.all([
        db.session.findMany({
          where: {
            athleteId,
            date: {
              gte: weekStart,
              lte: weekEnd,
            },
          },
          include: {
            blocks: {
              orderBy: { sortOrder: 'asc' },
            },
            activity: true,
          },
          orderBy: { date: 'asc' },
        }),
        db.session.findMany({
          where: {
            athleteId,
            date: {
              lt: weekStart,
            },
          },
          include: {
            blocks: {
              orderBy: { sortOrder: 'asc' },
            },
            activity: true,
          },
          orderBy: { date: 'desc' },
          take: 8,
        }),
      ]);

      const ftpWatts = parsePerformanceProfileJson(athlete.performanceProfileJson).cycling.ftpWatts;
      const weekSummaries = weekSessions
        .filter((s): s is typeof s & { date: Date } => s.date !== null)
        .map((session) =>
          mapSessionSummary({
            id: session.id,
            title: session.title,
            sport: session.sport,
            date: session.date,
            status: session.status,
            adjusted: session.adjusted,
            blocks: session.blocks,
            activity: session.activity
              ? {
                  durationSec: session.activity.durationSec,
                  tss: session.activity.tss,
                  compliancePct: session.activity.compliancePct,
                  segmentsJson: session.activity.segmentsJson,
                  metricsSource: session.activity.metricsSource,
                }
              : null,
          }, ftpWatts),
        );
      const recentSummaries = recentSessions
        .filter((s): s is typeof s & { date: Date } => s.date !== null)
        .map((session) =>
          mapSessionSummary({
          id: session.id,
          title: session.title,
          sport: session.sport,
          date: session.date,
          status: session.status,
          adjusted: session.adjusted,
          blocks: session.blocks,
          activity: session.activity
            ? {
                durationSec: session.activity.durationSec,
                tss: session.activity.tss,
                compliancePct: session.activity.compliancePct,
                segmentsJson: session.activity.segmentsJson,
                metricsSource: session.activity.metricsSource,
              }
            : null,
        }, ftpWatts),
      );

      // Skipped sessions stay in the week list but are excluded from stats and compliance.
      const countedWeekSummaries = weekSummaries.filter((session) => session.status !== 'skipped');
      const completedCount = countedWeekSummaries.filter((session) => session.status === 'completed').length;
      const plannedDurationSec = countedWeekSummaries.reduce((total, session) => total + session.durationSec, 0);
      const completedDurationSec = countedWeekSummaries.reduce(
        (total, session) => total + (session.actualDurationSec ?? 0),
        0,
      );
      const plannedTss = countedWeekSummaries.reduce((total, session) => total + session.plannedTss, 0);
      const weekTss = countedWeekSummaries.reduce((total, session) => total + (session.actualTss ?? session.plannedTss), 0);
      const compliancePct =
        countedWeekSummaries.length > 0 ? Math.round((completedCount / countedWeekSummaries.length) * 100) : 0;
      const nextSession =
        countedWeekSummaries.find((session) => session.status === 'planned' || session.status === 'adjusted') ??
        countedWeekSummaries[0] ??
        null;

      return {
        athlete: {
          id: athlete.id,
          name: athlete.name ?? '',
          email: athlete.email,
          coachName: athlete.coach?.name ?? 'Unknown coach',
          activePlan: athlete.plans[0]
            ? {
                name: athlete.plans[0].name,
                goalRace: athlete.plans[0].goalRace,
                endDate: athlete.plans[0].endDate,
              }
            : null,
        },
        stats: {
          compliancePct,
          completedCount,
          plannedCount: countedWeekSummaries.length,
          plannedDurationSec,
          completedDurationSec,
          plannedTss,
          weekTss,
          nextSession: nextSession
            ? `${nextSession.title} · ${format(nextSession.date, 'EEE\u00A0d\u00A0MMM')}`
            : 'No session scheduled',
        },
        week: {
          start: weekStart,
          days: getWeekDays(weekStart).map((day) => ({
            ...day,
            sessions: weekSummaries.filter((session) => isSameDay(session.date, day.date)),
          })),
        },
        recentSessions: recentSummaries,
      };
    },
  };
}

export const coachService = createCoachService();

export async function getCoachOverview(coachId: number) {
  return coachService.getOverview(coachId);
}

export async function getCoachAthleteDetail(coachId: number, athleteId: number) {
  return coachService.getAthleteDetail(coachId, athleteId);
}
