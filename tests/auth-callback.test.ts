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

test('the Send to Tempo window survives the sign-in round trip with its validated query', () => {
  const link = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ&t=5s';
  const path = `/athlete/ride/send?u=${encodeURIComponent(link)}&t=83`;
  assert.equal(getSafeCallbackPath(path), path);
  // A send key never survives into a callback; after sign-in the window asks before sending.
  assert.equal(getSafeCallbackPath(`/athlete/ride/send?k=0f8e0f4c-7c1e-4d5e-9b0a-2f6c7d8e9f01&u=${encodeURIComponent(link)}&t=83`), path);
  assert.equal(loginPathFor(path), `/login?callbackUrl=${encodeURIComponent(path)}`);
  // Unknown parameters and malformed t or k are dropped; the link stays.
  assert.equal(
    getSafeCallbackPath(`/athlete/ride/send?u=${encodeURIComponent(link)}&t=1e3&k=no&next=/coach`),
    `/athlete/ride/send?u=${encodeURIComponent(link)}`,
  );
  // Without a link it is the bookmark setup page.
  assert.equal(getSafeCallbackPath('/athlete/ride/send?next=/coach'), '/athlete/ride/send');
  // Any other link is dropped.
  for (const value of [
    `/athlete/ride/send?u=${encodeURIComponent('https://evil.example/watch?v=aqz-KE-bpKQ')}`,
    '/athlete/ride/send?u=javascript:alert(1)',
    `/athlete/ride/send/extra?u=${encodeURIComponent(link)}`,
  ]) {
    assert.equal(getSafeCallbackPath(value), null, value);
  }
});
