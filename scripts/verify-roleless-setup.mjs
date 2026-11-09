import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const base = new URL(process.argv[2] ?? 'http://localhost:3100');
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(base.hostname), 'Use a local test server.');
const db = new PrismaClient();
const cookies = new Map();
let user;

async function request(path, options = {}) {
  const response = await fetch(new URL(path, base), {
    ...options,
    redirect: 'manual',
    headers: { ...options.headers, Cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; ') },
  });
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(';')[0];
    const separator = pair.indexOf('=');
    const name = pair.slice(0, separator);
    const value = pair.slice(separator + 1);
    if (value) cookies.set(name, value);
    else cookies.delete(name);
  }
  return response;
}

try {
  const password = randomUUID();
  user = await db.user.create({ data: {
    email: `qa-roleless-${randomUUID()}@demo.local`,
    name: 'Roleless setup regression',
    passwordHash: await bcrypt.hash(password, 4),
  } });
  const csrf = await (await request('/api/auth/csrf')).json();
  const signedIn = await request('/api/auth/callback/credentials', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'X-Auth-Return-Redirect': '1' },
    body: new URLSearchParams({ email: user.email, password, csrfToken: csrf.csrfToken, callbackUrl: new URL('/setup', base).href }),
  });
  assert.equal(signedIn.status, 200, 'Credentials sign-in succeeds.');
  assert.equal((await request('/setup')).status, 200, 'The roleless account can open setup.');
  const session = await (await request('/api/auth/session')).json();
  assert.equal(Number(session?.user?.id), user.id, 'Setup navigation must retain the authenticated session.');
  for (const role of ['ATHLETE', 'ATHLETE', 'COACH']) {
    const result = await request('/api/auth/setup', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }),
    });
    assert.equal(result.status, role === 'COACH' ? 409 : 200, 'Same-role retry succeeds; role switching is rejected.');
  }
  const updated = await (await request('/api/auth/session', { method: 'POST',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ csrfToken: csrf.csrfToken, data: { role: 'ATHLETE' } }),
  })).json();
  assert.equal(updated.user.role, 'ATHLETE', 'Session refresh reads the persisted role.');
  assert.equal((await request('/athlete')).status, 200, 'The personal workspace is accessible.');
  assert.equal((await request('/coach')).status, 307, 'The athlete cannot enter the coach workspace.');
  console.log('Roleless sign-in, setup, same-role retry, and role boundaries passed.');
} finally {
  if (user) await db.user.delete({ where: { id: user.id } });
  await db.$disconnect();
}
