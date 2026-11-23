import { formatAnalysisDuration, formatAnalysisPace, type ActivityAnalysisResult } from './activity-analysis.ts';

export function analysisTimelineSegments(result: ActivityAnalysisResult) {
  let repetition = 0;
  return result.segments.map(segment => {
    const label = segment.kind === 'work' && result.workSummary.repetitions ? `Effort ${++repetition}`
      : ({ warmup: 'Warm-up', work: 'Continuous work', recovery: 'Recovery', cooldown: 'Cool-down', unknown: 'Unclassified' })[segment.kind];
    const zone = result.intensityBasis === 'pace' ? segment.paceZone : result.intensityBasis === 'heart-rate' ? segment.hrZone : null;
    const stopped = segment.kind === 'recovery' && segment.coverage >= 0.95 && segment.distanceMeters === 0;
    return { key: segment.id, durationSec: segment.durationSec, zone, kind: stopped ? 'pause' as const : segment.kind,
      label: `${label}\u00A0– ${formatAnalysisDuration(segment.durationSec)}\u00A0– ${formatAnalysisPace(segment.paceSecPerKm)}`, color: '' };
  });
}
