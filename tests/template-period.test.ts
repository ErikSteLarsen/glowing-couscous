import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTemplateDateRange, templateDatesForSelection, isAssignmentDate } from '../lib/template-period.ts';

test('week shortcut selects Monday through Sunday and strict validation rejects incomplete ranges', () => {
  const dates = templateDatesForSelection('week', '2026-09-17');
  assert.equal(dates[0], '2026-09-14');
  assert.equal(dates.at(-1), '2026-09-20');
  assert.equal(validateTemplateDateRange(dates, 'week'), null);
  assert.ok(validateTemplateDateRange(dates.slice(0, 1), 'week'));
  assert.ok(validateTemplateDateRange(dates.slice(0, 2), 'week'));
  assert.ok(validateTemplateDateRange([...dates.slice(0, 6), '2026-09-22'], 'week'));
  assert.ok(validateTemplateDateRange(templateDatesForSelection('week', '2026-09-17').map(d => d === '2026-09-14' ? '2026-09-21' : d).sort(), 'week'));
});

test('template handoff dates align an in-week display date to valid week and month boundaries', () => {
  const week = templateDatesForSelection('week', '2026-11-10');
  assert.deepEqual(week, ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15']);
  assert.equal(validateTemplateDateRange(week, 'week'), null);

  const month = templateDatesForSelection('month', '2026-11-10');
  assert.equal(month[0], '2026-11-01');
  assert.equal(month.at(-1), '2026-11-30');
  assert.equal(validateTemplateDateRange(month, 'month'), null);
});

test('month shortcut handles leap years, and month boundaries', () => {
  for (const [date, length] of [['2024-02-10', 29], ['2026-02-10', 28], ['2026-09-17', 30], ['2026-12-31', 31]] as const) {
    const dates = templateDatesForSelection('month', date);
    assert.equal(dates.length, length);
    assert.equal(validateTemplateDateRange(dates, 'month'), null);
  }
  for (const value of ['2026-02-30', 'garbage', 123, null, '2026-09-17T00:00:00Z']) assert.equal(isAssignmentDate(value), false);
});
