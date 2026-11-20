import { addDays, addMonths, differenceInCalendarDays, endOfDay, endOfMonth, endOfWeek, format, isSameDay, startOfDay, startOfMonth, startOfWeek } from 'date-fns';
import { Prisma } from '@prisma/client';
import { readOverviewCardsFromPrefsJson } from './overview-preferences.ts';
import { prisma } from './prisma.ts';
import { derivePlannerSessionMetrics } from './planner-source-metrics.ts';
import { getTempoZoneMeta } from './tempo-blocks.ts';
import { parseActivitySegments, parseActivityTelemetry } from './activity-metrics.ts';
import { bucketActivityMetric, type ActivityIntensityTimeline } from './activity-series.ts';
import { parsePerformanceProfileJson } from './performance-profile.ts';
import { zoneForHeartRateBpm } from './profile-training-zones.ts';
import { formatResolvedWorkoutTarget, formatWorkoutTarget } from './workout-target-resolution.ts';
import { normalizeWorkoutTarget, type WorkoutTarget, type WorkoutTargetReference } from './workout-targets.ts';
import { homeActivityLoadAvailable, homeActivityReadout, summarizeHomeActivities } from './home-summary.ts';
import { createSessionEditorDraftFromPersisted } from './session-editor.ts';
import { plannedMetrics } from './training-load-service.ts';
import { addDayKeys, classifyCompliance, fromDayKey, summarizeWeeks, toDayKey, type WeekSession } from './training-load.ts';
import { endOfDayInZone, startOfDayInZone, todayInZone } from './user-time.ts';
import { parseCalendarDay } from './calendar-navigation.ts';
import { ACTIVITY_PAGE_SIZE, parseActivityFilters, type ActivityFilters } from './activity-navigation.ts';
import { getSessionDisplayStatus, getSessionStatusAction, SKIPPED_SESSION_STATUS } from './athlete-session-status-service.ts';

type AthleteServiceDeps = {
  db?: typeof prisma;
  now?: () => Date;
};

function buildActivityIntensityTimeline(
  activity: { metricsSource?: string; durationSec?: number; telemetryJson?: string | null },
  maxHeartRateBpm: number | null,
): ActivityIntensityTimeline | null {
  if (!['file-import', 'strava-import'].includes(activity.metricsSource ?? '') || !activity.telemetryJson) {
    return null;
  }

  const telemetry = parseActivityTelemetry(activity.telemetryJson);
  if (!telemetry) return null;

  const chart = bucketActivityMetric(telemetry.points, 'heartRate', {
    durationSec: activity.durationSec,
    maxBars: 48,
  });
  if (chart.buckets.length === 0) return null;

  const count = Math.ceil(Math.max(activity.durationSec ?? 0, chart.buckets.at(-1)?.to ?? 0) / chart.interval);
  const buckets = new Map(chart.buckets.map((bucket) => [bucket.index, bucket] as const));
  const bins = Array.from({ length: count }, (_, index) => {
    const bucket = buckets.get(index);
    return {
      index,
      from: index * chart.interval,
      to: (index + 1) * chart.interval,
      averageBpm: bucket ? Math.round(bucket.average) : null,
      minBpm: bucket ? Math.round(bucket.min) : null,
      maxBpm: bucket ? Math.round(bucket.max) : null,
      heightPercent: bucket?.heightPercent ?? null,
      zone: bucket ? zoneForHeartRateBpm(bucket.average, maxHeartRateBpm) : null,
    };
  });

  return {
    intervalSec: chart.interval,
    averageBpm: Math.round(chart.average),
    minBpm: Math.round(chart.min),
    maxBpm: Math.round(chart.max),
    maxHeartRateBpm,
    bins,
  };
}

const HOME_OVERDUE_SESSION_LIMIT = 3;

/** Sessions the athlete placed themselves; coach-owned work keeps its coach's schedule. */
export function isSelfPlanned(session: { coachOwnerId?: number | null; assignedById?: number | null; trainingPlanId?: number | null }) {
  return !session.coachOwnerId && !session.assignedById && !session.trainingPlanId;
}

