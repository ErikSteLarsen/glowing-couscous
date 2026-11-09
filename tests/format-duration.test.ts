import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDuration } from '../lib/format-duration.ts';

test('duration labels retain short intervals and second remainders across hour boundaries', () => {
  assert.equal(formatDuration(0), '0m');
  assert.equal(formatDuration(20), '20s');
  assert.equal(formatDuration(59), '59s');
  assert.equal(formatDuration(60), '1m');
  assert.equal(formatDuration(90), '1m 30s');
  assert.equal(formatDuration(3599), '59m 59s');
  assert.equal(formatDuration(3600), '1h 00m');
  assert.equal(formatDuration(3661), '1h 01m 1s');
});
