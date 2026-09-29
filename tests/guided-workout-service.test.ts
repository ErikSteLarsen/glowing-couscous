import assert from 'node:assert/strict';
import test from 'node:test';

import { createGuidedWorkoutService, summarizeGuidedHistory } from '../lib/guided-workout-service.ts';
import { buildModelWorkoutDraft } from '../lib/guided-workout.ts';
import type { prisma } from '../lib/prisma.ts';

const now = new Date('2026-09-28T12:00:00.000Z');
const input = { sport: 'RUNNING' as const, durationMinutes: 45 as const, intensity: 'steady' as const, intervals: true };
const db = {
  user: { findUnique: async () => ({ performanceProfileJson: null }) },
  activity: { findMany: async () => [] },
} as unknown as typeof prisma;

test('history uses completed activities and source-aware counts', () => {
  const history = summarizeGuidedHistory([
    { completedAt: new Date('2026-09-27T12:00:00.000Z'), durationSec: 2400, rpe: 8, metricsSource: 'manual-actual', session: { sport: 'RUNNING' } },
    { completedAt: new Date('2026-09-20T12:00:00.000Z'), durationSec: 3600, rpe: null, metricsSource: 'strava-import', session: { sport: 'RUNNING' } },
    { completedAt: new Date('2026-09-18T12:00:00.000Z'), durationSec: 1800, rpe: null, metricsSource: 'file-import', session: { sport: 'BIKING' } },
    { completedAt: new Date('2026-08-01T12:00:00.000Z'), durationSec: 3600, rpe: 10, metricsSource: 'manual-actual', session: { sport: 'RUNNING' } },
  ], 'RUNNING', now);
  assert.deepEqual(history, {
    completedLast7Days: 1, completedLast28Days: 3, sameSportLast28Days: 2,
    sameSportMedianMinutes: 50, recentHighRpeDaysAgo: 1, importedLast28Days: 2,
  });
});

test('generation reads only the signed-in athlete and falls back when AI is unavailable', async () => {
  let selectedUser: number | null = null;
  let selectedAthlete: number | null = null;
  const scopedDb = {
    user: { findUnique: async (args: { where: { id: number } }) => { selectedUser = args.where.id; return { performanceProfileJson: null }; } },
    activity: { findMany: async (args: { where: { athleteId: number } }) => { selectedAthlete = args.where.athleteId; return []; } },
  } as unknown as typeof prisma;
  const service = createGuidedWorkoutService({ db: scopedDb, llm: { generate: async () => null }, now: () => now });
  const result = await service.generateForAthlete(42, input);
  assert.equal(selectedUser, 42);
  assert.equal(selectedAthlete, 42);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.source, 'guided');
    assert.equal(result.draft.id, null);
    assert.equal(result.draft.athleteId, null);
  }
});

test('a complete model-authored workout reaches the editor without replacing its blocks', async () => {
  const modelPlan = {
    title: 'Varied tempo run', summary: 'A paced progression with three tempo efforts.', reason: 'The varied structure matches the requested steady intervals.',
    blocks: [
      { kind: 'warmup', zone: 1, durationSec: 600, note: '' },
      { kind: 'work', zone: 2, durationSec: 300, note: 'Settle in.' },
      { kind: 'work', zone: 3, durationSec: 300, note: 'First effort.' },
      { kind: 'recovery', zone: 1, durationSec: 120, note: 'Easy jog.' },
      { kind: 'work', zone: 3, durationSec: 420, note: 'Second effort.' },
      { kind: 'recovery', zone: 1, durationSec: 120, note: 'Easy jog.' },
      { kind: 'work', zone: 3, durationSec: 420, note: 'Final effort.' },
      { kind: 'cooldown', zone: 1, durationSec: 420, note: '' },
    ],
  };
  const llm = { generate: async (request: Parameters<typeof buildModelWorkoutDraft>[1], history: Parameters<typeof buildModelWorkoutDraft>[3], profile: Parameters<typeof buildModelWorkoutDraft>[2]) => buildModelWorkoutDraft(modelPlan, request, profile, history) };
  const service = createGuidedWorkoutService({ db, llm, now: () => now });
  const result = await service.generateForAthlete(42, input);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.source, 'ai');
    assert.equal(result.draft.title, 'Varied tempo run');
    assert.equal(result.draft.blocks.length, 8);
    assert.equal(result.reason, modelPlan.reason);
  }
});

test('sparse history keeps the rule-based hard fallback conservative', async () => {
  const service = createGuidedWorkoutService({ db, llm: { generate: async () => null }, now: () => now });
  const result = await service.generateForAthlete(42, { ...input, intensity: 'hard' });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.source, 'guided');
    assert.equal(result.selectedPattern, 'Shorter efforts');
  }
});
