export type SessionIntensitySegment = {
  zone: number;
  durationSec: number;
  label?: string | null;
};

export function getAverageSessionZone(segments: readonly SessionIntensitySegment[]) {
  const activeSegments = segments.filter((segment) => segment.label?.trim().toLowerCase() !== 'pause' && segment.durationSec > 0);
  const activeDuration = activeSegments.reduce((sum, segment) => sum + segment.durationSec, 0);
  if (!activeDuration) return null;

  const weightedZone = activeSegments.reduce((sum, segment) => sum + segment.zone * segment.durationSec, 0) / activeDuration;
  return Math.min(5, Math.max(1, Math.round(weightedZone)));
}
