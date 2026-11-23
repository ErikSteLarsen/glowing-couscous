/**
 * Training load: fitness, fatigue, form, ramp rate, and planned-vs-actual compliance.
 *
 * Fitness (CTL) and fatigue (ATL) are exponentially weighted averages of daily
 * training stress with 42- and 7-day time constants, updated the way most
 * endurance tools do: today = yesterday + (stress - yesterday) / days.
 * Form (TSB) is yesterday's fitness minus yesterday's fatigue, so a hard session
 * today shows up in tomorrow's form, which is how it feels.
 *
 * Everything here is pure and works on local calendar day keys (yyyy-MM-dd).
 * Day keys are derived in the server's time zone, which assumes the server and
 * the athlete share one; there is no per-athlete time zone yet.
 */

export const FITNESS_DAYS = 42;
export const FATIGUE_DAYS = 7;

export type DayKey = string;

export type LoadPoint = {
  day: DayKey;
  /** Stress that actually happened on this day. */
  actualTss: number;
  /** False when one or more activities on this day have no defensible load value. */
  actualLoadKnown: boolean;
  /** Stress planned for this day that has not been completed yet. */
  plannedTss: number;
  fitness: number;
  fatigue: number;
  form: number;
  /** True for days after today, where values assume the plan is followed. */
  projected: boolean;
};

export type LoadInput = {
  day: DayKey;
  tss: number;
};

/** Bar value remains the known actual load on a partial day; unknown load stays absent. */
export function getStressBarTss(point: Pick<LoadPoint, 'actualTss' | 'plannedTss' | 'actualLoadKnown'>) {
  if (point.actualTss > 0) return point.actualTss;
  return point.plannedTss;
}

const DAY_MS = 86_400_000;

