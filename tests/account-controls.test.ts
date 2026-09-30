import test from 'node:test';
import assert from 'node:assert/strict';
import { createAccountService } from '../lib/account-service.ts';

test('account controls expose sign-in capability without credential or provider secrets', async () => {
  const service = createAccountService({ db: { user: { async findUnique() { return { email: 'owner@example.test', passwordHash: 'secret', accounts: [{ provider: 'google', access_token: 'secret' }], stravaConnection: { athleteName: 'Runner', accessTokenEncrypted: 'secret' } }; } } } as never });
  assert.deepEqual(await service.getControls(7), { email: 'owner@example.test', hasPassword: true, providers: ['google'], strava: { connected: true, athleteName: 'Runner' } });
});

test('sign out everywhere increments only the authenticated account session version', async () => {
  let update: unknown;
  const service = createAccountService({ db: { user: { async update(args: unknown) { update = args; return { id: 7 }; } } } as never });
  await service.signOutEverywhere(7);
  assert.deepEqual(update, { where: { id: 7 }, data: { sessionVersion: { increment: 1 } }, select: { id: true } });
});
