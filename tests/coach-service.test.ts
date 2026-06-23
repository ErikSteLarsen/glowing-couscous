import test from 'node:test';
import assert from 'node:assert/strict';

import { createCoachService } from '../lib/coach-service.ts';

test('coach service shapes athlete detail with prior-week history and planned weekly tss', async () => {
  const sessionQueries: Array<{ date?: { lt?: Date } }> = [];

  const db = {
    user: {
      async findFirst(args: { where: { id: number; coachId: number; role: string } }) {
        assert.deepEqual(args.where, { id: 5, coachId: 2, role: 'ATHLETE' });

        return {
          id: 5,
          name: 'Mara Holt',
          email: 'mara@tempo.test',
          plans: [
            {
              name: 'Summer block',
              goalRace: 'Half Marathon',
              endDate: new Date('2026-08-02T00:00:00.000Z'),
            },
          ],
          coach: {
            name: 'Erik Krogh',
          },
        };
      },
    },
    session: {
      async findMany(args: {
        where: Record<string, unknown>;
        include: { blocks: { orderBy: { sortOrder: 'asc' } }; activity: true };
        orderBy: { date: 'asc' | 'desc' };
        take?: number;
      }) {
        sessionQueries.push(args.where as { date?: { lt?: Date } });

        if (args.orderBy.date === 'asc') {
          return [
            {
              id: 11,
              title: 'Threshold build',
              sport: 'RUNNING',
              date: new Date('2026-06-24T07:00:00.000Z'),
              status: 'planned',
              adjusted: false,
              blocks: [
                {
                  id: 1,
                  kind: 'work',
                  zone: 3,
                  durationSec: 1800,
                  reps: null,
                  targetType: 'pace',
                  targetLow: 240,
                  targetHigh: 250,
                  sortOrder: 0,
                },
              ],
              activity: {
                durationSec: 2100,
                tss: 42,
                compliancePct: 88,
                completedAt: new Date('2026-06-24T08:00:00.000Z'),
              },
            },
          ];
        }

        return [
          {
            id: 22,
            title: 'Long run',
            sport: 'RUNNING',
            date: new Date('2026-06-15T08:00:00.000Z'),
            status: 'completed',
            adjusted: false,
            blocks: [
              {
                id: 2,
                kind: 'work',
                zone: 2,
                durationSec: 3600,
                reps: null,
                targetType: null,
                targetLow: null,
                targetHigh: null,
                sortOrder: 0,
              },
            ],
            activity: {
              durationSec: 3650,
              tss: 51,
              compliancePct: 95,
              completedAt: new Date('2026-06-15T09:10:00.000Z'),
            },
          },
        ];
      },
    },
  };

  const coachService = createCoachService({
    db: db as never,
    now: () => new Date('2026-06-24T12:00:00.000Z'),
  });

  const detail = await coachService.getAthleteDetail(2, 5);

  assert.ok(detail);
  const previousWeekQuery = sessionQueries[1];
  assert.equal(previousWeekQuery.date?.lt instanceof Date, true);
  assert.equal(
    previousWeekQuery.date?.lt?.toISOString(),
    new Date('2026-06-22T00:00:00.000+02:00').toISOString(),
  );
  assert.equal(detail.stats.plannedTss, 36);
  assert.equal(detail.stats.weekTss, 42);
  assert.equal(detail.week.days.flatMap((day) => day.sessions).some((session) => session.id === 11), true);
  assert.equal(detail.recentSessions.length, 1);
  assert.equal(detail.recentSessions[0].id, 22);
});

test('coach service can confirm whether an athlete belongs to a coach roster', async () => {
  const db = {
    user: {
      async findFirst(args: { where: { id: number; coachId: number; role: string } }) {
        assert.equal(args.where.coachId, 2);
        assert.equal(args.where.role, 'ATHLETE');
        return args.where.id === 5 ? { id: 5 } : null;
      },
    },
  };

  const coachService = createCoachService({
    db: db as never,
    now: () => new Date('2026-06-24T12:00:00.000Z'),
  });

  assert.equal(await coachService.hasAthlete(2, 5), true);
  assert.equal(await coachService.hasAthlete(2, 6), false);
});
