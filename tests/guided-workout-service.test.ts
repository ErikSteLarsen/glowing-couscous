import assert from 'node:assert/strict';
import test from 'node:test';

import { createGuidedWorkoutService, summarizeGuidedHistory } from '../lib/guided-workout-service.ts';
import type { prisma } from '../lib/prisma.ts';

const now = new Date('2026-09-28T12:00:00.000Z');
const input = { sport: 'RUNNING', durationMinutes: 45, intensity: 'steady', intervals: true };

test('history uses completed activities and source-aware counts', () => {
  const history = summarizeGuidedHistory([
    { completedAt: new Date('2026-09-27T12:00:00.000Z'), durationSec: 2400, rpe: 8, metricsSource: 'manual-actual', session: { sport: 'RUNNING' } },
    { completedAt: new Date('2026-09-20T12:00:00.000Z'), durationSec: 3600, rpe: null, metricsSource: 'strava-import', session: { sport: 'RUNNING' } },
    { completedAt: new Date('2026-09-18T12:00:00.000Z'), durationSec: 1800, rpe: null, metricsSource: 'file-import', session: { sport: 'BIKING' } },
    { completedAt: new Date('2026-08-01T12:00:00.000Z'), durationSec: 3600, rpe: 10, metricsSource: 'manual-actual', session: { sport: 'RUNNING' } },
  ], 'RUNNING', now);
  assert.deepEqual(history, {
    completedLast7Days: 1,
    completedLast28Days: 3,
    sameSportLast28Days: 2,
    sameSportMedianMinutes: 50,
    recentHighRpeDaysAgo: 1,
    importedLast28Days: 2,
  });
});

test('generation reads only the signed-in athlete and falls back if model output is invalid', async () => {
  let selectedUser: number | null = null;
  let selectedAthlete: number | null = null;
  const db = {
    user: { findUnique: async (args: { where: { id: number } }) => { selectedUser = args.where.id; return { performanceProfileJson: null }; } },
    activity: { findMany: async (args: { where: { athleteId: number } }) => { selectedAthlete = args.where.athleteId; return []; } },
  } as unknown as typeof prisma;
  const fetcher = async () => new Response(JSON.stringify({ output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ candidate_id: 'invented' }) }] }] }), { status: 200 });
  const service = createGuidedWorkoutService({ db, fetcher: fetcher as typeof fetch, now: () => now, apiKey: 'test-key' });
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

test('valid model choice selects only a server-built candidate', async () => {
  const db = {
    user: { findUnique: async () => ({ performanceProfileJson: null }) },
    activity: { findMany: async () => [] },
  } as unknown as typeof prisma;
  const captured: { value: Record<string, unknown> | null } = { value: null };
  const fetcher = async (_url: string | URL | Request, init?: RequestInit) => {
    captured.value = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({ output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify({ candidate_id: 'short' }) }] }] }), { status: 200 });
  };
  const service = createGuidedWorkoutService({ db, fetcher: fetcher as typeof fetch, now: () => now, apiKey: 'test-key' });
  const result = await service.generateForAthlete(42, input);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.source, 'ai');
    assert.equal(result.selectedPattern, 'Shorter efforts');
  }
  assert.equal(captured.value?.store, false);
  const prompt = JSON.stringify(captured.value?.input);
  assert.equal(prompt.includes('performanceProfileJson'), false);
  assert.equal(prompt.includes('telemetryJson'), false);
  assert.equal(prompt.includes('notes'), false);
});

test('sparse history keeps a hard request on the conservative candidate without calling the model', async () => {
  const db = {
    user: { findUnique: async () => ({ performanceProfileJson: null }) },
    activity: { findMany: async () => [] },
  } as unknown as typeof prisma;
  const fetcher = async () => { throw new Error('The model should not be called.'); };
  const service = createGuidedWorkoutService({ db, fetcher: fetcher as typeof fetch, now: () => now, apiKey: 'test-key' });
  const result = await service.generateForAthlete(42, { ...input, intensity: 'hard' });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.source, 'guided');
    assert.equal(result.selectedPattern, 'Shorter efforts');
  }
});

test('a custom chat-completions endpoint can select an allowed candidate', async () => {
  const db = {
    user: { findUnique: async () => ({ performanceProfileJson: null }) },
    activity: { findMany: async () => [] },
  } as unknown as typeof prisma;
  const captured: { url: string | null; body: Record<string, unknown> | null; key: string | null } = { url: null, body: null, key: null };
  const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
    captured.url = String(url);
    captured.body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    captured.key = new Headers(init?.headers).get('Authorization');
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: '{"candidate_id":"short"}' } }] }), { status: 200 });
  };
  const service = createGuidedWorkoutService({ db, fetcher: fetcher as typeof fetch, now: () => now, apiKey: 'custom-key', model: 'local-model', apiUrl: 'https://llm.example.test/v1/chat/completions', apiFormat: 'chat-completions' });
  const result = await service.generateForAthlete(42, input);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.selectedPattern, 'Shorter efforts');
  assert.equal(captured.url, 'https://llm.example.test/v1/chat/completions');
  assert.equal(captured.key, 'Bearer custom-key');
  assert.equal(captured.body?.model, 'local-model');
  assert.equal(captured.body?.store, undefined);
  assert.deepEqual(captured.body?.response_format, { type: 'json_object' });
});

test('invalid model endpoint quietly uses a validated local pattern', async () => {
  const db = {
    user: { findUnique: async () => ({ performanceProfileJson: null }) },
    activity: { findMany: async () => [] },
  } as unknown as typeof prisma;
  const fetcher = async () => { throw new Error('Invalid endpoint must not be called.'); };
  const service = createGuidedWorkoutService({ db, fetcher: fetcher as typeof fetch, now: () => now, apiKey: 'custom-key', apiUrl: 'http://untrusted.example.test/v1/responses' });
  const result = await service.generateForAthlete(42, input);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.source, 'guided');
});
