import type { ActivitySeriesPoint } from './activity-series.ts';
import type { ActivityTelemetry } from './activity-metrics.ts';
import type { PerformanceProfile } from './performance-profile.ts';
import { getRunningPaceZones, zoneForHeartRateBpm } from './profile-training-zones.ts';

export const ACTIVITY_ANALYZER_VERSION = 'intervals-v2';
export type AnalysisKind = 'warmup' | 'work' | 'recovery' | 'cooldown' | 'unknown';
export type AnalysisSegment = {
  id: string; kind: AnalysisKind; startSec: number; endSec: number; durationSec: number;
  distanceMeters: number | null; paceSecPerKm: number | null; averageHrBpm: number | null;
  paceZone: number | null; hrZone: number | null; coverage: number;
};
export type AnalysisCandidate = { id: string; label: string; durationSec: number | null; distanceMeters: number | null; recoverySec: number | null };
export type ActivityAnalysisResult = {
  version: 1; analyzerVersion: string; source: 'code' | 'ai'; model: string | null;
  segments: AnalysisSegment[]; workSummary: { repetitions: number; durationSec: number; distanceMeters: number | null; paceSecPerKm: number | null; coverage: number };
  candidates: AnalysisCandidate[]; selectedCandidateId: string | null;
  summary: string; emphasis: string; confidence: 'limited' | 'moderate'; limitations: string[];
  intensityBasis: 'pace' | 'heart-rate' | 'unknown';
  targetPaceSecPerKm: number | null;
};

const MAX_GAP_SEC = 15;
const median = (values: number[]) => quantile(values, 0.5);
function quantile(values: number[], fraction: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * fraction)];
}
const usable = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Only adjacent measured spans contribute: missing time is never filled with a last value. */
export function measureActivitySegment(points: ActivitySeriesPoint[], startSec: number, endSec: number) {
  let distance = 0, covered = 0, hrTotal = 0, hrTime = 0;
  let low = 0, high = points.length;
  while (low < high) { const middle = (low + high) >>> 1; if (points[middle].elapsedSec < startSec) low = middle + 1; else high = middle; }
  for (let index = Math.max(0, low - 1); index < points.length - 1 && points[index].elapsedSec < endSec; index++) {
    const a = points[index], b = points[index + 1];
    const span = b.elapsedSec - a.elapsedSec;
    const overlap = Math.min(endSec, b.elapsedSec) - Math.max(startSec, a.elapsedSec);
    if (span <= 0 || span > MAX_GAP_SEC || overlap <= 0) continue;
    const from = (Math.max(startSec, a.elapsedSec) - a.elapsedSec) / span;
    const to = (Math.min(endSec, b.elapsedSec) - a.elapsedSec) / span;
    const delta = usable(a.distanceMeters) && usable(b.distanceMeters) ? b.distanceMeters - a.distanceMeters : null;
    const speed = usable(a.speedMetersPerSecond) && usable(b.speedMetersPerSecond)
      ? (a.speedMetersPerSecond + b.speedMetersPerSecond) / 2 : null;
    // Bound implausible distance jumps; a valid zero distance still measures stopped time.
    if (delta !== null && delta >= 0 && delta / span <= 15) { distance += delta * overlap / span; covered += overlap; }
    else if (speed !== null && speed >= 0 && speed <= 15) {
      distance += (a.speedMetersPerSecond! + (b.speedMetersPerSecond! - a.speedMetersPerSecond!) * (from + to) / 2) * overlap;
      covered += overlap;
    }
    if (usable(a.heartRateBpm) && usable(b.heartRateBpm)) {
      hrTotal += (a.heartRateBpm + (b.heartRateBpm - a.heartRateBpm) * (from + to) / 2) * overlap; hrTime += overlap;
    }
  }
  return { distanceMeters: covered ? distance : null, coveredSec: covered,
    paceSecPerKm: distance > 0 ? covered * 1000 / distance : null,
    averageHrBpm: hrTime ? hrTotal / hrTime : null,
    coverage: endSec > startSec ? covered / (endSec - startSec) : 0 };
}

