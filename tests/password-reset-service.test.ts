import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.ts';
import { createPasswordResetService, getPasswordResetEmailConfig } from '../lib/password-reset-service.ts';

type ResetRecord = {
  userId: number;
  tokenHash: string;
  expiresAt: Date;
  windowStartedAt: Date;
  requestCount: number;
  lastSentAt: Date;
};

function harness(now = new Date('2026-09-27T12:00:00.000Z')) {
  let currentNow = now;
  const user = { id: 7, email: 'Athlete@Example.com', passwordHash: '$2b$12$existing', sessionVersion: 0 };
  let resetRecord: ResetRecord | null = null;
  let storedPasswordHash = user.passwordHash;
  const emailBodies: Array<{ to: string[]; text: string }> = [];

  const transaction = {
    user: {
      findFirst: async () => user,
      update: async ({ data }: { where: { id: number }; data: { passwordHash: string; sessionVersion?: { increment: number } } }) => {
        storedPasswordHash = data.passwordHash;
        if (data.sessionVersion) user.sessionVersion += data.sessionVersion.increment;
        return user;
      },
    },
    passwordResetToken: {
      findUnique: async ({ where }: { where: { userId?: number; tokenHash?: string } }) => {
        if (where.userId !== undefined && resetRecord?.userId === where.userId) return resetRecord;
        if (where.tokenHash !== undefined && resetRecord?.tokenHash === where.tokenHash) return resetRecord;
        return null;
      },
      create: async ({ data }: { data: ResetRecord }) => {
        resetRecord = { ...data };
        return resetRecord;
      },
      update: async ({ where, data }: {
        where: { userId: number };
        data: {
          tokenHash: string;
          expiresAt: Date;
          lastSentAt: Date;
          windowStartedAt?: Date;
          requestCount: number | { increment: number };
        };
      }) => {
        assert.equal(resetRecord?.userId, where.userId);
        resetRecord = {
          ...resetRecord!,
          ...data,
          requestCount: typeof data.requestCount === 'number'
            ? data.requestCount
            : resetRecord!.requestCount + data.requestCount.increment,
          windowStartedAt: data.windowStartedAt ?? resetRecord!.windowStartedAt,
        };
        return resetRecord;
      },
      deleteMany: async ({ where }: { where: { userId: number; tokenHash: string; expiresAt: { gt: Date } } }) => {
        if (
          resetRecord?.userId === where.userId &&
          resetRecord.tokenHash === where.tokenHash &&
          resetRecord.expiresAt > where.expiresAt.gt
        ) {
          resetRecord = null;
          return { count: 1 };
        }
        return { count: 0 };
      },
    },
  };

  const db = {
    ...transaction,
    $transaction: async <Result>(operation: (tx: unknown) => Promise<Result>) => operation(transaction),
  } as unknown as typeof prisma;

  const service = createPasswordResetService({
    db,
    environment: {
      AUTH_URL: 'http://localhost:3000',
      NODE_ENV: 'test',
      RESEND_API_KEY: 'test-key',
      PASSWORD_RESET_FROM_EMAIL: 'Wattonaut <accounts@example.com>',
    },
    now: () => currentNow,
    fetcher: async (_url, init) => {
      emailBodies.push(JSON.parse(String(init?.body)) as { to: string[]; text: string });
      return new Response(null, { status: 202 });
    },
  });

  return {
    service,
    emailBodies,
    setNow(value: Date) { currentNow = value; },
    get resetRecord() { return resetRecord; },
    get storedPasswordHash() { return storedPasswordHash; },
    get sessionVersion() { return user.sessionVersion; },
  };
}

test('password recovery stores only a short-lived token hash and emails a one-time link', async () => {
  const testHarness = harness();
  const result = await testHarness.service.requestReset(' ATHLETE@example.COM ');
  assert.equal(result, 'sent');
  assert.equal(testHarness.emailBodies.length, 1);

  const link = testHarness.emailBodies[0]!.text.match(/https?:\/\/\S+/)?.[0];
  assert.ok(link);
  const token = new URL(link).searchParams.get('token');
  assert.ok(token);
  assert.equal(token.length, 43);
  assert.notEqual(testHarness.resetRecord?.tokenHash, token);
  assert.equal(testHarness.resetRecord?.tokenHash, createHash('sha256').update(token).digest('hex'));
  assert.equal(testHarness.resetRecord?.expiresAt.getTime(), Date.parse('2026-09-27T12:30:00.000Z'));
});

test('password recovery enforces a one-minute cooldown and three requests per hour', async () => {
  const testHarness = harness();
  assert.equal(await testHarness.service.requestReset('athlete@example.com'), 'sent');
  assert.equal(await testHarness.service.requestReset('athlete@example.com'), 'rate-limited');
  testHarness.setNow(new Date('2026-09-27T12:01:00.000Z'));
  assert.equal(await testHarness.service.requestReset('athlete@example.com'), 'sent');
  testHarness.setNow(new Date('2026-09-27T12:02:00.000Z'));
  assert.equal(await testHarness.service.requestReset('athlete@example.com'), 'sent');
  testHarness.setNow(new Date('2026-09-27T12:03:00.000Z'));
  assert.equal(await testHarness.service.requestReset('athlete@example.com'), 'rate-limited');
  assert.equal(testHarness.emailBodies.length, 3);
});

test('password reset consumes a valid token once and updates the password hash', async () => {
  const testHarness = harness();
  await testHarness.service.requestReset('athlete@example.com');
  const link = testHarness.emailBodies[0]!.text.match(/https?:\/\/\S+/)?.[0];
  assert.ok(link);
  const token = new URL(link).searchParams.get('token');
  assert.ok(token);

  assert.equal(await testHarness.service.completeReset(token, 'new-safe-password'), true);
  assert.equal(await bcrypt.compare('new-safe-password', testHarness.storedPasswordHash), true);
  assert.equal(testHarness.sessionVersion, 1);
  assert.equal(await testHarness.service.completeReset(token, 'new-safe-password'), false);
});

test('password recovery rejects insecure production URLs and overlong bcrypt passwords', async () => {
  const testHarness = harness();
  assert.equal(testHarness.service.isConfigured(), true);
  assert.equal(getPasswordResetEmailConfig({
    AUTH_URL: 'http://tempo.example',
    NODE_ENV: 'production',
    RESEND_API_KEY: 'test-key',
    PASSWORD_RESET_FROM_EMAIL: 'Wattonaut <accounts@example.com>',
  }), null);
  assert.equal(await testHarness.service.completeReset('x'.repeat(43), 'x'.repeat(73)), false);
});
