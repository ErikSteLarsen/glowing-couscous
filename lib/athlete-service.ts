import { addDays, endOfWeek, format, isSameDay, startOfWeek } from 'date-fns';
import { readOverviewCardsFromPrefsJson } from './overview-preferences.ts';
import { prisma } from '@/lib/prisma';
import { deriveSessionMetrics } from './session-math.ts';
import { getTempoZoneMeta } from './tempo-blocks.ts';

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
    blocks: Array<{
      id: number;
      kind: string;
      zone: number;
      durationSec: number;
      reps: number | null;
      targetType: string | null;
      targetLow: number | null;
      targetHigh: number | null;
      note: string | null;
      sortOrder: number;
    }>;
    activity?: {
      tss: number;
    } | null;
  }) {
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

    const targetBlock = session.blocks.find(
      (block) =>
        block.targetType !== null && block.targetLow !== null && block.targetHigh !== null,
    );

    return {
      id: session.id,
      title: session.title,
      summary: session.summary,
      sport: session.sport,
      date: session.date,
      timeLabel: session.timeLabel ?? format(session.date, 'HH:mm'),
      status: (
        session.activity
          ? 'completed'
          : session.status === 'missed'
            ? 'missed'
            : session.adjusted
              ? 'adjusted'
              : 'planned'
      ) as 'planned' | 'completed' | 'adjusted' | 'missed',
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
      segments: metrics.segments,
      blockCount: session.blocks.length,
    };
  }

  async function listRequestsForAthlete(userId: number) {
    return db.coachRequest.findMany({
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
        name: athlete.name,
        email: athlete.email,
      };
    },

    async loadHomeDashboard(userId: number) {
      const athlete = await db.user.findUnique({
        where: { id: userId },
        include: {
          coach: {
            select: { id: true, name: true, email: true },
          },
          sessions: {
            where: {
              date: {
                gte: startOfWeek(new Date(), { weekStartsOn: 1 }),
                lte: endOfWeek(new Date(), { weekStartsOn: 1 }),
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
            take: 4,
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

      const sessions = athlete.sessions.map(mapSessionSummary);

      const today = new Date();
      const todaySessions = sessions.filter((session) => isSameDay(session.date, today));
      const nextDays = Array.from({ length: 4 }, (_, index) => {
        const day = addDays(today, index + 1);
        const daySessions = sessions.filter((session) => isSameDay(session.date, day));
        return {
          label: format(day, 'EEE').toUpperCase(),
          dateLabel: format(day, 'd'),
          session: daySessions[0] ?? null,
        };
      });

      const weekTotals = sessions.reduce(
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
          name: athlete.name,
        },
        coach: athlete.coach,
        overviewCards,
        todaySessions,
        nextDays,
        lastActivity: athlete.activities[0]
          ? {
              title: athlete.activities[0].session.title,
              completedAt: athlete.activities[0].completedAt,
              durationSec: athlete.activities[0].durationSec,
              tss: athlete.activities[0].tss,
            }
          : null,
        trend: athlete.activities
          .slice()
          .reverse()
          .map((activity) => ({
            label: format(activity.completedAt, 'd MMM'),
            tss: activity.tss,
          })),
        weekTotals,
        coachNote:
          athlete.coach && todaySessions[0]
            ? `Keep ${todaySessions[0].title.toLowerCase()} controlled and smooth.`
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

    async loadCalendarView(userId: number, weekRef: Date | string) {
      const athlete = await db.user.findUnique({
        where: { id: userId },
        include: {
          coach: {
            select: { id: true, name: true },
          },
          sessions: {
            where: {
              date: {
                gte: startOfWeek(new Date(weekRef), { weekStartsOn: 1 }),
                lte: endOfWeek(new Date(weekRef), { weekStartsOn: 1 }),
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

      const weekStart = startOfWeek(new Date(weekRef), { weekStartsOn: 1 });
      const sessions = athlete.sessions.map(mapSessionSummary);

      return {
        athlete: {
          id: athlete.id,
          name: athlete.name,
        },
        coachName: athlete.coach?.name ?? null,
        week: {
          start: weekStart,
          previousStart: addDays(weekStart, -7),
          nextStart: addDays(weekStart, 7),
        },
        days: Array.from({ length: 7 }, (_, index) => {
          const date = addDays(weekStart, index);
          return {
            label: format(date, 'EEE'),
            dateLabel: format(date, 'd'),
            isoDate: format(date, 'yyyy-MM-dd'),
            sessions: sessions.filter((session) => isSameDay(session.date, date)),
          };
        }),
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
          name: athlete.name,
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
          notes: activity.notes,
          segments: deriveSessionMetrics(
            activity.session.blocks.map((block) => ({
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
          ).segments,
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

      if (!session || session.athleteId !== userId) {
        return null;
      }

      const summary = mapSessionSummary(session);

      return {
        athlete: {
          id: session.athlete.id,
          name: session.athlete.name,
        },
        coachName: session.athlete.coach?.name ?? null,
        session: {
          ...summary,
          notes: session.activity?.notes ?? '',
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
