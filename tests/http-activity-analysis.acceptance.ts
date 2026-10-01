import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const url = new URL(process.env.DATABASE_URL ?? '');
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.port !== '55432' || url.pathname !== '/tempo_acceptance') throw new Error('Requires the disposable acceptance database.');
const origin = 'http://localhost:3100';
const db = new PrismaClient();
test.after(() => db.$disconnect());
test('HTTP explicit import, worker authentication, analysis read/correction and source/owner refusal', async () => {
  const password = 'Disposable-http-analysis-password';
  const owner = await db.user.create({ data: { email: `analysis-http-${crypto.randomUUID()}@example.test`, role: 'ATHLETE', passwordHash: await bcrypt.hash(password, 4) } });
  const jar = new Map<string, string>();
  async function request(path: string, init: RequestInit = {}) {
    const response = await fetch(origin + path, { ...init, redirect: 'manual', headers: { Cookie: [...jar].map(([k,v]) => `${k}=${v}`).join('; '), ...init.headers } });
    for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(';')[0], at = pair.indexOf('='); jar.set(pair.slice(0, at), pair.slice(at + 1)); }
    return response;
  }
  try {
    assert.equal((await fetch(origin + '/api/activity-imports/1/analysis')).status, 401);
    assert.equal((await fetch(origin + '/api/activity-analysis/worker')).status, 401);
    const csrf = await (await request('/api/auth/csrf')).json() as { csrfToken: string };
    await request('/api/auth/callback/credentials', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Auth-Return-Redirect': '1' }, body: new URLSearchParams({ csrfToken: csrf.csrfToken, email: owner.email, password, callbackUrl: origin + '/athlete' }).toString() });
    const input = { title: 'HTTP run', sport: 'RUNNING', startedAt: '2026-10-01T11:00:00Z', durationSec: 120, distanceMeters: 360, elevationGainMeters: null,
      points: Array.from({ length: 121 }, (_, elapsedSec) => ({ elapsedSec, distanceMeters: elapsedSec * 3 })) };
    const imported = await request('/api/activity-imports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    assert.equal(imported.status, 201);
    const activity = await imported.json() as { activityId: number; sessionId: number };
    assert.equal(await db.activityAnalysis.findUnique({ where: { activityId: activity.activityId } }), null); // not opted in
    assert.equal((await request(`/api/activity-imports/${activity.activityId}/analysis`, { method: 'POST' })).status, 202);
    for (let i = 0; i < 30; i++) {
      if ((await db.activityAnalysis.findUnique({ where: { activityId: activity.activityId } }))?.status === 'completed') break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const read = await request(`/api/activity-imports/${activity.activityId}/analysis`);
    assert.equal(read.status, 200);
    const view = await read.json() as { result: { workSummary: { paceSecPerKm: number } }; status: string };
    assert.equal(view.status, 'completed'); assert.equal(view.result.workSummary.paceSecPerKm, 1000 / 3);
    assert.equal((await request(`/api/activity-imports/${activity.activityId}/analysis`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ repetitions: 4, durationSec: 240, recoverySec: 120, paceSecPerKm: 250 }) })).status, 200);
    assert.equal((await request(`/athlete/session/${activity.sessionId}`)).status, 200);
    await db.activity.update({ where: { id: activity.activityId }, data: { metricsSource: 'strava-import', externalSource: 'STRAVA' } });
    assert.equal((await request(`/api/activity-imports/${activity.activityId}/analysis`, { method: 'POST' })).status, 400);
    const foreign = await db.activity.findFirst({ where: { athleteId: { not: owner.id } } });
    if (foreign) assert.equal((await request(`/api/activity-imports/${foreign.id}/analysis`)).status, 404);
    const worker = await fetch(origin + '/api/activity-analysis/worker', { method: 'POST', headers: { Authorization: 'Bearer disposable-analysis-worker' } });
    assert.equal(worker.status, 200);
  } finally { await db.user.deleteMany({ where: { id: owner.id } }); }
});
