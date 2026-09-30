// Run against the local production server backed exclusively by the disposable DB.
import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { createShareLinkService } from '../lib/share-link-service.ts';

const database = new URL(process.env.DATABASE_URL ?? '');
if (!['localhost', '127.0.0.1'].includes(database.hostname) || database.port !== '55432' || database.pathname !== '/tempo_acceptance') throw new Error('HTTP acceptance requires the named disposable local database and localhost:3100 server.');
const origin = 'http://localhost:3100';

test('HTTP deletion: signed-session identity, cross-site rejection, retained public preview and expired old cookie', async () => {
  const db = new PrismaClient();
  const password = 'Disposable-http-password';
  const owner = await db.user.create({ data: { email: `http-${crypto.randomUUID()}@example.test`, role: 'ATHLETE', selfCoached: true, passwordHash: await bcrypt.hash(password, 4) } });
  let linkId: number | null = null;
  const jar = new Map<string, string>();
  async function request(path: string, init: RequestInit = {}) {
    const response = await fetch(origin + path, { ...init, redirect: 'manual', headers: { Cookie: [...jar].map(([key, value]) => `${key}=${value}`).join('; '), ...init.headers } });
    for (const cookie of response.headers.getSetCookie()) {
      const [pair] = cookie.split(';'); const separator = pair.indexOf('=');
      jar.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
    return response;
  }
  try {
    const source = await db.session.create({ data: { athleteId: owner.id, sport: 'RUNNING', title: 'PRIVATE_HTTP_NAME', source: 'personal', blocks: { create: { kind: 'work', zone: 2, durationSec: 300, sortOrder: 0 } } } });
    const share = await createShareLinkService({ db }).createForUser(owner.id, 'session', source.id); assert.ok(share.ok);
    linkId = (await db.shareLink.findFirstOrThrow({ where: { sessionId: source.id } })).id;
    const csrf = await (await request('/api/auth/csrf')).json() as { csrfToken: string };
    const login = await request('/api/auth/callback/credentials', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Auth-Return-Redirect': '1' }, body: new URLSearchParams({ csrfToken: csrf.csrfToken, email: owner.email, password, callbackUrl: origin + '/profile' }).toString() });
    assert.equal(login.status, 200);
    assert.equal((await request('/api/account/deletion')).status, 200);
    assert.equal((await request('/api/account/export')).status, 404);
    const body = JSON.stringify({ confirmation: 'DELETE', password });
    assert.equal((await request('/api/account/deletion', { method: 'DELETE', headers: { Origin: 'https://attacker.invalid', 'Content-Type': 'application/json' }, body })).status, 403);
    assert.ok(await db.user.findUnique({ where: { id: owner.id } }));
    const wrong = await request('/api/account/deletion', { method: 'DELETE', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ confirmation: 'DELETE', password: 'wrong', userId: owner.id + 1, authenticatedAt: Date.now(), signInProvider: 'google' }) });
    assert.equal(wrong.status, 403); assert.ok(await db.user.findUnique({ where: { id: owner.id } }));
    const deletion = await request('/api/account/deletion', { method: 'DELETE', headers: { Origin: origin, 'Content-Type': 'application/json' }, body });
    assert.equal(deletion.status, 200); assert.deepEqual(await deletion.json(), { ok: true, providerRevoked: null });
    assert.equal(await db.user.findUnique({ where: { id: owner.id } }), null);
    const preview = await fetch(origin + share.url); const html = await preview.text();
    assert.equal(preview.status, 200); assert.ok(html.includes('[deleted]')); assert.equal(html.includes('PRIVATE_HTTP_NAME'), false); assert.equal(html.includes(owner.email), false);
    assert.equal((await request('/api/account/deletion')).status, 401);
    assert.equal((await request('/api/account/deletion', { method: 'DELETE', headers: { Origin: origin, 'Content-Type': 'application/json' }, body })).status, 401);
  } finally {
    if (linkId !== null) await db.shareLink.deleteMany({ where: { id: linkId } });
    await db.user.deleteMany({ where: { id: owner.id } });
    await db.$disconnect();
  }
});
