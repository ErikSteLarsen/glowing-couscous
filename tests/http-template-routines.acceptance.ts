// Explicit acceptance against a production server started with the disposable DB.
import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { templateDatesForSelection } from '../lib/template-period.ts';

const database = new URL(process.env.DATABASE_URL ?? '');
if (!['localhost', '127.0.0.1'].includes(database.hostname) || database.port !== '55432' || database.pathname !== '/tempo_acceptance') throw new Error('HTTP acceptance requires the named disposable local PostgreSQL database.');
const base = process.env.TEMPLATE_ACCEPTANCE_URL ?? 'http://localhost:3106';
if (!['localhost', '127.0.0.1'].includes(new URL(base).hostname)) throw new Error('HTTP acceptance requires a local test server.');
const db = new PrismaClient();

test('authenticated routes compose saved-workout routines, apply/replay them and reload the calendar without legacy intake', async () => {
  const password = crypto.randomUUID();
  const owner = await db.user.create({ data: { email: `routine-http-${crypto.randomUUID()}@example.test`, name: 'Routine acceptance', role: 'ATHLETE', passwordHash: await bcrypt.hash(password, 4) } });
  const cookies = new Map<string, string>();
  async function request(path: string, init: RequestInit = {}) {
    const response = await fetch(`${base}${path}`, { ...init, redirect: 'manual', headers: { ...init.headers, Cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; ') } });
    for (const cookie of response.headers.getSetCookie()) {
      const [name, ...parts] = cookie.split(';')[0].split('='); cookies.set(name, parts.join('='));
    }
    return response;
  }
  const post = (path: string, body: unknown) => request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    const csrf = await (await request('/api/auth/csrf')).json();
    const signedIn = await request('/api/auth/callback/credentials', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Auth-Return-Redirect': '1' }, body: new URLSearchParams({ csrfToken: csrf.csrfToken, email: owner.email, password, callbackUrl: `${base}/athlete/templates` }) });
    assert.equal(signedIn.status, 200);
    const identity = await (await request('/api/auth/session')).json();
    assert.equal(Number(identity.user.id), owner.id);
    const workout = { title: 'HTTP easy run', sport: 'RUNNING', blocks: [{ kind: 'work', zone: 1, durationSec: 1800, target: { metric: 'pace', mode: 'relative', reference: 'profile-pace-zone-1', low: 100, high: 100 } }] };
    const easyResponse = await post('/api/athlete/workouts', workout);
    assert.equal(easyResponse.status, 201);
    const easy = await easyResponse.json();
    const intervalResponse = await post('/api/athlete/workouts', { title: 'HTTP intervals', sport: 'RUNNING', blocks: [{ kind: 'work', zone: 4, durationSec: 300, reps: 4 }] });
    assert.equal(intervalResponse.status, 201);
    const intervals = await intervalResponse.json();
    const entries = [0, 2, 4].map(weekday => ({ weekday, workoutId: easy.sessionId })).concat([1, 3].map(weekday => ({ weekday, workoutId: intervals.sessionId })));
    assert.equal((await post('/api/athlete/templates', { name: 'HTTP base week', summary: 'Five predefined sessions', entries })).status, 201);
    const routine = await db.template.findFirstOrThrow({ where: { ownerId: owner.id } });
    const templatePage = await request('/athlete/templates');
    assert.equal(templatePage.status, 200);
    const templateHtml = await templatePage.text();
    assert.ok(templateHtml.includes('HTTP base week'));
    assert.ok(templateHtml.includes('HTTP intervals'));
    assert.ok(!templateHtml.includes('Legacy'));
    const input = { sourceKind: 'template', sourceId: routine.id, dates: templateDatesForSelection('week', '2026-10-05'), requestKey: crypto.randomUUID() };
    const placementResponse = await post('/api/athlete/planner/assignments', input);
    assert.equal(placementResponse.status, 201);
    const placement = await placementResponse.json();
    assert.equal(placement.sessionIds.length, 5);
    const replay = await post('/api/athlete/planner/assignments', input);
    assert.equal(replay.status, 201);
    assert.deepEqual(await replay.json(), placement);
    const calendarPage = await request('/athlete/calendar?date=2026-10-05');
    assert.equal(calendarPage.status, 200);
    const calendarHtml = await calendarPage.text();
    assert.ok(calendarHtml.includes('HTTP easy run'));
    assert.ok(calendarHtml.includes('HTTP intervals'));
    assert.equal(await db.session.count({ where: { athleteId: owner.id, date: { not: null } } }), 5);
    assert.equal((await post('/api/athlete/templates', { name: 'Retired shape', sport: 'RUNNING', blocks: workout.blocks })).status, 400);
    assert.equal((await post('/api/athlete/workouts', { ...workout, templateId: routine.id })).status, 400);
    assert.equal((await post('/api/share-links', { sourceKind: 'template', sourceId: routine.id })).status, 400);
    assert.equal((await post('/api/share-links/intake', { token: 'a'.repeat(43), action: 'template', draft: workout })).status, 400);
    assert.equal((await post('/api/coach/templates', { name: 'Retired' })).status, 404);
    const removed = await request(`/api/athlete/templates/${routine.id}`, { method: 'DELETE' });
    assert.equal(removed.status, 200);
    assert.equal(await db.session.count({ where: { athleteId: owner.id, date: { not: null } } }), 5);
  } finally {
    await db.user.delete({ where: { id: owner.id } });
    await db.$disconnect();
  }
});
