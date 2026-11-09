import { prisma } from './prisma.ts';
import { deriveSessionMetrics } from './session-math.ts';
import { deriveSessionEditorMetrics } from './session-editor.ts';
import { deserializeSessionSnapshot } from './session-snapshot-service.ts';
import type { TempoBlockKind, TempoZone } from './tempo-blocks.ts';
import {
  FITNESS_DAYS,
  addDayKeys,
  buildLoadSeries,
  classifyCompliance,
  classifyForm,
  rampRate,
  summarizeWeeks,
  toDayKey,
  weekStartOf,
  type ComplianceState,
  type DayKey,
  type FormZone,
  type LoadPoint,
  type WeekSession,
  type WeekSummary,
} from './training-load.ts';

type TrainingLoadDeps = { db?: typeof prisma };

type MetricBlock = { kind: string; zone: number; durationSec: number; reps: number | null; skipped: boolean };

export type SessionLoad = {
  sessionId: number;
  /** Planned calendar day. */
  day: DayKey;
  /** Day the work was actually done, when completed. */
  actualDay: DayKey | null;
  sport: string;
  title: string;
  status: 'planned' | 'completed' | 'adjusted' | 'missed';
  plannedDurationSec: number;
  plannedTss: number;
  actualDurationSec: number | null;
  actualTss: number | null;
  compliance: ComplianceState;
};

export type TrainingLoadOverview = {
  today: DayKey;
  series: LoadPoint[];
  current: {
    fitness: number;
    fatigue: number;
    form: number;
    formZone: FormZone;
    rampRate: number | null;
    /** Fitness four weeks ago, to show direction without a chart. */
    fitness28DaysAgo: number | null;
  };
  weeks: WeekSummary[];
  sessions: SessionLoad[];
};

function metricsForBlocks(blocks: MetricBlock[]) {
  return deriveSessionMetrics(
    blocks
      .filter((block) => !block.skipped)
      .map((block) => ({
        kind: block.kind as TempoBlockKind,
        zone: block.zone as TempoZone,
        durationSec: block.durationSec,
        reps: block.reps,
        target: null,
      })),
  );
}

function sessionStatus(session: { status: string; adjusted: boolean; activity: unknown }): SessionLoad['status'] {
  if (session.activity) return 'completed';
  if (session.status === 'missed') return 'missed';
  return session.adjusted ? 'adjusted' : 'planned';
}

const NO_PLAN = { durationSec: 0, tss: 0 };

/**
 * What was planned: the saved baseline once a session is completed, otherwise
 * its current blocks. Completed blocks hold the actual work, so without a
 * baseline there is no plan to compare against.
 */
function plannedMetrics(session: { coachBaselineJson: string | null; blocks: MetricBlock[] }, completed: boolean) {
  if (!completed) return metricsForBlocks(session.blocks);
  const baseline = deserializeSessionSnapshot('planned', session.coachBaselineJson);
  return baseline ? deriveSessionEditorMetrics(baseline) : NO_PLAN;
}

export function createTrainingLoadService({ db = prisma }: TrainingLoadDeps = {}) {
  return {
    /**
     * Reads the athlete's own sessions around today and derives load, form,
     * weekly volume, and per-session compliance at read time.
     */
    async loadOverview(
      athleteId: number,
      { now = new Date(), historyDays = 84, projectDays = 14 }: { now?: Date; historyDays?: number; projectDays?: number } = {},
    ): Promise<TrainingLoadOverview> {
      const today = toDayKey(now);
      const from = addDayKeys(today, -historyDays);
      const to = addDayKeys(today, projectDays);
      // Three fitness time constants of history lets the averages settle before the visible range.
      const warmupStart = addDayKeys(from, -FITNESS_DAYS * 3);

      const records = await db.session.findMany({
        where: {
          athleteId,
          date: { gte: new Date(`${warmupStart}T00:00:00`), lte: new Date(`${to}T23:59:59.999`) },
        },
        select: {
          id: true,
          date: true,
          sport: true,
          title: true,
          status: true,
          adjusted: true,
          coachBaselineJson: true,
          blocks: { select: { kind: true, zone: true, durationSec: true, reps: true, skipped: true }, orderBy: { sortOrder: 'asc' } },
          activity: { select: { completedAt: true, durationSec: true, tss: true, compliancePct: true } },
        },
        orderBy: [{ date: 'asc' }, { id: 'asc' }],
      });

      const sessions: SessionLoad[] = records.flatMap((record) => {
        if (!record.date) return [];
        const status = sessionStatus(record);
        const planned = plannedMetrics(record, status === 'completed');
        const day = toDayKey(record.date);

        return [
          {
            sessionId: record.id,
            day,
            actualDay: record.activity ? toDayKey(record.activity.completedAt) : null,
            sport: record.sport,
            title: record.title,
            status,
            plannedDurationSec: planned.durationSec,
            plannedTss: planned.tss,
            actualDurationSec: record.activity?.durationSec ?? null,
            actualTss: record.activity?.tss ?? null,
            compliance: classifyCompliance({
              status,
              day,
              today,
              plannedDurationSec: planned.durationSec,
              plannedTss: planned.tss,
              actualDurationSec: record.activity?.durationSec,
              actualTss: record.activity?.tss,
              compliancePct: record.activity?.compliancePct,
            }),
          },
        ];
      });

      const series = buildLoadSeries({
        actual: sessions.flatMap((session) =>
          session.actualTss === null ? [] : [{ day: session.actualDay ?? session.day, tss: session.actualTss }],
        ),
        planned: sessions.flatMap((session) =>
          session.status === 'completed' || session.status === 'missed' ? [] : [{ day: session.day, tss: session.plannedTss }],
        ),
        from,
        to,
        today,
        warmupStart,
      });

      const todayIndex = series.findIndex((point) => point.day === today);
      const todayPoint = series[todayIndex] ?? series[series.length - 1];
      const monthAgo = todayIndex >= 28 ? series[todayIndex - 28] : null;

      const currentWeek = weekStartOf(today);
      const weekStarts = Array.from({ length: Math.ceil(historyDays / 7) + 2 }, (_, index) =>
        addDayKeys(currentWeek, (index - Math.ceil(historyDays / 7)) * 7),
      );
      const weekSessions: WeekSession[] = sessions.filter((session) => session.day >= weekStarts[0]);

      return {
        today,
        series,
        current: {
          fitness: todayPoint?.fitness ?? 0,
          fatigue: todayPoint?.fatigue ?? 0,
          form: todayPoint?.form ?? 0,
          formZone: classifyForm(todayPoint?.form ?? 0),
          rampRate: rampRate(series, today),
          fitness28DaysAgo: monthAgo?.fitness ?? null,
        },
        weeks: summarizeWeeks(weekSessions, weekStarts),
        sessions: sessions.filter((session) => session.day >= from),
      };
    },
  };
}

export const trainingLoadService = createTrainingLoadService();
