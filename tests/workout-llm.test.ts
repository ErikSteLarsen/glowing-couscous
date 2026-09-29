import assert from 'node:assert/strict';
import test from 'node:test';

import { createWorkoutLlm } from '../lib/workout-llm.ts';
import type { prisma } from '../lib/prisma.ts';

type Row = { id: string; configHash: string; status: string; checkedAt: Date | null; leaseUntil: Date | null };

function healthStore() {
  let row: Row | null = null;
  const same = (a: unknown, b: unknown) => a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b;
  const db = { aiProviderHealth: {
    findUnique: async () => row,
    create: async ({ data }: { data: Row }) => { if (row) throw new Error('duplicate'); row = data; return data; },
    updateMany: async ({ where, data }: { where: Partial<Row>; data: Partial<Row> }) => {
      if (!row || Object.entries(where).some(([key, value]) => !same(row?.[key as keyof Row], value))) return { count: 0 };
      row = { ...row, ...data };
      return { count: 1 };
    },
  } } as unknown as typeof prisma;
  return { db, read: () => row };
}

test('one shared probe is cached across provider instances and refreshed after expiry', async () => {
  const { db } = healthStore();
  let current = new Date('2026-09-29T12:00:00Z');
  let calls = 0;
  const fetcher = async () => { calls += 1; return new Response(JSON.stringify({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'OK' }] }] }), { status: 200 }); };
  const options = { db, fetcher: fetcher as typeof fetch, now: () => current, apiKey: 'test-key', model: 'test-model' };
  const first = createWorkoutLlm(options);
  const second = createWorkoutLlm(options);
  assert.equal(await first.getStatus(), 'available');
  assert.equal(await second.getStatus(), 'available');
  assert.equal(calls, 1);
  current = new Date(current.getTime() + 16 * 60_000);
  assert.equal(await second.getStatus(), 'available');
  assert.equal(calls, 2);
});

test('concurrent instances claim a single provider probe', async () => {
  const { db } = healthStore();
  let calls = 0;
  const gateControl = { release: () => {} };
  const gate = new Promise<void>((resolve) => { gateControl.release = () => resolve(); });
  const fetcher = async () => {
    calls += 1;
    await gate;
    return new Response(JSON.stringify({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'OK' }] }] }), { status: 200 });
  };
  const options = { db, fetcher: fetcher as typeof fetch, apiKey: 'test-key', model: 'test-model' };
  const first = createWorkoutLlm(options).getStatus();
  const second = createWorkoutLlm(options).getStatus();
  assert.equal(await second, 'checking');
  assert.equal(calls, 1);
  gateControl.release();
  assert.equal(await first, 'available');
});

test('missing key requires no database read or model request', async () => {
  const llm = createWorkoutLlm({ apiKey: '', db: { aiProviderHealth: { findUnique: async () => { throw new Error('should not read'); } } } as unknown as typeof prisma, fetcher: (async () => { throw new Error('should not call'); }) as typeof fetch });
  assert.equal(await llm.getStatus(), 'unavailable');
});

test('provider failure is cached and a config change triggers one new probe', async () => {
  const { db } = healthStore();
  let calls = 0;
  const fetcher = async () => { calls += 1; return new Response('{}', { status: calls === 1 ? 401 : 200 }); };
  const first = createWorkoutLlm({ db, fetcher: fetcher as typeof fetch, apiKey: 'old-key', model: 'test-model' });
  assert.equal(await first.getStatus(), 'unavailable');
  assert.equal(await first.getStatus(), 'unavailable');
  assert.equal(calls, 1);
  const nextFetcher = async () => { calls += 1; return new Response(JSON.stringify({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'OK' }] }] }), { status: 200 }); };
  const second = createWorkoutLlm({ db, fetcher: nextFetcher as typeof fetch, apiKey: 'new-key', model: 'test-model' });
  assert.equal(await second.getStatus(), 'available');
  assert.equal(calls, 2);
});

test('custom chat-completions provider sends a full-workout request and accepts its own blocks', async () => {
  const { db } = healthStore();
  const sent: Array<{ url: string; body: Record<string, unknown>; key: string | null }> = [];
  const plan = { title: 'Tempo waves', summary: 'Three varied efforts.', reason: 'Matches requested steady intervals.', blocks: [
    { kind: 'warmup', zone: 1, durationSec: 480, note: '' },
    { kind: 'work', zone: 3, durationSec: 240, note: '' },
    { kind: 'recovery', zone: 1, durationSec: 60, note: '' },
    { kind: 'work', zone: 3, durationSec: 300, note: '' },
    { kind: 'recovery', zone: 1, durationSec: 120, note: '' },
    { kind: 'work', zone: 2, durationSec: 300, note: '' },
    { kind: 'cooldown', zone: 1, durationSec: 300, note: '' },
  ] };
  const fetcher = async (url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    sent.push({ url: String(url), body, key: new Headers(init?.headers).get('Authorization') });
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: sent.length === 1 ? 'OK' : JSON.stringify(plan) } }] }), { status: 200 });
  };
  const llm = createWorkoutLlm({ db, fetcher: fetcher as typeof fetch, apiKey: 'custom-key', model: 'model-name', apiUrl: 'https://llm.example.test/v1/chat/completions', apiFormat: 'chat-completions' });
  const result = await llm.generate({ sport: 'BIKING', durationMinutes: 30, intensity: 'steady', intervals: true }, { completedLast7Days: 0, completedLast28Days: 0, sameSportLast28Days: 0, sameSportMedianMinutes: null, recentHighRpeDaysAgo: null, importedLast28Days: 0 }, null);
  assert.equal(result?.draft.title, plan.title);
  assert.equal(result?.draft.blocks.length, 7);
  assert.equal(sent.length, 2);
  assert.equal(sent[1].url, 'https://llm.example.test/v1/chat/completions');
  assert.equal(sent[1].key, 'Bearer custom-key');
  assert.deepEqual(sent[1].body.response_format, { type: 'json_object' });
  assert.equal(JSON.stringify(sent[1].body).includes('performanceProfileJson'), false);
});

test('Responses provider requests structured full-workout output and caches invalid generations as unavailable', async () => {
  const { db, read } = healthStore();
  const sent: Record<string, unknown>[] = [];
  const fetcher = async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
    sent.push(body);
    const text = sent.length === 1 ? 'OK' : '{"title":"Broken","summary":"Too short","reason":"No blocks","blocks":[]}';
    return new Response(JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text }] }] }), { status: 200 });
  };
  const llm = createWorkoutLlm({ db, fetcher: fetcher as typeof fetch, apiKey: 'test-key', model: 'gpt-4o-mini' });
  const history = { completedLast7Days: 0, completedLast28Days: 0, sameSportLast28Days: 0, sameSportMedianMinutes: null, recentHighRpeDaysAgo: null, importedLast28Days: 0 };
  const request = { sport: 'RUNNING' as const, durationMinutes: 30 as const, intensity: 'easy' as const, intervals: false };
  assert.equal(await llm.generate(request, history, null), null);
  assert.equal(sent.length, 2);
  assert.equal(sent[1].store, false);
  assert.equal((sent[1].text as { format: { type: string } }).format.type, 'json_schema');
  assert.equal((read() as Row | null)?.status, 'unavailable');
  assert.equal(await llm.generate(request, history, null), null);
  assert.equal(sent.length, 2);
});
