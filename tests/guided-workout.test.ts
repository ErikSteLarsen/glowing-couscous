import assert from 'node:assert/strict';
import test from 'node:test';

import { createEmptyPerformanceProfile } from '../lib/performance-profile.ts';
import { deriveSessionEditorMetrics, validateSessionEditorDraft } from '../lib/session-editor.ts';
import { GUIDED_DURATIONS, GUIDED_INTENSITIES, GUIDED_SPORTS, buildModelWorkoutDraft, createGuidedCandidates, fallbackGuidedChoice, parseGuidedWorkoutInput, type GuidedHistory } from '../lib/guided-workout.ts';

const emptyHistory: GuidedHistory = {
  completedLast7Days: 0,
  completedLast28Days: 0,
  sameSportLast28Days: 0,
  sameSportMedianMinutes: null,
  recentHighRpeDaysAgo: null,
  importedLast28Days: 0,
};

test('every guided option produces two valid, exact-length drafts', () => {
  for (const sport of GUIDED_SPORTS) for (const durationMinutes of GUIDED_DURATIONS) for (const intensity of GUIDED_INTENSITIES) for (const intervals of [false, true]) {
    const candidates = createGuidedCandidates({ sport, durationMinutes, intensity, intervals }, createEmptyPerformanceProfile(), emptyHistory);
    assert.equal(candidates.length, 2);
    for (const { draft } of candidates) {
      assert.equal(validateSessionEditorDraft(draft), null);
      assert.equal(deriveSessionEditorMetrics(draft).durationSec, durationMinutes * 60);
      assert.equal(draft.scheduledDate, null);
      assert.equal(draft.planWeekday, null);
      assert.equal(draft.sport, sport);
      if (intervals) assert.equal(draft.blocks.some((block) => block.kind === 'recovery'), true);
      if (intensity === 'hard' && !intervals) assert.equal(draft.blocks.filter((block) => block.zone === 4).reduce((sum, block) => sum + block.durationSec, 0) <= 18 * 60, true);
      assert.equal(draft.blocks.every((block) => block.target?.metric === 'rpe'), true);
    }
  }
});

test('profile-backed targets stay relative and user-specific', () => {
  const profile = createEmptyPerformanceProfile();
  profile.running.raceDistanceMeters = 5000;
  profile.running.raceTimeSec = 1500;
  const [candidate] = createGuidedCandidates({ sport: 'RUNNING', durationMinutes: 45, intensity: 'steady', intervals: true }, profile, emptyHistory);
  assert.equal(candidate.draft.blocks.every((block) => block.target?.metric === 'pace' && block.target.mode === 'relative'), true);
});

test('custom running pace zones work without a race result', () => {
  const profile = createEmptyPerformanceProfile();
  for (const zone of [1, 2, 3, 4, 5] as const) profile.running.paceZoneOverrides[zone] = { fastestSecPerKm: 440 - zone * 30, slowestSecPerKm: 465 - zone * 30 };
  const [candidate] = createGuidedCandidates({ sport: 'RUNNING', durationMinutes: 30, intensity: 'easy', intervals: false }, profile, emptyHistory);
  assert.equal(candidate.draft.blocks.every((block) => block.target?.metric === 'pace' && block.target.mode === 'relative'), true);
});

test('recent high effort selects a shorter or gentler fallback', () => {
  const history = { ...emptyHistory, recentHighRpeDaysAgo: 1, sameSportLast28Days: 5 };
  const intervalCandidates = createGuidedCandidates({ sport: 'BIKING', durationMinutes: 45, intensity: 'hard', intervals: true }, null, history);
  assert.equal(fallbackGuidedChoice(intervalCandidates, history).id, 'short');
  const continuousCandidates = createGuidedCandidates({ sport: 'BIKING', durationMinutes: 45, intensity: 'hard', intervals: false }, null, history);
  assert.equal(fallbackGuidedChoice(continuousCandidates, history).id, 'progressive');
});

test('a requested duration longer than recent sessions selects a gentler structure', () => {
  const history = { ...emptyHistory, sameSportLast28Days: 4, sameSportMedianMinutes: 30 };
  const candidates = createGuidedCandidates({ sport: 'RUNNING', durationMinutes: 60, intensity: 'steady', intervals: true }, null, history);
  assert.equal(fallbackGuidedChoice(candidates, history).id, 'short');
});

test('guided input rejects invented settings', () => {
  assert.equal(parseGuidedWorkoutInput({ sport: 'STRENGTH', durationMinutes: 45, intensity: 'hard', intervals: true }), null);
  assert.equal(parseGuidedWorkoutInput({ sport: 'RUNNING', durationMinutes: 240, intensity: 'hard', intervals: true }), null);
  assert.equal(parseGuidedWorkoutInput({ sport: 'RUNNING', durationMinutes: 45, intensity: 'maximal', intervals: true }), null);
});

test('model-authored intervals can use an original sequence but must be valid', () => {
  const request = { sport: 'BIKING' as const, durationMinutes: 30 as const, intensity: 'steady' as const, intervals: true };
  const plan = {
    title: 'Cadence waves', summary: 'Three uneven tempo efforts.', reason: 'Variety within a steady session.',
    blocks: [
      { kind: 'warmup', zone: 1, durationSec: 480, note: '' },
      { kind: 'work', zone: 3, durationSec: 240, note: 'Build cadence.' },
      { kind: 'recovery', zone: 1, durationSec: 60, note: '' },
      { kind: 'work', zone: 3, durationSec: 300, note: 'Hold steady.' },
      { kind: 'recovery', zone: 1, durationSec: 120, note: '' },
      { kind: 'work', zone: 2, durationSec: 300, note: 'Smooth effort.' },
      { kind: 'cooldown', zone: 1, durationSec: 300, note: '' },
    ],
  };
  const result = buildModelWorkoutDraft(plan, request, null, emptyHistory);
  assert.ok(result);
  assert.equal(result.draft.blocks.length, 7);
  assert.equal(validateSessionEditorDraft(result.draft), null);
  assert.equal(deriveSessionEditorMetrics(result.draft).durationSec, 1800);
  assert.equal(buildModelWorkoutDraft({ ...plan, blocks: plan.blocks.slice(0, -1) }, request, null, emptyHistory), null);
  assert.equal(buildModelWorkoutDraft({ ...plan, blocks: plan.blocks.map((block, index) => index === 1 ? { ...block, zone: 5 } : block) }, request, null, emptyHistory), null);
  assert.equal(buildModelWorkoutDraft({ ...plan, blocks: plan.blocks.map((block, index) => index === 3 ? { ...block, durationSec: 360 } : block) }, request, null, emptyHistory), null);
});

test('cautious hard request rejects too much high intensity from a model', () => {
  const request = { sport: 'RUNNING' as const, durationMinutes: 30 as const, intensity: 'hard' as const, intervals: false };
  const plan = { title: 'Threshold finish', summary: 'A controlled strong finish.', reason: 'Limited threshold time.', blocks: [
    { kind: 'warmup', zone: 1, durationSec: 600, note: '' },
    { kind: 'work', zone: 2, durationSec: 600, note: '' },
    { kind: 'work', zone: 4, durationSec: 300, note: '' },
    { kind: 'cooldown', zone: 1, durationSec: 300, note: '' },
  ] };
  assert.ok(buildModelWorkoutDraft(plan, request, null, emptyHistory));
  assert.equal(buildModelWorkoutDraft({ ...plan, blocks: plan.blocks.map((block, index) => index === 2 ? { ...block, durationSec: 600 } : index === 1 ? { ...block, durationSec: 300 } : block) }, request, null, emptyHistory), null);
});
