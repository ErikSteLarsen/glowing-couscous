import test from 'node:test';
import assert from 'node:assert/strict';
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
});
