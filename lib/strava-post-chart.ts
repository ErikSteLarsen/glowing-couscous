import type { ActivitySeriesPoint } from './activity-series.ts';

/** One planned step, positioned in time; height is % of FTP (or the zone's equivalent). */
export type PostChartStep = { startSec: number; durationSec: number; startPct: number; endPct: number; zone: number; kind: string };

export type PostChartInput = {
  points: ActivitySeriesPoint[];
  durationSec: number;
  steps: PostChartStep[];
  ftpWatts: number | null;
  width: number;
  height: number;
};

/** Wattonaut's dark palette, written out because the PNG renderer has no CSS variables. */
export const POST_CHART_COLORS = {
  ground: '#0B0F15',
  rule: '#1F2732',
  ink1: '#EEF2F6',
  ink2: '#A9B4C1',
  ink3: '#8592A1',
  trace: '#5EB6D8',
  heartRate: '#C08AE8',
  zones: { 1: '#7F9BB5', 2: '#4FB89F', 3: '#D9B44A', 4: '#EE8A4C', 5: '#E8667E' } as Record<number, string>,
};

type Bucket = { power: number | null; heart: number | null };

function bucketize(points: ActivitySeriesPoint[], durationSec: number, count: number): Bucket[] {
  const sums = Array.from({ length: count }, () => ({ power: 0, powerN: 0, heart: 0, heartN: 0 }));
  for (const point of points) {
    if (point.elapsedSec < 0 || point.elapsedSec > durationSec) continue;
    const index = Math.min(count - 1, Math.floor(point.elapsedSec / durationSec * count));
    if (typeof point.powerWatts === 'number') { sums[index].power += point.powerWatts; sums[index].powerN += 1; }
    if (typeof point.heartRateBpm === 'number') { sums[index].heart += point.heartRateBpm; sums[index].heartN += 1; }
  }
  return sums.map((sum) => ({
    power: sum.powerN ? sum.power / sum.powerN : null,
    heart: sum.heartN ? sum.heart / sum.heartN : null,
  }));
}

function linePaths(values: Array<number | null>, x: (index: number) => number, y: (value: number) => number) {
  const paths: string[] = [];
  let current: string[] = [];
  values.forEach((value, index) => {
    if (value === null) {
      if (current.length > 1) paths.push(current.join(' '));
      current = [];
      return;
    }
    current.push(`${current.length ? 'L' : 'M'}${x(index).toFixed(1)} ${y(value).toFixed(1)}`);
  });
  if (current.length > 1) paths.push(current.join(' '));
  return paths;
}

export type PostChartSummary = { hasPower: boolean; hasHeartRate: boolean; hasPlan: boolean };

/**
 * The recorded power and heart rate over time, with the planned blocks as a faint backdrop.
 * Text-free so any SVG renderer draws it the same; labels belong to the surrounding layout.
 */
export function buildPostChartSvg(input: PostChartInput): { svg: string; summary: PostChartSummary } {
  const { width, height } = input;
  const durationSec = Math.max(1, input.durationSec, input.steps.reduce((end, step) => Math.max(end, step.startSec + step.durationSec), 0));
  const bucketCount = Math.max(20, Math.min(400, Math.round(width / 3)));
  const buckets = bucketize(input.points, durationSec, bucketCount);
  const powers = buckets.flatMap((bucket) => bucket.power === null ? [] : [bucket.power]);
  const hearts = buckets.flatMap((bucket) => bucket.heart === null ? [] : [bucket.heart]);
  const planWatts = (pct: number) => input.ftpWatts ? pct / 100 * input.ftpWatts : null;
  const planMax = Math.max(0, ...input.steps.map((step) => Math.max(step.startPct, step.endPct)));
  const top = Math.max(
    ...powers,
    input.ftpWatts ? planWatts(planMax) ?? 0 : 0,
    input.ftpWatts ? input.ftpWatts * 1.1 : 0,
    1,
  ) * 1.08;
  const padTop = 8;
  const padBottom = 4;
  const plotHeight = height - padTop - padBottom;
  const xTime = (sec: number) => sec / durationSec * width;
  const xBucket = (index: number) => (index + 0.5) / bucketCount * width;
  const yWatts = (watts: number) => padTop + plotHeight - Math.min(1, watts / top) * plotHeight;
  // Without FTP or power, the plan keeps its own shape on the full height.
  const yPlan = (pct: number) => {
    const watts = planWatts(pct);
    if (watts !== null && (powers.length || input.ftpWatts)) return yWatts(watts);
    return padTop + plotHeight - (planMax > 0 ? pct / (planMax * 1.08) : 0) * plotHeight;
  };
  const heartLow = hearts.length ? Math.min(...hearts) - 10 : 0;
  const heartHigh = hearts.length ? Math.max(...hearts) + 6 : 1;
  const yHeart = (bpm: number) => padTop + plotHeight - (bpm - heartLow) / Math.max(1, heartHigh - heartLow) * plotHeight * 0.92;

  const parts: string[] = [`<rect width="${width}" height="${height}" fill="${POST_CHART_COLORS.ground}"/>`];
  for (let quarter = 1; quarter < 4; quarter += 1) {
    const y = (padTop + plotHeight * quarter / 4).toFixed(1);
    parts.push(`<line x1="0" x2="${width}" y1="${y}" y2="${y}" stroke="${POST_CHART_COLORS.rule}" stroke-width="1"/>`);
  }
  for (const step of input.steps) {
    const x1 = xTime(step.startSec);
    const x2 = xTime(step.startSec + step.durationSec);
    const base = (padTop + plotHeight).toFixed(1);
    const color = POST_CHART_COLORS.zones[Math.min(5, Math.max(1, Math.round(step.zone)))];
    parts.push(`<path d="M${x1.toFixed(1)} ${base} L${x1.toFixed(1)} ${yPlan(step.startPct).toFixed(1)} L${x2.toFixed(1)} ${yPlan(step.endPct).toFixed(1)} L${x2.toFixed(1)} ${base} Z" fill="${color}" fill-opacity="${step.kind === 'pause' ? 0.08 : 0.2}"/>`);
  }
  if (input.ftpWatts && (powers.length || input.steps.length)) {
    const y = yWatts(input.ftpWatts).toFixed(1);
    parts.push(`<line x1="0" x2="${width}" y1="${y}" y2="${y}" stroke="${POST_CHART_COLORS.ink3}" stroke-width="1.5" stroke-dasharray="4 7"/>`);
  }
  for (const d of linePaths(buckets.map((bucket) => bucket.heart), xBucket, yHeart)) {
    parts.push(`<path d="${d}" fill="none" stroke="${POST_CHART_COLORS.heartRate}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`);
  }
  for (const d of linePaths(buckets.map((bucket) => bucket.power), xBucket, yWatts)) {
    parts.push(`<path d="${d}" fill="none" stroke="${POST_CHART_COLORS.ink1}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`);
  }
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${parts.join('')}</svg>`,
    summary: { hasPower: powers.length > 0, hasHeartRate: hearts.length > 0, hasPlan: input.steps.length > 0 },
  };
}
