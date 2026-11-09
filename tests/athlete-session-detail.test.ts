import test from 'node:test';
import assert from 'node:assert/strict';
import { createAthleteService } from '../lib/athlete-service.ts';

function service(activityNotes: string | null = null) {
  return createAthleteService({ db: {
    user: { async findUnique() { return { id: 7, role: 'ATHLETE', selfCoached: true, coachId: null }; } },
    session: { async findUnique() { return {
      id: 42, athleteId: 7, date: new Date('2026-11-10T08:00:00'), title: 'Personal repeats', sport: 'BIKING',
      summary: null, status: 'planned', adjusted: false, timeLabel: '08:00', athleteNotes: 'Bring water',
      athlete: { id: 7, name: 'Mara', coach: null },
      activity: activityNotes === null ? null : { notes: activityNotes, tss: 30, durationSec: 1200, metricsSource: 'manual-planned' },
      blocks: [{ id: 3, kind: 'work', zone: 3, durationSec: 300, reps: 4, targetType: 'power',
        targetMode: 'relative', targetReference: 'ftp', targetLow: 90, targetHigh: 100,
        targetLowDecimal: '90.5', targetHighDecimal: null, note: null, skipped: false, sortOrder: 0 }],
    }; } },
  } as never });
}

test('personal session detail preserves planned notes and uses canonical target labels', async () => {
  const detail = await service().loadSessionDetail(7, 42);
  assert.ok(detail);
  assert.equal(detail.session.notes, 'Bring water');
  assert.equal(detail.session.targetLabel, '90.5-100% FTP');
  assert.equal(detail.session.blocks[0].targetLabel, '90.5-100% FTP');
  assert.equal(detail.session.editor.mode, 'planned');
  assert.equal(detail.session.durationSec, 1200);
});

test('completed notes take precedence, including an explicitly cleared note', async () => {
  for (const notes of ['Felt smooth', '']) {
    const detail = await service(notes).loadSessionDetail(7, 42);
    assert.ok(detail);
    assert.equal(detail.session.notes, notes);
    assert.equal(detail.session.editor.mode, 'actual');
  }
});

test('session detail does not expose another athlete session', async () => {
  assert.equal(await service().loadSessionDetail(8, 42), null);
});

test('shared calendar summary skips omitted targets and preserves relative decimals', async () => {
  const session = {
    id: 42, title: 'Personal repeats', summary: null, sport: 'BIKING', date: new Date('2026-11-10T08:00:00'),
    timeLabel: '08:00', status: 'planned', adjusted: false, activity: null,
    blocks: [
      { id: 1, kind: 'warmup', zone: 1, durationSec: 300, reps: null, targetType: 'power', targetMode: 'absolute',
        targetReference: null, targetLow: 100, targetHigh: 120, targetLowDecimal: null, targetHighDecimal: null,
        note: null, skipped: true, sortOrder: 0 },
      { id: 2, kind: 'work', zone: 4, durationSec: 300, reps: 4, targetType: 'power', targetMode: 'relative',
        targetReference: 'ftp', targetLow: 90, targetHigh: 100, targetLowDecimal: '90.5', targetHighDecimal: null,
        note: null, skipped: false, sortOrder: 1 },
    ],
  };
  const athlete = createAthleteService({ db: { user: { async findUnique() {
    return { id: 7, role: 'ATHLETE', name: 'Mara', coach: null, sessions: [session] };
  } } } as never });
  const calendar = await athlete.loadCalendarView(7, '2026-11-10', 'week');
  assert.ok(calendar);
  assert.equal(calendar.days.flatMap((day) => day.sessions)[0].targetLabel, '90.5-100% FTP');
});