function selectPrimaryRequest<T extends { status: string }>(requests: T[]) {
  return requests.find((request) => request.status === 'PENDING') ?? requests[0] ?? null;
}

function isOverdueSession(session: {
  date: Date | null;
  status: string;
  coachOwnerId?: number | null;
  assignedById?: number | null;
  trainingPlanId?: number | null;
  activity?: unknown;
}, today: Date) {
  return Boolean(
    session.date &&
      !session.activity &&
      session.status !== 'completed' &&
      session.status !== SKIPPED_SESSION_STATUS &&
      isSelfPlanned(session) &&
      toDayKey(session.date) < toDayKey(today),
  );
}

function dateOnlyFromKey(day: string) { return new Date(`${day}T12:00:00.000Z`); }
function utcDayKey(date: Date) { return date.toISOString().slice(0, 10); }
function calendarDayDistance(from: string, to: string) {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000);
}

export function createAthleteService({ db = prisma, now = () => new Date() }: AthleteServiceDeps = {}) {
  /** The user's calendar day; without a zone, the server clock's local day. */
  const currentDayKey = (timeZone?: string) => (timeZone ? todayInZone(timeZone, now()) : toDayKey(now()));

  function mapSessionSummary(session: {
    id: number;
    title: string;
    summary: string | null;
    sport: string;
    date: Date;
    timeLabel: string | null;
    status: string;
    adjusted: boolean;
    coachOwnerId?: number | null;
    assignedById?: number | null;
    trainingPlanId?: number | null;
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
      tss: number | null;
      durationSec?: number;
      distanceMeters?: number | null;
      rpe?: number | null;
      notes?: string | null;
      compliancePct?: number | null;
      segmentsJson?: string | null;
      metricsSource?: string;
      telemetryJson?: string | null;
    } | null;
  }, options: { includeIntensityTimeline?: boolean; heartRateMaxBpm?: number | null; ftpWatts?: number | null; today?: Date } = {}) {
    const today = options.today ?? now();
    const metrics = derivePlannerSessionMetrics(session.blocks, session.sport, {
      ftpWatts: options.ftpWatts,
      loadBasis: session.activity ? 'zones' : 'planned',
    });

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

    const status = getSessionDisplayStatus(session);
    const planned = plannedMetrics(
      session,
      { completed: status === 'completed', metricsSource: session.activity?.metricsSource },
      options.ftpWatts,
    );
    const isImportedActivity = ['file-import', 'strava-import'].includes(session.activity?.metricsSource ?? '');

    const intensityTimeline = options.includeIntensityTimeline && session.activity
      ? buildActivityIntensityTimeline(session.activity, options.heartRateMaxBpm ?? null)
      : null;
    const todayKey = toDayKey(today);
    const isOverdue = isOverdueSession(session, today);
    const compliance = classifyCompliance({
      status,
      day: toDayKey(session.date),
      today: todayKey,
      plannedDurationSec: planned.durationSec,
      plannedTss: planned.tss,
      actualDurationSec: session.activity?.durationSec ?? null,
      actualTss: session.activity?.tss ?? null,
      compliancePct: session.activity?.compliancePct ?? null,
      metricsSource: session.activity?.metricsSource ?? null,
    });

    return {
      id: session.id,
      title: session.title,
      summary: session.summary,
      sport: session.sport,
      date: session.date,
      timeLabel: session.timeLabel,
      status,
      isOverdue,
      compliance,
      plannedDurationSec: planned.durationSec,
      plannedTss: planned.tss,
      targetLabel: target ? formatWorkoutTarget(target, session.sport) : null,
      durationSec: metrics.durationSec,
      tss: session.activity?.tss ?? metrics.tss,
      loadAvailable: !(isImportedActivity && session.activity?.tss === 0),
      recordedDurationSec: isImportedActivity
        ? session.activity?.durationSec ?? null
        : null,
      activityDurationSec: session.activity?.durationSec ?? null,
      distanceMeters: session.activity?.distanceMeters ?? null,
      activityDistanceMeters: session.activity?.distanceMeters ?? null,
      activityRpe: session.activity?.rpe ?? null,
      activityTss: session.activity?.tss ?? null,
      activityNotes: session.activity?.notes ?? null,
      segments: session.activity?.segmentsJson
        ? parseActivitySegments(session.activity.segmentsJson)
        : metrics.segments,
      intensityTimeline,
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
        performanceProfileJson: true,
      },
    });
  }

  return {
    async findProfileByUserId(userId: number) {
      const athlete = await loadAthleteIdentity(userId);
      if (!athlete) {
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

    async loadHomeDashboard(userId: number, { timeZone }: { timeZone?: string } = {}) {
      const todayKey = currentDayKey(timeZone);
      const today = fromDayKey(todayKey);
      const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
      const currentWeekEnd = endOfWeek(today, { weekStartsOn: 1 });
      // Late in the week, the next few days reach into next week.
      const lookaheadEnd = endOfDay(addDays(today, 4));
      const athlete = await db.user.findUnique({
        where: { id: userId },
        include: {
          coach: {
            select: { id: true, name: true, email: true },
          },
          sessions: {
            where: {
              date: {
                gte: currentWeekStart,
                lte: lookaheadEnd > currentWeekEnd ? lookaheadEnd : currentWeekEnd,
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
            orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
            take: 4,
            include: {
              session: true,
            },
          },
          events: {
            where: { eventDate: { gte: dateOnlyFromKey(todayKey) } },
            orderBy: [{ eventDate: 'asc' }, { id: 'asc' }],
            take: 1,
          },
        },
      });

      if (!athlete) {
        return null;
      }

      const ftpWatts = parsePerformanceProfileJson(athlete.performanceProfileJson).cycling.ftpWatts;
      const overdueRecords = await db.session.findMany({
        where: {
          athleteId: userId,
          date: { lt: startOfDay(today) },
          status: { notIn: ['completed', SKIPPED_SESSION_STATUS] },
          coachOwnerId: null,
          assignedById: null,
          trainingPlanId: null,
          activity: { is: null },
        },
        include: {
          blocks: { orderBy: { sortOrder: 'asc' } },
          activity: true,
        },
        orderBy: [{ date: 'desc' }, { id: 'desc' }],
        take: HOME_OVERDUE_SESSION_LIMIT,
      });
      const overdue = overdueRecords
        .filter((session): session is typeof session & { date: Date } => session.date !== null)
        .map((session) => mapSessionSummary(session, { today, ftpWatts }))
        .filter((session) => session.isOverdue);

      const overviewCards = readOverviewCardsFromPrefsJson(athlete.prefsJson);

      const completedActivities = await db.activity.findMany({
        where: {
          athleteId: userId,
          // Completion times are instants, so the week is bounded in the user's zone.
          completedAt: timeZone
            ? { gte: startOfDayInZone(format(currentWeekStart, 'yyyy-MM-dd'), timeZone), lte: endOfDayInZone(format(currentWeekEnd, 'yyyy-MM-dd'), timeZone) }
            : { gte: currentWeekStart, lte: currentWeekEnd },
        },
        select: { id: true, sessionId: true, completedAt: true, durationSec: true, tss: true, metricsSource: true, zoneDistributionJson: true, session: { select: { title: true } } },
        orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
      });

      const datedSessions = athlete.sessions.filter((s): s is typeof s & { date: Date } => s.date !== null);
      const sessions = datedSessions.map((session) => ({
        ...mapSessionSummary(session, { today, ftpWatts }),
        ...(session.activity ? { durationSec: session.activity.durationSec, loadAvailable: homeActivityLoadAvailable(session.activity) } : {}),
      }));
      const todaySessions = sessions.filter((session) => isSameDay(session.date, today));
      const nextSession = todaySessions.find((session) => session.status !== 'completed' && session.status !== SKIPPED_SESSION_STATUS);
      const todayCoachNote = datedSessions.find((session) => session.id === nextSession?.id);
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

      // Scheduled structure stays independent from saved outcome values and
      // standalone imports, whose sessions exist only to host their outcomes.
      // Skipped sessions stay on the week wall but add no planned load.
      const scheduledSessions = athlete.sessions.filter((session) => session.date !== null && session.source !== 'activity-import' && session.status !== SKIPPED_SESSION_STATUS);
      const scheduledTotals = scheduledSessions.reduce(
        (accumulator, session) => {
          const planned = mapSessionSummary({ ...session, activity: null, date: session.date! }, { today, ftpWatts });
          accumulator.durationSec += planned.durationSec;
          accumulator.tss += planned.tss;
          return accumulator;
        },
        { count: scheduledSessions.length, durationSec: 0, tss: 0, loadUnavailableCount: 0 },
      );
      // Skipped sessions stay on the week wall but add no planned load.
      const weekTotals = sessions.filter((session) => session.date <= currentWeekEnd && session.status !== SKIPPED_SESSION_STATUS).reduce(
        (accumulator, session) => {
          accumulator.durationSec += session.durationSec;
          if (session.tss === null) accumulator.unknownLoad += 1;
          else accumulator.tss += session.tss;
          return accumulator;
        },
        { durationSec: 0, tss: 0, unknownLoad: 0 },
      );
      const upcomingEvents = athlete.events ?? [];

      return {
        athlete: {
          id: athlete.id,
          name: athlete.name ?? '',
        },
        coach: athlete.coach
          ? { ...athlete.coach, name: athlete.coach.name ?? '' }
          : null,
        overviewCards,
        todayKey,
        nextEvent: upcomingEvents[0] ? {
          id: upcomingEvents[0].id,
          title: upcomingEvents[0].title,
          sport: upcomingEvents[0].sport,
          eventDate: utcDayKey(upcomingEvents[0].eventDate),
          daysUntil: calendarDayDistance(todayKey, utcDayKey(upcomingEvents[0].eventDate)),
          targetFinishSec: upcomingEvents[0].targetFinishSec,
        } : null,
        overdue,
        todaySessions,
        weekDays,
        nextDays,
        dateLabels: { today: format(today, 'EEEE, d MMMM'), shortToday: format(today, 'd MMM'), weekNumber: format(today, 'II'), weekRange: `${format(currentWeekStart, 'd MMM')} – ${format(currentWeekEnd, 'd MMM')}` },
        lastActivity: athlete.activities[0]
          ? {
              ...homeActivityReadout(athlete.activities[0]),
              sport: athlete.activities[0].session.sport,
              rpe: athlete.activities[0].rpe,
              notes: athlete.activities[0].notes,
            }
          : null,
        trend: athlete.activities
          .slice()
          .reverse()
          .map(homeActivityReadout),
        scheduledTotals,
        completedTotals: summarizeHomeActivities(completedActivities),
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

    async loadCalendarView(userId: number, dateRef: Date | string, view: 'week' | 'month' = 'week', { timeZone }: { timeZone?: string } = {}) {
      const today = fromDayKey(currentDayKey(timeZone));
      // A yyyy-MM-dd reference is a local calendar day, never a UTC instant.
      const dayRef = parseCalendarDay(dateRef);
      const parsedReference = dayRef ? fromDayKey(dayRef) : new Date(dateRef);
      const referenceDate = Number.isNaN(parsedReference.getTime()) ? today : parsedReference;
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
              activity: {
                select: {
                  tss: true,
                  compliancePct: true,
                  segmentsJson: true,
                  metricsSource: true,
                  durationSec: true,
                  distanceMeters: true,
                  telemetryJson: resolvedView === 'week',
                },
              },
            },
            orderBy: [{ date: 'asc' }, { id: 'asc' }],
          },
          events: {
            where: {
              eventDate: { gte: dateOnlyFromKey(format(queryStart, 'yyyy-MM-dd')), lte: dateOnlyFromKey(format(queryEnd, 'yyyy-MM-dd')) },
            },
            orderBy: [{ eventDate: 'asc' }, { id: 'asc' }],
          },
        },
      });

      if (!athlete) {
        return null;
      }

      const profile = parsePerformanceProfileJson(athlete.performanceProfileJson);
      const events = athlete.events ?? [];
      const eventsByDay = new Map<string, typeof events>();
      for (const event of events) {
        const key = utcDayKey(event.eventDate);
        eventsByDay.set(key, [...(eventsByDay.get(key) ?? []), event]);
      }

      const sessions = athlete.sessions
        .filter((s): s is typeof s & { date: Date } => s.date !== null)
        .map((session) => ({
          ...mapSessionSummary(session, {
            today,
            includeIntensityTimeline: resolvedView === 'week',
            heartRateMaxBpm: profile.heartRateMaxBpm,
            ftpWatts: profile.cycling.ftpWatts,
          }),
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
        isToday: isSameDay(date, today),
        sessions: sessions.filter((session) => isSameDay(session.date, date)),
        events: eventsByDay.get(format(date, 'yyyy-MM-dd')) ?? [],
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
      // PostgreSQL: camelCase Prisma columns must stay quoted; the name filter is a case-insensitive substring match.
      const scope = Prisma.sql`
        FROM "Activity" a JOIN "Session" s ON s."id" = a."sessionId"
        WHERE a."athleteId" = ${userId} AND s."athleteId" = ${userId}
          AND (${filters.sport}::text IS NULL OR s."sport" = ${filters.sport}::text)
          AND strpos(lower(s."title"), lower(${filters.query}::text)) > 0
      `;
      return db.$transaction(async (tx) => {
        const [summary] = await tx.$queryRaw<Array<{ count: bigint; durationSec: bigint; tss: bigint; unknownLoad: bigint }>>(Prisma.sql`
          SELECT COUNT(*) AS count, COALESCE(SUM(a."durationSec"), 0) AS "durationSec",
            COALESCE(SUM(a."tss"), 0) AS tss, COALESCE(SUM(CASE WHEN a."tss" IS NULL THEN 1 ELSE 0 END), 0) AS "unknownLoad" ${scope}
        `);
        const count = Number(summary.count);
        const totalPages = Math.max(1, Math.ceil(count / ACTIVITY_PAGE_SIZE));
        const page = Math.min(filters.page, totalPages);
        const matches = await tx.$queryRaw<Array<{ id: number }>>(Prisma.sql`
          SELECT a."id" ${scope} ORDER BY a."completedAt" DESC, a."id" DESC
          LIMIT ${ACTIVITY_PAGE_SIZE} OFFSET ${(page - 1) * ACTIVITY_PAGE_SIZE}
        `);
        const activities = await tx.activity.findMany({
          where: { id: { in: matches.map((match) => match.id) }, athleteId: userId },
          orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
          include: { session: { select: { id: true, title: true, sport: true, coachBaselineJson: true, blocks: { orderBy: { sortOrder: 'asc' } } } } },
        });
        return {
          athlete: {
            id: athlete.id,
            name: athlete.name ?? '',
          },
          count,
          page,
          totalPages,
          totals: { durationSec: Number(summary.durationSec), tss: Number(summary.tss), unknownLoad: Number(summary.unknownLoad) },
          activities: activities.map((activity) => ({
            id: activity.id,
            sessionId: activity.sessionId,
            title: activity.importTitle || activity.session.title,
            plannedTitle: activity.importedSessionStatus === null ? null : activity.session.title,
            sport: activity.session.sport,
            plannedDurationSec: plannedMetrics(
              activity.session,
              { completed: true, metricsSource: activity.metricsSource },
            ).durationSec,
            completedAt: activity.completedAt,
            startedAt: activity.startedAt,
            sourceTimezoneOffsetMinutes: activity.sourceTimezoneOffsetMinutes,
            durationSec: activity.durationSec,
            distanceMeters: activity.distanceMeters,
            tss: activity.tss,
            loadAvailable: !(['file-import', 'strava-import'].includes(activity.metricsSource) && activity.tss === 0),
            compliancePct: activity.compliancePct,
            metricsSource: activity.metricsSource,
            notes: activity.notes,
            segments: parseActivitySegments(activity.segmentsJson),
          })),
        };
      });
    },

    async loadSessionDetail(userId: number, sessionId: number, { timeZone }: { timeZone?: string } = {}) {
      if (!Number.isInteger(sessionId) || sessionId <= 0) {
        return null;
      }

      const athlete = await loadAthleteIdentity(userId);
      if (!athlete) {
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
          assignments: {
            where: { athleteId: userId },
            take: 1,
            include: {
              sourceSession: {
                select: {
                  id: true,
                  title: true,
                  athleteId: true,
                  coachOwnerId: true,
                  date: true,
                  planId: true,
                  trainingPlanId: true,
                  activity: { select: { id: true } },
                },
              },
            },
          },
        },
      });

      if (!session || session.athleteId !== userId || !session.date || !session.athlete) {
        return null;
      }

      const profile = parsePerformanceProfileJson(athlete.performanceProfileJson);
      const summary = mapSessionSummary({ ...session, date: session.date }, { ftpWatts: profile.cycling.ftpWatts, today: fromDayKey(currentDayKey(timeZone)) });
      const sourceWorkout = session.assignments[0]?.sourceSession;
      const editableSourceWorkout = sourceWorkout
        && sourceWorkout.athleteId === userId
        && sourceWorkout.coachOwnerId === null
        && sourceWorkout.date === null
        && sourceWorkout.planId === null
        && sourceWorkout.trainingPlanId === null
        && sourceWorkout.activity === null
        ? { id: sourceWorkout.id, title: sourceWorkout.title }
        : null;
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
          source: session.source,
          canDelete: isSelfPlanned(session) && !session.activity && session.status !== 'completed',
          statusAction: getSessionStatusAction(session, userId),
          importedActivityId: session.activity && ['file-import', 'strava-import'].includes(session.activity.metricsSource)
            ? session.activity.id
            : null,
          notes: session.activity?.notes ?? session.athleteNotes ?? '',
          activityId: session.activity?.id ?? null,
          activityUpdatedAt: session.activity?.updatedAt ?? null,
          activityStartedAt: session.activity?.startedAt ?? null,
          activityCompletedAt: session.activity?.completedAt ?? null,
          activityTimezoneOffsetMinutes: session.activity?.sourceTimezoneOffsetMinutes ?? null,
          sourceWorkout: editableSourceWorkout,
          editor,
          blocks: session.blocks.map((block) => {
            const meta = getTempoZoneMeta(block.zone as 1 | 2 | 3 | 4 | 5);
            const target: WorkoutTarget | null = block.targetType && block.targetLow !== null && block.targetHigh !== null
              ? { metric: block.targetType as WorkoutTarget['metric'], mode: block.targetMode === 'relative' ? 'relative' : 'absolute', reference: block.targetReference as WorkoutTargetReference | null, low: Number(block.targetLowDecimal ?? block.targetLow), high: Number(block.targetHighDecimal ?? block.targetHigh) }
              : null;
            return {
              id: block.id,
              label: block.kind === 'pause' ? 'Pause' : `${meta.label} ${meta.name}`,
              kind: block.kind,
              zone: block.zone,
              durationSec: block.durationSec,
              reps: block.reps,
              targetLabel: target
                ? (target.mode === 'absolute' ? formatWorkoutTarget(target, session.sport) : formatResolvedWorkoutTarget(target, profile, session.sport) ?? formatWorkoutTarget(target, session.sport))
                : null,
              targetBasis: target?.mode === 'relative' ? formatWorkoutTarget(target, session.sport) : null,
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
