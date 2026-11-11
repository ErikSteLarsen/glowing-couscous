import test from 'node:test';
import assert from 'node:assert/strict';
import { formatSessionWhen } from '../lib/session-display.ts';

test('session date labels omit the clock when a session has no scheduled time', () => {
  const date = new Date(2026, 10, 2, 12);

  assert.equal(formatSessionWhen(date, null), 'Mon 2 Nov');
  assert.equal(formatSessionWhen(date, '08:15'), 'Mon 2 Nov · 08:15');
});
