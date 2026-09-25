import test from 'node:test';
import assert from 'node:assert/strict';
import { createAthleteService } from '../lib/athlete-service.ts';

function createDetailService(sourceSession: Record<string, unknown>) {
  const session = {
    id: 42,
    athleteId: 7,
    date: new Date('2026-09-25T07:00:00.000Z'),
    timeLabel: '07:00',
    title: 'Threshold repeats',
    summary: 'Steady and controlled.',
    sport: 'RUNNING',
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
          return { id: 7, role: 'ATHLETE', coachId: null, selfCoached: true, name: 'Mara' };
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
