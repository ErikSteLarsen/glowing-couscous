import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, startOfDay } from 'date-fns';
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

test('Home surfaces only overdue self-planned sessions and keeps today as the next action', async () => {
  const today = startOfDay(new Date());
  const todaySession = session(10, '', false, today);
  const overdueSession = session(11, '', false, addDays(today, -1));
  const coachSession = session(12, '', false, addDays(today, -1), { coachOwnerId: 2 });
  const planSession = session(13, '', false, addDays(today, -7), { trainingPlanId: 4 });
  const completedSession = session(14, '', true, addDays(today, -7));
  const overdueQueries: Array<{ where: Record<string, unknown>; take: number }> = [];

  const service = createAthleteService({
    db: {
      user: { async findUnique() {
        return {
          id: 7, role: 'ATHLETE', name: 'Mara', prefsJson: null,
          coach: null, activities: [], sessions: [todaySession],
        };
      } },
      session: { async findMany(args: { where: Record<string, unknown>; take: number }) {
        overdueQueries.push(args);
        return [overdueSession, coachSession, planSession, completedSession];
      } },
      activity: { async findMany() { return []; } },
    } as never,
  });

  const dashboard = await service.loadHomeDashboard(7);

  assert.ok(dashboard);
  assert.deepEqual(dashboard.overdue.map((item) => item.id), [11]);
  assert.equal(dashboard.overdue[0].isOverdue, true);
  assert.deepEqual(dashboard.todaySessions.map((item) => item.id), [10]);
  assert.equal(dashboard.todaySessions[0].isOverdue, false);
  assert.equal(overdueQueries.length, 1);
  const [overdueQuery] = overdueQueries;
  assert.equal(overdueQuery.take, 3);
  assert.deepEqual(overdueQuery.where, {
    athleteId: 7,
    date: { lt: startOfDay(new Date()) },
    status: { notIn: ['completed', 'skipped'] },
    coachOwnerId: null,
    assignedById: null,
    trainingPlanId: null,
    activity: { is: null },
  });
});