export function toDayKey(date: Date): DayKey {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toDayKeyAtOffset(date: Date, offsetMinutes: number): DayKey {
  const sourceLocalTime = new Date(date.getTime() + offsetMinutes * 60_000);
  const year = sourceLocalTime.getUTCFullYear();
  const month = String(sourceLocalTime.getUTCMonth() + 1).padStart(2, '0');
  const day = String(sourceLocalTime.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parses a day key as a local calendar date at midnight. */
export function fromDayKey(day: DayKey): Date {
  const [year, month, date] = day.split('-').map(Number);
  return new Date(year, month - 1, date);
}

export function addDayKeys(day: DayKey, amount: number): DayKey {
  const date = fromDayKey(day);
  date.setDate(date.getDate() + amount);
  return toDayKey(date);
}

export function daysBetween(from: DayKey, to: DayKey): number {
  return Math.round((fromDayKey(to).getTime() - fromDayKey(from).getTime()) / DAY_MS);
}

function sumByDay(entries: LoadInput[]) {
  const totals = new Map<DayKey, number>();
  for (const entry of entries) {
    if (!Number.isFinite(entry.tss) || entry.tss <= 0) continue;
    totals.set(entry.day, (totals.get(entry.day) ?? 0) + entry.tss);
  }
  return totals;
}

const round1 = (value: number) => Math.round(value * 10) / 10;

/**
 * Builds the daily fitness/fatigue/form series.
 *
 * `warmupStart` lets the averages settle on earlier history before the visible
 * range starts at `from`. Days after `today` use planned stress only.
 */
export function buildLoadSeries({
  actual,
  planned,
  from,
  to,
  today,
  warmupStart = from,
  unknownActualDays = [],
}: {
  actual: LoadInput[];
  planned: LoadInput[];
  from: DayKey;
  to: DayKey;
  today: DayKey;
  warmupStart?: DayKey;
  unknownActualDays?: DayKey[];
}): LoadPoint[] {
  const actualByDay = sumByDay(actual);
  const plannedByDay = sumByDay(planned);
  const unknownDays = new Set(unknownActualDays);
  const start = warmupStart < from ? warmupStart : from;
  const totalDays = daysBetween(start, to);
  const points: LoadPoint[] = [];

  let fitness = 0;
  let fatigue = 0;

  for (let offset = 0; offset <= totalDays; offset += 1) {
    const day = addDayKeys(start, offset);
    const projected = day > today;
    const actualTss = projected ? 0 : (actualByDay.get(day) ?? 0);
    // Today still has its unfinished plan ahead of it; later days are all plan.
    const plannedTss = day >= today ? (plannedByDay.get(day) ?? 0) : 0;
    const form = fitness - fatigue;
    const shownStress = projected ? plannedTss : actualTss;
    const shownFitness = fitness + (shownStress - fitness) / FITNESS_DAYS;
    const shownFatigue = fatigue + (shownStress - fatigue) / FATIGUE_DAYS;

    if (day >= from) {
      points.push({
        day,
        actualTss: Math.round(actualTss),
        actualLoadKnown: !unknownDays.has(day),
        plannedTss: Math.round(plannedTss),
        fitness: round1(shownFitness),
        fatigue: round1(shownFatigue),
        form: round1(form),
        projected,
      });
    }

    // Today's point shows what has happened, but the projection assumes today's plan gets done.
    const carriedStress = day === today ? actualTss + plannedTss : shownStress;
    fitness += (carriedStress - fitness) / FITNESS_DAYS;
    fatigue += (carriedStress - fatigue) / FATIGUE_DAYS;
  }

  return points;
}

export type FormZone = 'fresh' | 'neutral' | 'productive' | 'overreaching';

/** Reads form the way a self-coached athlete would act on it. */
export function classifyForm(form: number): FormZone {
  if (form > 5) return 'fresh';
  if (form >= -10) return 'neutral';
  if (form >= -30) return 'productive';
  return 'overreaching';
}

export const formZoneLabels: Record<FormZone, string> = {
  fresh: 'Fresh',
  neutral: 'Balanced',
  productive: 'Building',
  overreaching: 'Overreaching',
};

/** Fitness gained over the last 7 days. Above ~8 per week is aggressive. */
export function rampRate(series: LoadPoint[], today: DayKey): number | null {
  const index = series.findIndex((point) => point.day === today);
  if (index < 7) return null;
  return round1(series[index].fitness - series[index - 7].fitness);
}

export type ComplianceState = 'complete' | 'partial' | 'off' | 'missed' | 'planned' | 'unplanned' | 'duration-only' | 'skipped';

/**
 * Compares what was done with what was planned, by duration first and stress
 * as a fallback, within the familiar 80-120% "on plan" band.
 */
export function classifyCompliance({
  status,
  day,
  today,
  plannedDurationSec,
  plannedTss,
  actualDurationSec,
  actualTss,
  compliancePct,
  metricsSource,
}: {
  status: 'planned' | 'completed' | 'adjusted' | 'missed' | 'skipped';
  day: DayKey;
  today: DayKey;
  plannedDurationSec: number;
  plannedTss: number;
  actualDurationSec?: number | null;
  actualTss?: number | null;
  compliancePct?: number | null;
  metricsSource?: string | null;
}): ComplianceState {
  // A skipped session is a deliberate decision, so it is neither missed nor planned.
  if (status === 'skipped') return 'skipped';
  if (status !== 'completed') {
    if (status === 'missed' || day < today) return 'missed';
    return 'planned';
  }

  if (metricsSource === 'tcx-import' || metricsSource === 'fit-import' || metricsSource === 'gpx-import' || metricsSource === 'manual-paired') {
    return plannedDurationSec > 0 ? 'duration-only' : 'unplanned';
  }

  let ratio: number | null = null;
  if (typeof compliancePct === 'number' && Number.isFinite(compliancePct)) {
    ratio = compliancePct / 100;
  } else if (plannedDurationSec > 0 && actualDurationSec) {
    ratio = actualDurationSec / plannedDurationSec;
  } else if (plannedTss > 0 && actualTss) {
    ratio = actualTss / plannedTss;
  }

  if (ratio === null) return plannedDurationSec > 0 || plannedTss > 0 ? 'complete' : 'unplanned';
  if (ratio >= 0.8 && ratio <= 1.2) return 'complete';
  if (ratio >= 0.5 && ratio <= 1.5) return 'partial';
  return 'off';
}

export const complianceLabels: Record<ComplianceState, string> = {
  complete: 'On plan',
  partial: 'Partly on plan',
  off: 'Off plan',
  missed: 'Missed',
  planned: 'Planned',
  unplanned: 'Unplanned',
  'duration-only': 'Time logged',
  skipped: 'Skipped',
};

export type WeekSession = {
  /** The planned day, so moved or late completions stay in the week they were planned for. */
  day: DayKey;
  sport: string;
  plannedDurationSec: number;
  plannedTss: number;
  actualDurationSec: number | null;
  actualTss: number | null;
  compliance: ComplianceState;
};

export type WeekSummary = {
  weekStart: DayKey;
  planned: { durationSec: number; tss: number; sessions: number };
  completed: { durationSec: number; tss: number; sessions: number; unknownLoadSessions: number };
  missed: number;
  bySport: Array<{ sport: string; durationSec: number; tss: number; unknownLoadSessions: number }>;
  /** Completed duration as a share of planned duration, or null without a plan. */
  completionPct: number | null;
};

/** Monday of the week containing `day`. */
export function weekStartOf(day: DayKey): DayKey {
  const date = fromDayKey(day);
  const offset = (date.getDay() + 6) % 7;
  return addDayKeys(day, -offset);
}

export function summarizeWeeks(sessions: WeekSession[], weekStarts: DayKey[]): WeekSummary[] {
  return weekStarts.map((weekStart) => {
    const weekEnd = addDayKeys(weekStart, 6);
    // Skipped sessions stay visible on the calendar but add no planned, missed, or completed load.
    const inWeek = sessions.filter((session) => session.day >= weekStart && session.day <= weekEnd && session.compliance !== 'skipped');
    const sports = new Map<string, { durationSec: number; tss: number; unknownLoadSessions: number }>();
    const summary: WeekSummary = {
      weekStart,
      planned: { durationSec: 0, tss: 0, sessions: 0 },
      completed: { durationSec: 0, tss: 0, sessions: 0, unknownLoadSessions: 0 },
      missed: 0,
      bySport: [],
      completionPct: null,
    };
    let completedOfPlannedSec = 0;

    for (const session of inWeek) {
      if (session.compliance !== 'unplanned') {
        summary.planned.durationSec += session.plannedDurationSec;
        summary.planned.tss += session.plannedTss;
        summary.planned.sessions += 1;
      }
      if (session.compliance === 'missed') summary.missed += 1;
      if (session.actualDurationSec !== null || session.actualTss !== null) {
        const durationSec = session.actualDurationSec ?? 0;
        const tss = session.actualTss ?? 0;
        if (session.compliance !== 'unplanned') completedOfPlannedSec += durationSec;
        summary.completed.durationSec += durationSec;
        if (session.actualTss !== null) summary.completed.tss += tss;
        else summary.completed.unknownLoadSessions += 1;
        summary.completed.sessions += 1;
        const sport = sports.get(session.sport) ?? { durationSec: 0, tss: 0, unknownLoadSessions: 0 };
        sport.durationSec += durationSec;
        if (session.actualTss === null) sport.unknownLoadSessions += 1;
        else sport.tss += tss;
        sports.set(session.sport, sport);
      }
    }

    summary.bySport = [...sports.entries()]
      .map(([sport, totals]) => ({ sport, ...totals }))
      .sort((left, right) => right.durationSec - left.durationSec);
    // Extra unplanned work should not hide what was skipped from the plan.
    summary.completionPct =
      summary.planned.durationSec > 0 ? Math.round((completedOfPlannedSec / summary.planned.durationSec) * 100) : null;

    return summary;
  });
}
