import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createAuthRoleService } from '../lib/auth-role-service.ts';
import { parseSessionPrincipal } from '../lib/auth-principal.ts';

const root = process.cwd();

async function read(relativePath: string) {
  return readFile(path.join(root, relativePath), 'utf8');
}

test('role setup assigns only a roleless user', async () => {
  let role: string | null = null;
  const service = createAuthRoleService({
    db: {
      user: {
        async updateMany(args) {
          assert.deepEqual(args.where, { id: 7, role: null });
          if (role !== null) return { count: 0 };
          role = args.data.role;
          return { count: 1 };
        },
        async findUnique() {
          return role === null ? null : { role };
        },
      },
    },
  });

  assert.deepEqual(await service.assignRole(7, 'ATHLETE'), { ok: true, role: 'ATHLETE' });
  assert.deepEqual(await service.assignRole(7, 'COACH'), {
    ok: false,
    status: 409,
    error: 'Role is already set',
  });
  assert.equal(role, 'ATHLETE');
});

test('same-role setup retries succeed without rewriting an assigned role', async () => {
  let writes = 0;
  const service = createAuthRoleService({
    db: {
      user: {
        async updateMany(args) {
          assert.deepEqual(args.where, { id: 7, role: null });
          writes += 1;
          return { count: 0 };
        },
        async findUnique() {
          return { role: 'ATHLETE' };
        },
      },
    },
  });

  assert.deepEqual(await service.assignRole(7, 'ATHLETE'), { ok: true, role: 'ATHLETE' });
  assert.deepEqual(await service.assignRole(7, 'ATHLETE'), { ok: true, role: 'ATHLETE' });
  assert.deepEqual(await service.assignRole(7, 'COACH'), { ok: false, status: 409, error: 'Role is already set' });
  assert.equal(writes, 3, 'every write remains conditional on the account having no role');
});

test('role setup returns not found when the account no longer exists', async () => {
  const service = createAuthRoleService({
    db: {
      user: {
        async updateMany() { return { count: 0 }; },
        async findUnique() { return null; },
      },
    },
  });

  assert.deepEqual(await service.assignRole(7, 'ATHLETE'), { ok: false, status: 404, error: 'User not found' });
});

test('competing role setup requests resolve to one winner', async () => {
  let role: string | null = null;
  const service = createAuthRoleService({
    db: {
      user: {
        async updateMany(args) {
          if (role !== null) return { count: 0 };
          role = args.data.role;
          return { count: 1 };
        },
        async findUnique() {
          return { role };
        },
      },
    },
  });

  const results = await Promise.all([
    service.assignRole(7, 'ATHLETE'),
    service.assignRole(7, 'COACH'),
  ]);

  assert.equal(results.filter((result) => result.ok).length, 1);
  assert.equal(results.filter((result) => !result.ok && result.status === 409).length, 1);
  assert.ok(role === 'ATHLETE' || role === 'COACH');
});

test('principal parsing rejects malformed IDs and roles', () => {
  assert.equal(parseSessionPrincipal({ id: 0, role: 'COACH' }), null);
  assert.equal(parseSessionPrincipal({ id: '1.5', role: 'COACH' }), null);
  assert.equal(parseSessionPrincipal({ id: 1, role: 'ADMIN' }), null);
  assert.deepEqual(parseSessionPrincipal({ id: '1', role: null }), {
    id: 1,
    role: null,
    name: '',
    email: '',
  });
});

test('auth role setup keeps the adapter and account-linking contracts explicit', async () => {
  const schema = await read('prisma/schema.prisma');
  const auth = await read('auth.ts');
  const route = await read('app/api/auth/setup/route.ts');
  const middleware = await read('proxy.ts');

  assert.match(schema, /name\s+String\?/);
  assert.match(schema, /role\s+String\?/);
  assert.match(schema, /emailVerified\s+DateTime\?/);
  assert.match(schema, /image\s+String\?/);
  assert.match(schema, /sessionVersion\s+Int\s+@default\(0\)/);
  assert.doesNotMatch(auth, /allowDangerousEmailAccountLinking/);
  assert.match(route, /authRoleService\.assignRole/);
  assert.match(await read('lib/auth-role-service.ts'), /updateMany/);
  assert.match(route, /status: result\.status/);
  assert.match(middleware, /pathname === '\/setup'/);
  assert.match(middleware, /parseApplicationUserId\(user\?\.id\)/);
  assert.match(middleware, /authConfig/);
  assert.doesNotMatch(middleware, /from ['"]@\/auth['"]/);
  assert.doesNotMatch(middleware, /pathname === '\/login' \|\| pathname === '\/signup'/);
  const edgeConfig = await read('auth.config.ts');
  assert.doesNotMatch(edgeConfig, /@prisma\/client|@\/lib\/prisma|PrismaAdapter/);
});
