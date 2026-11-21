import test from 'node:test';
import assert from 'node:assert/strict';
import { startOfDay } from 'date-fns';
import { createAthleteService } from '../lib/athlete-service.ts';

function session(
  id: number,
  coachNotes: string,
  completed = false,
  date = new Date(),
  ownership: { coachOwnerId?: number; trainingPlanId?: number } = {},
) {
  return {
    id, title: `Session ${id}`, summary: null, sport: 'RUNNING', date,
    timeLabel: null, status: completed ? 'completed' : 'planned', adjusted: false,
    coachNotes, blocks: [],
    activity: completed ? { tss: 20, durationSec: 1800, metricsSource: 'manual', segmentsJson: null } : null,
    ...ownership,
  };
}

for (const nextNote of ['Evening instructions', '']) {
  test(`Home coach note belongs to next open session (${nextNote ? 'with note' : 'without note'})`, async () => {
    const service = createAthleteService({
      db: { user: { async findUnique() {
        return {
          id: 7, role: 'ATHLETE', name: 'Mara', prefsJson: null,
          coach: { id: 2, name: 'Coach', email: 'coach@example.com' }, activities: [],
          sessions: [session(1, 'Completed morning instructions', true), session(2, nextNote)],
        };
      } }, session: { async findMany() { return []; } }, activity: { async findMany() { return []; } } } as never,
    });
    const dashboard = await service.loadHomeDashboard(7);
    assert.ok(dashboard);
    assert.deepEqual(dashboard.coachNote, nextNote ? { sessionTitle: 'Session 2', text: nextNote } : null);
    assert.equal(dashboard.todaySessions.find((item) => item.id === 2)?.timeLabel, null, 'sessions without a scheduled time remain untimed on Home');
  });
}

test('Home keeps today as the next action without querying earlier open sessions', async () => {
  const today = startOfDay(new Date());
  const sessionQueries: unknown[] = [];

  const service = createAthleteService({
    db: {
      user: { async findUnique() {
        return {
          id: 7, role: 'ATHLETE', name: 'Mara', prefsJson: null,
          coach: null, activities: [], sessions: [session(10, '', false, today)],
        };
      } },
      session: { async findMany(args: unknown) {
        sessionQueries.push(args);
        return [];
      } },
      activity: { async findMany() { return []; } },
    } as never,
  });

  const dashboard = await service.loadHomeDashboard(7);

  assert.ok(dashboard);
  assert.equal('overdue' in dashboard, false);
  assert.deepEqual(dashboard.todaySessions.map((item) => item.id), [10]);
  assert.equal(dashboard.todaySessions[0].isOverdue, false);
  assert.equal(sessionQueries.length, 0);
});
