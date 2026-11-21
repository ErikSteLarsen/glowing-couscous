import assert from 'node:assert/strict';
import test from 'node:test';
import { getSafeCallbackPath, loginPathFor } from '../lib/auth-callback.ts';

test('ride pages survive the sign-in round trip', () => {
  assert.equal(getSafeCallbackPath('/athlete/ride/42'), '/athlete/ride/42');
  assert.equal(getSafeCallbackPath('/athlete/ride/42?from=calendar'), '/athlete/ride/42?from=calendar');
  assert.equal(getSafeCallbackPath('/athlete/ride'), '/athlete/ride');
  assert.equal(loginPathFor('/athlete/ride/42?from=today'), '/login?callbackUrl=%2Fathlete%2Fride%2F42%3Ffrom%3Dtoday');
});

test('share continuations are still allowed', () => {
  const token = 'd'.repeat(43);
  assert.equal(getSafeCallbackPath(`/share/${token}?action=planner`), `/share/${token}?action=planner`);
});

test('other or foreign callbacks are dropped', () => {
  for (const value of [
    null, '', 'athlete/ride/1', '//evil.example/athlete/ride/1', '/\\evil.example/athlete/ride/1',
    'https://evil.example/athlete/ride/1', '/athlete/ride/0', '/athlete/ride/abc', '/athlete/ride/1/extra',
    '/athlete', '/coach', '/api/auth/signout',
  ]) {
    assert.equal(getSafeCallbackPath(value), null, String(value));
  }
  assert.equal(getSafeCallbackPath('/athlete/ride/1?from=https://evil.example'), '/athlete/ride/1');
  assert.equal(loginPathFor('/athlete/settings'), '/login');
});