type Range = { startSec: number; endSec: number; speed: number | null };
function sampledRanges(points: ActivitySeriesPoint[], durationSec: number): Range[] {
  const ranges: Range[] = [];
  for (let startSec = 0; startSec < durationSec; startSec += 5) {
    const endSec = Math.min(durationSec, startSec + 5);
    const measured = measureActivitySegment(points, startSec, endSec);
    ranges.push({ startSec, endSec, speed: measured.coverage >= 0.5 && measured.distanceMeters !== null
      ? measured.distanceMeters / measured.coveredSec : null });
  }
  return ranges;
}
function boundaries(ranges: Range[], threshold: number) {
  const groups: Array<Range & { high: boolean | null }> = [];
  for (const range of ranges) {
    const high = range.speed === null ? null : range.speed >= threshold;
    const last = groups.at(-1);
    if (last && last.high === high && last.endSec === range.startSec) last.endSec = range.endSec;
    else groups.push({ ...range, high });
  }
  // Remove brief excursions inside a sustained effort/recovery, never bridge unknown gaps.
  for (let index = 1; index < groups.length - 1; index++) {
    const group = groups[index], before = groups[index - 1], after = groups[index + 1];
    if (group.high !== null && before.high !== null && before.high === after.high && group.endSec - group.startSec < 15) group.high = before.high;
  }
  const merged: typeof groups = [];
  for (const group of groups) {
    const last = merged.at(-1);
    if (last && last.high === group.high) last.endSec = group.endSec;
    else merged.push({ ...group });
  }
  return merged;
}

