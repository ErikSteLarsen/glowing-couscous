import { endOfWeek, format, isSameDay, startOfWeek } from 'date-fns';
import { prisma } from './prisma.ts';
import { getWeekDays } from './week.ts';
import { deriveSessionMetrics } from './session-math.ts';
import { parseActivitySegments } from './activity-metrics.ts';

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
  blocks: Array<{
    id: number;
    kind: string;
    zone: number;
    durationSec: number;
    reps: number | null;
    targetType: string | null;
    targetLow: number | null;
    targetHigh: number | null;
  }>;
  activity: {
    durationSec: number;
    tss: number;
    compliancePct: number | null;
    segmentsJson: string | null;
    metricsSource: string;
  } | null;
};

function mapSessionSummary(session: SessionRecord) {
  const metrics = deriveSessionMetrics(
    session.blocks.map((block) => ({
      kind: block.kind as 'warmup' | 'work' | 'recovery' | 'cooldown',
      zone: block.zone as 1 | 2 | 3 | 4 | 5,
      durationSec: block.durationSec,
      reps: block.reps,
      target:
        block.targetType && block.targetLow !== null && block.targetHigh !== null
          ? {
              type: block.targetType as 'power' | 'pace' | 'hr',
              low: block.targetLow,
              high: block.targetHigh,
            }
          : null,
    })),
  );

  return {
    id: session.id,
    title: session.title,
    sport: session.sport,
    date: session.date,
    status: session.activity
      ? ('completed' as const)
      : session.status === 'missed'
        ? ('missed' as const)
        : session.adjusted
          ? ('adjusted' as const)
          : ('planned' as const),
    durationSec: metrics.durationSec,
    actualDurationSec: session.activity?.durationSec ?? null,
    plannedTss: metrics.tss,
    actualTss: session.activity?.tss ?? null,
    tss: session.activity?.tss ?? metrics.tss,
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
          }),
        );

        const completedCount = sessions.filter((session) => session.status === 'completed').length;
        const compliancePct =
          sessions.length > 0 ? Math.round((completedCount / sessions.length) * 100) : 0;
        const nextSession = sessions.find((session) => session.status !== 'completed') ?? sessions[0] ?? null;

        return {
          id: athlete.id,
          name: athlete.name ?? '',
          email: athlete.email,
          compliancePct,
          completedCount,
          plannedCount: sessions.length,
          flag:
            compliancePct >= 80
              ? { label: 'On track', tone: 'success' as const }
              : sessions.length === 0
                ? { label: 'No plan', tone: 'warning' as const }
                : { label: 'Needs attention', tone: 'warning' as const },
          nextSession: nextSession
            ? `${nextSession.title} · ${format(nextSession.date, 'EEE d MMM')}`
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
          }),
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
        }),
      );

      const completedCount = weekSummaries.filter((session) => session.status === 'completed').length;
      const plannedDurationSec = weekSummaries.reduce((total, session) => total + session.durationSec, 0);
      const completedDurationSec = weekSummaries.reduce(
        (total, session) => total + (session.actualDurationSec ?? 0),
        0,
      );
      const plannedTss = weekSummaries.reduce((total, session) => total + session.plannedTss, 0);
      const weekTss = weekSummaries.reduce((total, session) => total + (session.actualTss ?? session.plannedTss), 0);
      const compliancePct =
        weekSummaries.length > 0 ? Math.round((completedCount / weekSummaries.length) * 100) : 0;
      const nextSession =
        weekSummaries.find((session) => session.status === 'planned' || session.status === 'adjusted') ??
        weekSummaries[0] ??
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
          plannedCount: weekSummaries.length,
          plannedDurationSec,
          completedDurationSec,
          plannedTss,
          weekTss,
          nextSession: nextSession
            ? `${nextSession.title} · ${format(nextSession.date, 'EEE d MMM')}`
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
