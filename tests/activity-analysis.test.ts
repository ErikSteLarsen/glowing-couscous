import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeActivity, measureActivitySegment } from '../lib/activity-analysis.ts';
import { createEmptyPerformanceProfile } from '../lib/performance-profile.ts';
import { analysisTimelineSegments } from '../lib/activity-analysis-view.ts';
import { validateActivityLaps } from '../lib/activity-laps.ts';
import { isActivityAnalysisEligible } from '../lib/activity-analysis-job.ts';
import { interpretActivityEvidence, validateAnalysisExplanation } from '../lib/activity-analysis-llm.ts';
import type { ActivitySeriesPoint } from '../lib/activity-series.ts';

export function intervalRecording(durations = [240, 240, 240], recovery = 120) {
  const blocks = [{ sec: 60, speed: 2 }, ...durations.flatMap((sec, index) => [{ sec, speed: 4 }, ...(index < durations.length - 1 ? [{ sec: recovery, speed: 2 }] : [])]), { sec: 60, speed: 2 }];
  const points: ActivitySeriesPoint[] = [], laps = [];
  let elapsed = 0, distance = 0;
  for (const block of blocks) {
    const startSec = elapsed;
    for (let i = 0; i < block.sec; i++) {
      points.push({ elapsedSec: elapsed++, distanceMeters: distance, speedMetersPerSecond: block.speed, heartRateBpm: block.speed === 4 ? 160 : 145 });
      distance += block.speed;
    }
    laps.push({ startSec, endSec: elapsed, timerSec: null, origin: 'device' as const });
  }
  points.push({ elapsedSec: elapsed, distanceMeters: distance, speedMetersPerSecond: 2, heartRateBpm: 145 });
  return { telemetry: { version: 2 as const, distanceMeters: distance, elevationGainMeters: null, points, laps }, durationSec: elapsed };
}
test('detects repeated efforts, pools work pace, excludes recovery and renders their actual durations', () => {
  const input = intervalRecording([238, 241, 239, 240, 240, 240, 240, 240]);
  const result = analyzeActivity(input.telemetry, input.durationSec, createEmptyPerformanceProfile());
  assert.equal(result.workSummary.repetitions, 8);
  assert.equal(result.workSummary.durationSec, 1918);
  assert.equal(result.workSummary.paceSecPerKm, 250);
  assert.equal(result.candidates[0].durationSec, 240);
  assert.equal(result.targetPaceSecPerKm, 250);
  assert.ok(!result.limitations.some(text => text.includes('Some time spans')));
  assert.equal(result.segments.filter(s => s.kind === 'recovery').length, 7);
  assert.equal(result.segments.reduce((n, s) => n + s.durationSec, 0), input.durationSec);
  assert.ok(analysisTimelineSegments(result).every(s => s.zone === null));
});
test('genuine 53 second laps are not rounded to minutes', () => {
  const input = intervalRecording([53, 53, 53], 30);
  const result = analyzeActivity(input.telemetry, input.durationSec, createEmptyPerformanceProfile());
  assert.equal(result.workSummary.repetitions, 3);
  assert.equal(result.candidates[0].durationSec, 53);
  assert.ok(!result.candidates.some(c => c.durationSec === 60));
});
test('pace uses pooled time/distance, stopped time counts, missing spans are excluded', () => {
  const points = [{ elapsedSec: 0, distanceMeters: 0 }, { elapsedSec: 10, distanceMeters: 40 },
    { elapsedSec: 20, distanceMeters: 40 }, { elapsedSec: 120, distanceMeters: 440 }, { elapsedSec: 130, distanceMeters: 460 }];
  const measured = measureActivitySegment(points, 0, 130);
  assert.equal(measured.coveredSec, 30);
  assert.equal(measured.distanceMeters, 60);
  assert.equal(measured.paceSecPerKm, 500);
  assert.equal(measured.coverage, 30 / 130);
});
test('clipped sensor spans integrate only the portion inside an interval', () => {
  const points = [{ elapsedSec: 0, speedMetersPerSecond: 2, heartRateBpm: 100 },
    { elapsedSec: 10, speedMetersPerSecond: 4, heartRateBpm: 120 }];
  const early = measureActivitySegment(points, 0, 5), late = measureActivitySegment(points, 5, 10);
  assert.equal(early.averageHrBpm, 105);
  assert.equal(late.averageHrBpm, 115);
  assert.equal(early.distanceMeters, 12.5);
  assert.equal(late.distanceMeters, 17.5);
  assert.equal(early.coveredSec + late.coveredSec, 10);
});
test('irregular repetitions are not described as one uniform duration', () => {
  const input = intervalRecording([53, 180, 300], 60);
  const result = analyzeActivity(input.telemetry, input.durationSec, createEmptyPerformanceProfile());
  assert.equal(result.workSummary.repetitions, 3);
  assert.equal(result.candidates[0].id, 'observed');
  assert.equal(result.candidates[0].label, '3 efforts with varied durations');
  assert.ok(!result.candidates.some(c => c.id === 'time'));
});
test('model receives a constrained candidate list and retains calculated metrics', async () => {
  const input = intervalRecording();
  const evidence = analyzeActivity(input.telemetry, input.durationSec, createEmptyPerformanceProfile());
  const result = await interpretActivityEvidence(evidence, async (json, schema, instructions) => {
    const supplied = JSON.parse(json);
    assert.equal(supplied.preferredCandidateId, evidence.selectedCandidateId);
    assert.equal(supplied.confidence, evidence.confidence);
    assert.deepEqual(Object.keys(supplied.segments[0]).sort(), ['averageHrBpm', 'coverage', 'durationSec', 'hrZone', 'id', 'kind', 'paceSecPerKm', 'paceZone']);
    assert.deepEqual((schema.properties as { candidateId: { enum: string[] } }).candidateId.enum, evidence.candidates.map(c => c.id));
    assert.ok(instructions.includes('only segment averages are provided'));
    return { text: JSON.stringify({ candidateId: 'time', explanation: 'Repeated sustained efforts alternate with slower recoveries.' }), model: 'test-model' };
  });
  assert.equal(result.source, 'ai');
  assert.deepEqual(result.workSummary, evidence.workSummary);
  assert.deepEqual(result.segments, evidence.segments);
  const rejected = await interpretActivityEvidence(evidence, async () => ({ text: JSON.stringify({ candidateId: 'invented', explanation: 'Invented intervals.' }), model: 'test-model' }));
  assert.equal(rejected, evidence);
});
test('continuous work and summary-only recordings do not claim repeated efforts', () => {
  const points = Array.from({ length: 121 }, (_, elapsedSec) => ({ elapsedSec, distanceMeters: elapsedSec * 3, heartRateBpm: 140 }));
  const result = analyzeActivity({ version: 1, distanceMeters: 360, elevationGainMeters: null, points }, 120, createEmptyPerformanceProfile());
  assert.equal(result.workSummary.repetitions, 0);
  assert.equal(result.workSummary.paceSecPerKm, 1000 / 3);
  const missing = analyzeActivity({ version: 1, distanceMeters: null, elevationGainMeters: null, points: [{ elapsedSec: 0, heartRateBpm: 150 }] }, 120, createEmptyPerformanceProfile());
  assert.equal(missing.workSummary.coverage, 0);
  assert.equal(missing.workSummary.paceSecPerKm, null);
});
test('laps, source eligibility and model selection are validated independently', () => {
  assert.equal(validateActivityLaps([{ startSec: 0, endSec: 100 }, { startSec: 90, endSec: 120 }], 120), null);
  assert.equal(isActivityAnalysisEligible({ metricsSource: 'strava-import', externalSource: 'STRAVA', session: { sport: 'RUNNING' } }), false);
  assert.equal(isActivityAnalysisEligible({ metricsSource: 'file-import', externalSource: 'STRAVA', session: { sport: 'RUNNING' } }), false);
  const input = intervalRecording();
  const result = analyzeActivity(input.telemetry, input.durationSec, createEmptyPerformanceProfile());
  assert.equal(validateAnalysisExplanation({ candidateId: 'invented', explanation: 'Repeated efforts.' }, result), null);
  assert.equal(validateAnalysisExplanation({ candidateId: 'time', explanation: 'Eight efforts at 4:00 pace.' }, result), null);
  assert.ok(validateAnalysisExplanation({ candidateId: 'time', explanation: 'Repeated sustained efforts with easy recoveries.' }, result));
});