export function analyzeActivity(telemetry: ActivityTelemetry, durationSec: number, profile: PerformanceProfile): ActivityAnalysisResult {
  const points = telemetry.points.filter(p => p.elapsedSec <= durationSec).sort((a, b) => a.elapsedSec - b.elapsedSec);
  const sampled = sampledRanges(points, durationSec);
  const speeds = sampled.flatMap(range => range.speed === null ? [] : [range.speed]);
  const slow = quantile(speeds, 0.2), fast = quantile(speeds, 0.8);
  const contrast = fast > 0 && fast - slow > Math.max(0.35, fast * 0.15);
  const threshold = (slow + fast) / 2;
  let groups = boundaries(sampled, contrast ? threshold : Infinity);
  // Laps provide exact boundaries when repeated high/low efforts agree with the stream.
  if (contrast && telemetry.laps && telemetry.laps.length >= 4) {
    const lapRanges: Range[] = [];
    let end = 0;
    for (const lap of telemetry.laps) {
      if (lap.startSec > end) {
        const gap = measureActivitySegment(points, end, lap.startSec);
        lapRanges.push({ startSec: end, endSec: lap.startSec, speed: gap.coverage >= 0.5 && gap.distanceMeters !== null ? gap.distanceMeters / gap.coveredSec : null });
      }
      const m = measureActivitySegment(points, lap.startSec, lap.endSec);
      lapRanges.push({ startSec: lap.startSec, endSec: lap.endSec, speed: m.coverage >= 0.5 && m.distanceMeters !== null ? m.distanceMeters / m.coveredSec : null });
      end = lap.endSec;
    }
    if (end < durationSec) {
      const tail = measureActivitySegment(points, end, durationSec);
      lapRanges.push({ startSec: end, endSec: durationSec, speed: tail.coverage >= 0.5 && tail.distanceMeters !== null ? tail.distanceMeters / tail.coveredSec : null });
    }
    const lapGroups = boundaries(lapRanges, threshold);
    if (lapGroups.filter(g => g.high && g.endSec - g.startSec >= 20).length >= 2) groups = lapGroups;
  }
  const tooFragmented = groups.length > 500;
  if (tooFragmented) groups = [{ startSec: 0, endSec: durationSec, speed: null, high: null }];
  const efforts = groups.filter(g => g.high === true && g.endSec - g.startSec >= 20);
  const intervals = efforts.length >= 2;
  const first = efforts[0]?.startSec ?? 0, last = efforts.at(-1)?.endSec ?? durationSec;
  const paceRanges = getRunningPaceZones(profile);
  const segments: AnalysisSegment[] = groups.map((group, index) => {
    const metrics = measureActivitySegment(points, group.startSec, group.endSec);
    const pace = metrics.paceSecPerKm;
    const paceZone = pace === null ? null : [1, 2, 3, 4, 5].find(zone => {
      const band = paceRanges[zone as 1 | 2 | 3 | 4 | 5];
      return band && pace >= band.fastestSecPerKm && pace <= band.slowestSecPerKm;
    }) ?? null;
    const kind: AnalysisKind = group.high === null ? 'unknown' : !intervals ? 'work'
      : group.high && group.endSec - group.startSec >= 20 ? 'work'
        : group.endSec <= first ? 'warmup' : group.startSec >= last ? 'cooldown' : 'recovery';
    return { id: `segment-${index + 1}`, kind, startSec: group.startSec, endSec: group.endSec,
      durationSec: group.endSec - group.startSec, distanceMeters: metrics.distanceMeters,
      paceSecPerKm: pace, averageHrBpm: metrics.averageHrBpm, paceZone,
      hrZone: metrics.averageHrBpm === null ? null : zoneForHeartRateBpm(metrics.averageHrBpm, profile.heartRateMaxBpm), coverage: metrics.coverage };
  });
  const work = segments.filter(s => s.kind === 'work');
  const totalSec = work.reduce((sum, s) => sum + s.durationSec, 0);
  const coveredSec = work.reduce((sum, s) => sum + s.durationSec * s.coverage, 0);
  const distance = work.reduce((sum, s) => sum + (s.distanceMeters ?? 0), 0);
  const recoverySec = median(segments.filter(s => s.kind === 'recovery').map(s => s.durationSec));
  const duration = median(work.map(s => s.durationSec));
  const candidates: AnalysisCandidate[] = [];
  if (intervals) {
    const consistent = work.every(s => Math.abs(s.durationSec - duration) <= Math.max(5, duration * 0.1));
    candidates.push({ id: 'observed', label: consistent ? `${work.length} efforts around ${formatAnalysisDuration(duration)}` : `${work.length} efforts with varied durations`, durationSec: duration, distanceMeters: null, recoverySec: recoverySec || null });
    const common = [30, 60, 90, 120, 180, 240, 300, 360, 480, 600, 900].find(sec => work.every(s => Math.abs(s.durationSec - sec) <= Math.min(5, sec * 0.03)));
    if (common) candidates.unshift({ id: 'time', label: `${work.length} × ${formatAnalysisDuration(common)}`, durationSec: common, distanceMeters: null, recoverySec: recoverySec || null });
    const targetDistance = [200, 400, 800, 1000, 1600, 2000].find(m => work.every(s => s.coverage > 0.95 && s.distanceMeters !== null && Math.abs(s.distanceMeters - m) <= m * 0.04));
    if (targetDistance) candidates.push({ id: 'distance', label: `${work.length} × ${targetDistance} m`, durationSec: null, distanceMeters: targetDistance, recoverySec: recoverySec || null });
  }
  const basis = work.some(s => s.paceZone !== null) ? 'pace' : work.some(s => s.hrZone !== null) ? 'heart-rate' : 'unknown';
  const limitations = ['Interpretation is an estimate; pace changes and laps may not reflect intended repetitions.', 'Training emphasis is not a measurement of physiological adaptation.'];
  if (tooFragmented) limitations.push('The recording is too fragmented to display a reliable interval structure.');
  if (segments.reduce((sum, s) => sum + s.durationSec * s.coverage, 0) < durationSec * 0.95) limitations.push('Some time spans have missing or insufficient measurements; pace uses covered spans only.');
  if (basis === 'unknown') limitations.push('Personal intensity zones are unavailable for these measurements.');
  if (work.some(s => s.paceZone !== null && s.hrZone !== null && Math.abs(s.paceZone - s.hrZone) >= 2)) limitations.push('Pace and heart-rate zones differ substantially in some efforts. Heart rate can lag or drift; inspect both estimates in the evidence table.');
  const zones = work.flatMap(s => (basis === 'pace' ? s.paceZone : s.hrZone) === null ? [] : [basis === 'pace' ? s.paceZone! : s.hrZone!]);
  const typicalZone = median(zones);
  return { version: 1, analyzerVersion: ACTIVITY_ANALYZER_VERSION, source: 'code', model: null, segments,
    workSummary: { repetitions: intervals ? work.length : 0, durationSec: totalSec, distanceMeters: coveredSec ? distance : null,
      paceSecPerKm: distance > 0 ? 1000 * coveredSec / distance : null, coverage: totalSec ? coveredSec / totalSec : 0 },
    candidates, selectedCandidateId: candidates[0]?.id ?? null,
    summary: intervals ? `Detected ${work.length} efforts, with ${segments.filter(s => s.kind === 'recovery').length} recoveries between them. Variations inside each effort are retained in the recorded measurements.`
      : speeds.length > 1 ? 'No clear repeated interval pattern was detected. The timeline shows the measured continuous work and any gaps.' : 'There are not enough recorded measurements to interpret this workout.',
    emphasis: typicalZone ? typicalZone <= 2 ? 'Likely aerobic endurance work' : typicalZone <= 4 ? 'Likely sustained aerobic work' : 'Likely high aerobic demand; anaerobic contribution is uncertain' : 'Training emphasis is uncertain without calibrated intensity.',
    confidence: intervals && coveredSec / Math.max(totalSec, 1) > 0.9 ? 'moderate' : 'limited', limitations, intensityBasis: basis,
    targetPaceSecPerKm: intervals ? median(work.flatMap(s => {
      const middle = measureActivitySegment(points, s.startSec + s.durationSec * 0.2, s.endSec - s.durationSec * 0.2);
      return middle.coverage >= 0.9 && middle.paceSecPerKm !== null ? [middle.paceSecPerKm] : [];
    })) || null : null };
}

export function formatAnalysisDuration(seconds: number) {
  const sec = Math.round(seconds);
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}
export function formatAnalysisPace(pace: number | null) { return pace === null ? 'Not available' : `${formatAnalysisDuration(pace)} /km`; }
