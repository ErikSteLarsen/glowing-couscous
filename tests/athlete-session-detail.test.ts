import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, startOfDay } from 'date-fns';
import { createAthleteService } from '../lib/athlete-service.ts';

function createDetailService(sourceSession: Record<string, unknown>, blockOverrides: Record<string, unknown> = {}, performanceProfileJson: string | null = null, sport = 'RUNNING') {
  const session = {
    id: 42,
    athleteId: 7,
    date: new Date('2026-09-25T07:00:00.000Z'),
    timeLabel: '07:00',
    title: 'Threshold repeats',
    summary: 'Steady and controlled.',
    sport,
    status: 'planned',
    adjusted: false,
    activity: null,
    blocks: [
      {
        id: 420,
        kind: 'work',
        zone: 4,
        durationSec: 300,
        reps: null,
        targetType: 'pace',
        targetMode: 'absolute',
        targetReference: null,
        targetLow: 240,
        targetHigh: 250,
        note: 'Stay smooth.',
        skipped: false,
        sortOrder: 0,
        ...blockOverrides,
      },
    ],
    athlete: { id: 7, name: 'Mara', coach: null },
    assignments: [{ sourceSession }],
    athleteNotes: '',
  };

  return createAthleteService({
    db: {
      user: {
        async findUnique() {
          return { id: 7, role: 'ATHLETE', coachId: null, selfCoached: true, name: 'Mara', performanceProfileJson };
        },
      },
      session: {
        async findUnique() {
          return session;
        },
      },
    } as never,
  });
}

test('session detail exposes an edit link only for the athlete-owned reusable source workout', async () => {
  const ownedSource = {
    id: 13,
    title: 'My threshold workout',
    athleteId: 7,
    coachOwnerId: null,
    date: null,
    planId: null,
    trainingPlanId: null,
    activity: null,
  };

  const ownedDetail = await createDetailService(ownedSource).loadSessionDetail(7, 42);
  assert.equal(ownedDetail?.session.sourceWorkout?.id, 13);
  assert.equal(ownedDetail?.session.sourceWorkout?.title, 'My threshold workout');

  const coachSource = await createDetailService({
    ...ownedSource,
    athleteId: null,
    coachOwnerId: 3,
  }).loadSessionDetail(7, 42);
  assert.equal(coachSource?.session.sourceWorkout, null);
});

test('session inspector formats pace with sport units and relative HR with the athlete profile', async () => {
  const running = await createDetailService({}).loadSessionDetail(7, 42);
  assert.equal(running?.session.blocks[0].targetLabel, '4:00-4:10 /km');
  const swimming = await createDetailService({}, { targetLow: 90, targetHigh: 100 }, null, 'SWIMMING').loadSessionDetail(7, 42);
  assert.equal(swimming?.session.blocks[0].targetLabel, '1:30-1:40 /100 m');
  const relative = { targetType: 'hr', targetMode: 'relative', targetReference: 'max-hr', targetLow: 82, targetHigh: 87 };
  const profile = JSON.stringify({ heartRateMaxBpm: 200 });
  const heartRate = await createDetailService({}, relative, profile).loadSessionDetail(7, 42);
  assert.equal(heartRate?.session.blocks[0].targetLabel, '165-174 bpm');
  assert.equal(heartRate?.session.blocks[0].targetBasis, '82-87% Olympiatoppen HRmax');
  const missing = await createDetailService({}, relative).loadSessionDetail(7, 42);
  assert.equal(missing?.session.blocks[0].targetLabel, '82-87% Olympiatoppen HRmax');

function service(
  activityNotes: string | null = null,
  timeLabel: string | null = '08:00',
  date = new Date('2026-11-10T08:00:00'),
  ownership: { coachOwnerId?: number; assignedById?: number; trainingPlanId?: number } = {},
) {
  return createAthleteService({ db: {
    user: { async findUnique() { return { id: 7, role: 'ATHLETE', selfCoached: true, coachId: null }; } },
    session: { async findUnique() { return {
      id: 42, athleteId: 7, date, title: 'Personal repeats', sport: 'BIKING',
      summary: null, status: 'planned', adjusted: false, timeLabel, athleteNotes: 'Bring water',
      assignments: [],
      athlete: { id: 7, name: 'Mara', coach: null },
      activity: activityNotes === null ? null : { notes: activityNotes, tss: 30, durationSec: 1200, metricsSource: 'manual-planned' },
      blocks: [{ id: 3, kind: 'work', zone: 3, durationSec: 300, reps: 4, targetType: 'power',
        targetMode: 'relative', targetReference: 'ftp', targetLow: 90, targetHigh: 100,
        targetLowDecimal: '90.5', targetHighDecimal: null, note: null, skipped: false, sortOrder: 0 }],
      ...ownership,
    }; } },
  } as never });
}

test('personal session detail preserves planned notes and uses canonical target labels', async () => {
  const detail = await service().loadSessionDetail(7, 42);
  assert.ok(detail);
  assert.equal(detail.session.notes, 'Bring water');
  assert.equal(detail.session.targetLabel, '90.5-100% FTP');
  assert.equal(detail.session.timeLabel, '08:00');
  assert.equal(detail.session.blocks[0].targetLabel, '90.5-100% FTP');
  assert.equal(detail.session.editor.mode, 'planned');
  assert.equal(detail.session.durationSec, 1200);
  assert.equal(detail.session.canDelete, true);
});

test('personal session detail preserves a missing scheduled time', async () => {
  const detail = await service(null, null).loadSessionDetail(7, 42);
  assert.ok(detail);
  assert.equal(detail.session.timeLabel, null);
});

test('past self-planned detail reports missed status while remaining startable', async () => {
  const date = addDays(startOfDay(new Date()), -1);
  const detail = await service(null, '08:00', date).loadSessionDetail(7, 42);

  assert.ok(detail);
  assert.equal(detail.session.status, 'planned');
  assert.equal(detail.session.isOverdue, true);
  assert.equal(detail.session.compliance, 'missed');
});

test('past coach-assigned detail is not marked overdue for personal recovery', async () => {
  const date = addDays(startOfDay(new Date()), -1);
  const detail = await service(null, '08:00', date, { coachOwnerId: 2 }).loadSessionDetail(7, 42);

  assert.ok(detail);
  assert.equal(detail.session.isOverdue, false);
});

test('completing a past session removes its overdue state and missed compliance', async () => {
  const date = addDays(startOfDay(new Date()), -1);
  const detail = await service('Completed late', '08:00', date).loadSessionDetail(7, 42);

  assert.ok(detail);
  assert.equal(detail.session.status, 'completed');
  assert.equal(detail.session.isOverdue, false);
  assert.notEqual(detail.session.compliance, 'missed');
});

test('completed notes take precedence, including an explicitly cleared note', async () => {
  for (const notes of ['Felt smooth', '']) {
    const detail = await service(notes).loadSessionDetail(7, 42);
    assert.ok(detail);
    assert.equal(detail.session.notes, notes);
    assert.equal(detail.session.editor.mode, 'actual');
    assert.equal(detail.session.canDelete, false);
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
  assert.equal(calendar.days.flatMap((day) => day.sessions)[0].canReschedule, true);
});
