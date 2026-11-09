import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { createAthleteService } from '../lib/athlete-service.ts';
import { getActivityHref, parseActivityFilters } from '../lib/activity-navigation.ts';

test('activity navigation validates query values and preserves filters between pages', () => {
  assert.deepEqual(parseActivityFilters({ page: ['2'], q: ['run'], sport: 'CYCLING' }), { page: 1, query: '', sport: null });
  for (const page of ['-1', '0', '1.5', 'Infinity', '99999999999999']) {
    assert.equal(parseActivityFilters({ page }).page, 1);
  }
  const filters = parseActivityFilters({ page: '2', q: '  hills & tempo  ', sport: 'RUNNING' });
  const url = new URL(getActivityHref(filters, 3), 'http://localhost');
  assert.equal(url.searchParams.get('q'), 'hills & tempo');
  assert.equal(url.searchParams.get('sport'), 'RUNNING');
  assert.equal(url.searchParams.get('page'), '3');
  assert.equal(getActivityHref(parseActivityFilters({})), '/athlete/activity');
});

test('activity history pages and filtered totals retain outcomes and athlete isolation in SQLite', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'tempo-history-'));
  const databaseUrl = `file:${path.join(directory, 'test.db')}`;
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    execFileSync(process.execPath, [
      path.join(process.cwd(), 'node_modules/prisma/build/index.js'),
      'db', 'push', '--skip-generate', '--schema', path.join(process.cwd(), 'prisma/schema.prisma'),
    ], { env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'pipe' });
    const athlete = await db.user.create({ data: { email: 'history@example.test', role: 'ATHLETE' } });
    const other = await db.user.create({ data: { email: 'foreign@example.test', role: 'ATHLETE' } });
    const coach = await db.user.create({ data: { email: 'coach@example.test', role: 'COACH' } });
    for (let index = 0; index < 27; index++) {
      const running = index % 2 === 0;
      const owner = index === 26 ? other.id : athlete.id;
      await db.session.create({ data: {
        athleteId: owner,
        sport: running ? 'RUNNING' : 'BIKING',
        title: `${running ? 'Endurance' : 'Ride'} ${index}`,
        source: 'athlete-planner',
        status: 'completed',
        activity: { create: {
          athleteId: owner,
          completedAt: new Date('2026-11-09T10:00:00Z'),
          durationSec: running ? 600 : 1200,
          tss: running ? 10 : 20,
          zoneDistributionJson: '{}',
          segmentsJson: '[]',
          notes: `Saved outcome ${index}`,
        } },
      } });
    }
    const service = createAthleteService({ db });

    await t.test('every completion is reachable with stable ordering even for tied timestamps', async () => {
      const first = await service.loadActivityFeed(athlete.id);
      const second = await service.loadActivityFeed(athlete.id, parseActivityFilters({ page: '2' }));
      const third = await service.loadActivityFeed(athlete.id, parseActivityFilters({ page: '3' }));
      assert.ok(first && second && third);
      assert.equal(first.count, 26);
      assert.deepEqual(first.totals, { durationSec: 23400, tss: 390 });
      assert.deepEqual(second.totals, first.totals);
      assert.equal(first.activities.length, 12);
      assert.equal(second.activities.length, 12);
      assert.equal(third.activities.length, 2);
      const all = [...first.activities, ...second.activities, ...third.activities];
      assert.equal(new Set(all.map((item) => item.id)).size, 26);
      assert.equal(all[0].title, 'Ride 25');
      assert.equal(all[25].title, 'Endurance 0');
      assert.equal(all[25].notes, 'Saved outcome 0');
    });

    await t.test('sport and name filters apply to all totals and pages', async () => {
      const feed = await service.loadActivityFeed(athlete.id, parseActivityFilters({ q: 'endurance', sport: 'RUNNING', page: '2' }));
      assert.ok(feed);
      assert.equal(feed.count, 13);
      assert.deepEqual(feed.totals, { durationSec: 7800, tss: 130 });
      assert.equal(feed.activities.length, 1);
      assert.equal(feed.activities[0].title, 'Endurance 0');
      assert.equal(feed.page, 2);
    });

    await t.test('empty results and stale pages stay valid without revealing other athletes', async () => {
      const empty = await service.loadActivityFeed(athlete.id, parseActivityFilters({ q: 'Endurance 26' }));
      assert.ok(empty);
      assert.equal(empty.count, 0);
      assert.deepEqual(empty.totals, { durationSec: 0, tss: 0 });
      const stale = await service.loadActivityFeed(athlete.id, parseActivityFilters({ page: '999999999' }));
      assert.ok(stale);
      assert.equal(stale.page, 3);
      assert.equal(stale.activities.length, 2);
      assert.equal(await service.loadActivityFeed(coach.id), null);
      assert.equal(await service.loadActivityFeed(9999), null);
    });
  } finally {
    await db.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
});
