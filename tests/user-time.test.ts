import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TIME_ZONE, dayKeyInZone, endOfDayInZone, hourInZone, resolveTimeZone, startOfDayInZone, todayInZone } from '../lib/user-time.ts';

test('resolveTimeZone keeps valid IANA zones and falls back to UTC', () => {
  assert.equal(resolveTimeZone('Europe/Oslo'), 'Europe/Oslo');
  assert.equal(resolveTimeZone('America/Los_Angeles'), 'America/Los_Angeles');
  assert.equal(resolveTimeZone('Not/AZone'), DEFAULT_TIME_ZONE);
  assert.equal(resolveTimeZone(''), DEFAULT_TIME_ZONE);
  assert.equal(resolveTimeZone(undefined), DEFAULT_TIME_ZONE);
  assert.equal(resolveTimeZone('x'.repeat(65)), DEFAULT_TIME_ZONE);
});

test('today in Oslo is already the next day while UTC is still before midnight', () => {
  const now = new Date('2026-11-19T23:30:00.000Z');
  assert.equal(todayInZone('UTC', now), '2026-11-19');
  assert.equal(todayInZone('Europe/Oslo', now), '2026-11-20');
  assert.equal(hourInZone('Europe/Oslo', now), 0);
  assert.equal(todayInZone('America/New_York', new Date('2026-11-20T03:00:00.000Z')), '2026-11-19');
});

test('day boundaries are the zone midnight as UTC instants', () => {
  assert.equal(startOfDayInZone('2026-11-20', 'Europe/Oslo').toISOString(), '2026-11-19T23:00:00.000Z');
  assert.equal(endOfDayInZone('2026-11-20', 'Europe/Oslo').toISOString(), '2026-11-20T22:59:59.999Z');
  assert.equal(startOfDayInZone('2026-07-01', 'Europe/Oslo').toISOString(), '2026-06-30T22:00:00.000Z');
  assert.equal(startOfDayInZone('2026-11-20', 'UTC').toISOString(), '2026-11-20T00:00:00.000Z');
  assert.equal(startOfDayInZone('2026-11-20', 'America/Los_Angeles').toISOString(), '2026-11-20T08:00:00.000Z');
});

test('DST transition days are 23 and 25 hours long in Oslo', () => {
  // Clocks go forward at 02:00 on 29 March 2026 and back at 03:00 on 25 October 2026.
  const springStart = startOfDayInZone('2026-03-29', 'Europe/Oslo');
  const springEnd = endOfDayInZone('2026-03-29', 'Europe/Oslo');
  assert.equal(springStart.toISOString(), '2026-03-28T23:00:00.000Z');
  assert.equal(springEnd.toISOString(), '2026-03-29T21:59:59.999Z');
  assert.equal(springEnd.getTime() + 1 - springStart.getTime(), 23 * 3_600_000);

  const autumnStart = startOfDayInZone('2026-10-25', 'Europe/Oslo');
  const autumnEnd = endOfDayInZone('2026-10-25', 'Europe/Oslo');
  assert.equal(autumnStart.toISOString(), '2026-10-24T22:00:00.000Z');
  assert.equal(autumnEnd.getTime() + 1 - autumnStart.getTime(), 25 * 3_600_000);

  assert.equal(dayKeyInZone(new Date('2026-03-29T00:59:59.000Z'), 'Europe/Oslo'), '2026-03-29');
  assert.equal(dayKeyInZone(new Date('2026-10-25T22:59:59.000Z'), 'Europe/Oslo'), '2026-10-25');
  assert.equal(dayKeyInZone(new Date('2026-10-25T23:00:00.000Z'), 'Europe/Oslo'), '2026-10-26');
});

test('a zone that skips midnight starts the day at the end of the gap', () => {
  // Santiago moved clocks from 00:00 to 01:00 on 7 September 2025 (UTC-4 to UTC-3).
  const start = startOfDayInZone('2025-09-07', 'America/Santiago');
  assert.equal(start.toISOString(), '2025-09-07T04:00:00.000Z');
  assert.equal(dayKeyInZone(start, 'America/Santiago'), '2025-09-07');
  assert.equal(dayKeyInZone(new Date(start.getTime() - 1), 'America/Santiago'), '2025-09-06');
});
