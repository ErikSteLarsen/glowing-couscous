import assert from 'node:assert/strict';
import test from 'node:test';
import { createActivityImportService, validateActivityImport } from '../lib/activity-import-service.ts';

const validInput = {
  title: 'Morning run',
  sport: 'RUNNING',
  startedAt: '2026-09-25T10:00:00.000Z',
  durationSec: 1800,
  distanceMeters: 5000,
  elevationGainMeters: 45,
  points: [
    { elapsedSec: 0, distanceMeters: 0, heartRateBpm: 120, speedMetersPerSecond: 2.8, elevationMeters: 80 },
    { elapsedSec: 60, distanceMeters: 160, heartRateBpm: 140, speedMetersPerSecond: 2.9, elevationMeters: 82 },
  ],
  plannedSessionId: null,
};
const inboxFetchedAt = new Date('2026-09-26T10:00:00.000Z');

test('validates and canonicalizes activity import data', () => {
  const result = validateActivityImport(validInput);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.value.startedAt, '2026-09-25T10:00:00.000Z');
  assert.equal(result.value.points.length, 2);
});

test('rejects out-of-order sensor samples and unsafe values', () => {
  const outOfOrder = validateActivityImport({
    ...validInput,
    points: [...validInput.points].reverse(),
  });
  assert.equal(outOfOrder.ok, false);

  const invalidHeartRate = validateActivityImport({
    ...validInput,
    points: [{ elapsedSec: 0, heartRateBpm: 1000 }],
  });
  assert.equal(invalidHeartRate.ok, false);
});

test('requires real start time, a supported sport, and bounded payload sizes', () => {
  assert.equal(validateActivityImport({ ...validInput, startedAt: 'yesterday' }).ok, false);
  assert.equal(validateActivityImport({ ...validInput, sport: 'STRAVA' }).ok, false);
  assert.equal(validateActivityImport({ ...validInput, points: [] }).ok, false);
  assert.equal(validateActivityImport({ ...validInput, durationSec: 0 }).ok, false);
});

test('imports into a selected unfinished session without replacing its planned workout', async () => {
  const calls: Array<{ owner: string; args: Record<string, unknown> }> = [];
  const service = createActivityImportService({
    db: fakeDatabase(calls, {
      findFirst: async (args) => {
        calls.push({ owner: 'session.findFirst', args: args as Record<string, unknown> });
        return { id: 27, status: 'planned', sport: 'RUNNING' };
      },
    }) as never,
  });
  const result = await service.importForUser(7, { ...validInput, plannedSessionId: 27 });

  assert.deepEqual(result, { ok: true, activityId: 71, sessionId: 27, duplicate: false });
  assert.deepEqual(calls.find((call) => call.owner === 'session.updateMany')?.args, {
    where: { id: 27, status: 'planned', activity: { is: null } },
    data: { status: 'completed' },
  });
  const activity = calls.find((call) => call.owner === 'activity.create')?.args as { data: Record<string, unknown> };
  assert.equal(activity.data.sessionId, 27);
  assert.equal(activity.data.athleteId, 7);
  assert.equal(activity.data.metricsSource, 'file-import');
  assert.equal(activity.data.importedSessionStatus, 'planned');
  assert.equal(typeof activity.data.telemetryJson, 'string');
  const lookup = calls.find((call) => call.owner === 'session.findFirst')?.args as { where: Record<string, unknown> };
  assert.deepEqual(lookup.where, {
    id: 27,
    athleteId: 7,
    sport: 'RUNNING',
    date: { not: null },
    status: { not: 'completed' },
    activity: { is: null },
  });
});

test('creates a new completed session with its activity in one transaction', async () => {
  const calls: Array<{ owner: string; args: Record<string, unknown> }> = [];
  const service = createActivityImportService({ db: fakeDatabase(calls) as never });
  const result = await service.importForUser(7, validInput);

  assert.deepEqual(result, { ok: true, activityId: 71, sessionId: 27, duplicate: false });
  const created = calls.find((call) => call.owner === 'session.create')?.args as { data: Record<string, unknown> };
  assert.equal(created.data.athleteId, 7);
  assert.equal(created.data.source, 'activity-import');
  assert.equal(created.data.status, 'completed');
  assert.equal((created.data.activity as { create: Record<string, unknown> }).create.metricsSource, 'file-import');
});

const powerProfile = JSON.stringify({ cycling: { ftpWatts: 250 } });
const steadyHour = {
  ...validInput,
  title: 'Indoor ride',
  sport: 'BIKING',
  startedAt: '2026-11-15T23:45:00.000Z',
  finishedAt: '2026-11-16T00:45:00.000Z',
  durationSec: 3600,
  distanceMeters: null,
  elevationGainMeters: null,
  points: Array.from({ length: 360 }, (_, index) => ({ elapsedSec: index * 10, powerWatts: 250 })),
};

function createdActivity(calls: Array<{ owner: string; args: Record<string, unknown> }>) {
  const created = calls.find((call) => call.owner === 'session.create')?.args as { data: { activity: { create: Record<string, unknown> } } };
  return created.data.activity.create;
}

test('saves power-based load for a ride without heart rate (250 W for an hour at 250 W FTP is 100 TSS)', async () => {
  const calls: Array<{ owner: string; args: Record<string, unknown> }> = [];
  const service = createActivityImportService({ db: fakeDatabase(calls, { performanceProfileJson: powerProfile }) as never });
  assert.equal((await service.importForUser(7, steadyHour)).ok, true);
  assert.equal(createdActivity(calls).tss, 100);
});

test('stores unavailable load as null rather than a measured zero', async () => {
  const calls: Array<{ owner: string; args: Record<string, unknown> }> = [];
  const service = createActivityImportService({ db: fakeDatabase(calls) as never });
  assert.equal((await service.importForUser(7, steadyHour)).ok, true);
  assert.equal(createdActivity(calls).tss, null);
});

test('falls back to heart-rate load when there is no FTP', async () => {
  const calls: Array<{ owner: string; args: Record<string, unknown> }> = [];
  const service = createActivityImportService({ db: fakeDatabase(calls, { performanceProfileJson: JSON.stringify({ heartRateMaxBpm: 190 }) }) as never });
  const points = steadyHour.points.map((point) => ({ ...point, heartRateBpm: 150 }));
  assert.equal((await service.importForUser(7, { ...steadyHour, points })).ok, true);
  const tss = createdActivity(calls).tss as number;
  assert.ok(tss > 0 && tss !== 100, `expected a heart-rate estimate, got ${tss}`);
});

test('a ride crossing midnight completes at its finish time, not its start', async () => {
  const calls: Array<{ owner: string; args: Record<string, unknown> }> = [];
  const service = createActivityImportService({ db: fakeDatabase(calls) as never });
  assert.equal((await service.importForUser(7, steadyHour)).ok, true);
  const activity = createdActivity(calls);
  assert.equal((activity.startedAt as Date).toISOString(), '2026-11-15T23:45:00.000Z');
  assert.equal((activity.completedAt as Date).toISOString(), '2026-11-16T00:45:00.000Z');
});

test('imports without a finish time complete at start plus duration, like device-file imports', async () => {
  const calls: Array<{ owner: string; args: Record<string, unknown> }> = [];
  const service = createActivityImportService({ db: fakeDatabase(calls) as never });
  assert.equal((await service.importForUser(7, validInput)).ok, true);
  assert.equal((createdActivity(calls).completedAt as Date).toISOString(), '2026-09-25T10:30:00.000Z');
});

test('rejects a finish time before the start, shorter than the duration, or implausibly late', () => {
  for (const finishedAt of ['2026-11-15T23:00:00.000Z', '2026-11-16T00:30:00.000Z', '2026-11-18T00:00:00.000Z', 'not a date', 42]) {
    assert.equal(validateActivityImport({ ...steadyHour, finishedAt }).ok, false, String(finishedAt));
  }
  assert.equal(validateActivityImport({ ...steadyHour, finishedAt: undefined }).ok, true);
});

test('imports Strava provenance with a locked connection and only approved summary metadata', async () => {
  const calls: Array<{ owner: string; args: Record<string, unknown> }> = [];
  const service = createActivityImportService({ db: fakeDatabase(calls) as never });
  const result = await service.importForUser(7, validInput, {
    sourceProvider: 'STRAVA',
    connectionId: 'connection-1',
    expectedInboxFetchedAt: inboxFetchedAt,
    externalActivityId: '123',
    metadata: {
      sportType: 'TrailRun',
      timezone: 'Europe/Oslo',
      averageHeartrate: 144,
      startLatLng: [59.9, 10.7],
      description: 'private note',
    },
  });

  assert.deepEqual(result, { ok: true, activityId: 71, sessionId: 27, duplicate: false });
  const created = calls.find((call) => call.owner === 'session.create')?.args as { data: { activity: { create: Record<string, unknown> } } };
  const importedActivity = created.data.activity.create;
  assert.equal(importedActivity.externalSource, 'STRAVA');
  assert.equal(importedActivity.externalActivityId, '123');
  assert.deepEqual(JSON.parse(String(importedActivity.sourceMetadataJson)), {
    sportType: 'TrailRun', timezone: 'Europe/Oslo', averageHeartrate: 144,
  });
});

test('rejects a Strava review whose inbox data changed before import', async () => {
  const calls: Array<{ owner: string; args: Record<string, unknown> }> = [];
  const service = createActivityImportService({
    db: fakeDatabase(calls, { findInbox: async () => ({ fetchedAt: new Date('2026-09-26T10:00:01.000Z') }) }) as never,
  });
  const result = await service.importForUser(7, validInput, {
    sourceProvider: 'STRAVA',
    connectionId: 'connection-1',
    expectedInboxFetchedAt: inboxFetchedAt,
    externalActivityId: '123',
  });

  assert.deepEqual(result, { ok: false, status: 409, error: 'This Strava activity has changed. Open it again to see the latest version.' });
  assert.equal(calls.some((call) => call.owner === 'session.create'), false);
});

test('refuses a planned-session match that changed before import', async () => {
  const calls: Array<{ owner: string; args: Record<string, unknown> }> = [];
  const service = createActivityImportService({
    db: fakeDatabase(calls, { findFirst: async () => null }) as never,
  });
  const result = await service.importForUser(7, { ...validInput, plannedSessionId: 27 });

  assert.deepEqual(result, { ok: false, status: 409, error: 'That planned workout is no longer available for this sport.' });
  assert.equal(calls.some((call) => call.owner === 'activity.create'), false);
});

test('confirms the existing ride when a concurrent save completes its session', async () => {
  let saved = false;
  const db = fakeDatabase([], {
    findFirst: async () => {
      saved = true;
      return null;
    },
    findActivityFirst: async () => saved ? { id: 71, sessionId: 27 } : null,
  });
  const service = createActivityImportService({ db: db as never });
  const result = await service.importForUser(7, { ...validInput, sport: 'BIKING', plannedSessionId: 27 });
  assert.deepEqual(result, { ok: true, activityId: 71, sessionId: 27, duplicate: true });
});

test('lists imported history and match candidates only for the signed-in owner and scheduled sessions', async () => {
  const calls: Array<{ owner: string; args: Record<string, unknown> }> = [];
  const db = fakeDatabase(calls);
  db.activity.findMany = async (args: unknown) => { calls.push({ owner: 'activity.findMany', args: args as Record<string, unknown> }); return []; };
  db.session.findMany = async (args: unknown) => { calls.push({ owner: 'session.findMany', args: args as Record<string, unknown> }); return []; };
  const service = createActivityImportService({ db: db as never });

  await service.listForUser(7);

  const activityQuery = calls.find((call) => call.owner === 'activity.findMany')?.args as { where: Record<string, unknown>; select: Record<string, unknown> };
  assert.deepEqual(activityQuery.where, { athleteId: 7, metricsSource: { in: ['file-import', 'strava-import'] } });
  const activitySelect = activityQuery.select as Record<string, unknown>;
  assert.equal(activitySelect.sourceMetadataJson, true);
  const sessionQuery = calls.find((call) => call.owner === 'session.findMany')?.args as { where: Record<string, unknown> };
  assert.deepEqual(sessionQuery.where, {
    athleteId: 7,
    date: { not: null },
    status: { not: 'completed' },
    activity: { is: null },
  });
});

test('removes imported measurements and restores a matched session to its prior state', async () => {
  const calls: Array<{ owner: string; args: Record<string, unknown> }> = [];
  const db = fakeDatabase(calls, {
    findActivityFirst: async (args) => {
      calls.push({ owner: 'activity.findFirst', args: args as Record<string, unknown> });
      return {
        id: 71,
        sessionId: 27,
        importedSessionStatus: 'adjusted',
        session: { id: 27, athleteId: 7, source: 'planner' },
      };
    },
  });
  const service = createActivityImportService({ db: db as never });

  const result = await service.deleteImportedActivityForUser(7, 71);

  assert.deepEqual(result, { ok: true, deletedSession: false });
  assert.deepEqual(calls.find((call) => call.owner === 'activity.findFirst')?.args, {
    where: { id: 71, athleteId: 7, metricsSource: { in: ['file-import', 'strava-import'] } },
    select: { id: true, sessionId: true, importedSessionStatus: true, session: { select: { id: true, athleteId: true, source: true } } },
  });
  assert.deepEqual(calls.find((call) => call.owner === 'activity.delete')?.args, { where: { id: 71 } });
  assert.deepEqual(calls.find((call) => call.owner === 'session.update')?.args, {
    where: { id: 27 },
    data: { status: 'adjusted' },
  });
});

test('removes a standalone imported session when its activity is deleted', async () => {
  const calls: Array<{ owner: string; args: Record<string, unknown> }> = [];
  const db = fakeDatabase(calls, {
    findActivityFirst: async () => ({
      id: 71,
      sessionId: 27,
      importedSessionStatus: null,
      session: { id: 27, athleteId: 7, source: 'activity-import' },
    }),
  });
  const service = createActivityImportService({ db: db as never });

  const result = await service.deleteImportedActivityForUser(7, 71);

  assert.deepEqual(result, { ok: true, deletedSession: true });
  assert.deepEqual(calls.find((call) => call.owner === 'session.delete')?.args, { where: { id: 27 } });
  assert.equal(calls.some((call) => call.owner === 'activity.delete'), false);
});

test('restores a re-imported standalone session when the activity was matched to it', async () => {
  const calls: Array<{ owner: string; args: Record<string, unknown> }> = [];
  const db = fakeDatabase(calls, {
    findActivityFirst: async () => ({
      id: 71,
      sessionId: 27,
      importedSessionStatus: 'planned',
      session: { id: 27, athleteId: 7, source: 'activity-import' },
    }),
  });
  const service = createActivityImportService({ db: db as never });

  const result = await service.deleteImportedActivityForUser(7, 71);

  assert.deepEqual(result, { ok: true, deletedSession: false });
  assert.deepEqual(calls.find((call) => call.owner === 'session.update')?.args, {
    where: { id: 27 },
    data: { status: 'planned' },
  });
  assert.equal(calls.some((call) => call.owner === 'session.delete'), false);
});

test('does not delete an import if its linked session belongs to a different user', async () => {
  const calls: Array<{ owner: string; args: Record<string, unknown> }> = [];
  const db = fakeDatabase(calls, {
    findActivityFirst: async () => ({
      id: 71,
      sessionId: 27,
      importedSessionStatus: null,
      session: { id: 27, athleteId: 99, source: 'activity-import' },
    }),
  });
  const service = createActivityImportService({ db: db as never });

  const result = await service.deleteImportedActivityForUser(7, 71);

  assert.deepEqual(result, { ok: false, status: 404, error: 'Activity not found.' });
  assert.equal(calls.some((call) => call.owner === 'session.delete'), false);
});

function fakeDatabase(
  calls: Array<{ owner: string; args: Record<string, unknown> }>,
  overrides: {
    findFirst?: (args: unknown) => Promise<{ id: number; status: string; sport: string } | null>;
    findActivityFirst?: (args: unknown) => Promise<Record<string, unknown> | null>;
    findInbox?: (args: unknown) => Promise<{ fetchedAt: Date } | null>;
    performanceProfileJson?: string | null;
  } = {},
) {
  const session = {
    findMany: async (_args: unknown) => [],
    findFirst: overrides.findFirst ?? (async () => ({ id: 27, status: 'planned', sport: 'RUNNING' })),
    update: async (args: unknown) => { calls.push({ owner: 'session.update', args: args as Record<string, unknown> }); return {}; },
    updateMany: async (args: unknown) => { calls.push({ owner: 'session.updateMany', args: args as Record<string, unknown> }); return { count: 1 }; },
    delete: async (args: unknown) => { calls.push({ owner: 'session.delete', args: args as Record<string, unknown> }); return {}; },
    create: async (args: unknown) => { calls.push({ owner: 'session.create', args: args as Record<string, unknown> }); return { id: 27, activity: { id: 71 } }; },
  };
  const activity = {
    findMany: async (_args: unknown) => [],
    findFirst: overrides.findActivityFirst ?? (async () => null),
    create: async (args: unknown) => { calls.push({ owner: 'activity.create', args: args as Record<string, unknown> }); return { id: 71 }; },
    delete: async (args: unknown) => { calls.push({ owner: 'activity.delete', args: args as Record<string, unknown> }); return {}; },
  };
  return {
    user: { findUnique: async () => ({ performanceProfileJson: overrides.performanceProfileJson ?? null }) },
    session,
    activity,
    $transaction: async <T>(operation: (transaction: { session: typeof session; activity: typeof activity; stravaInboxActivity: { findUnique: (args: unknown) => Promise<{ fetchedAt: Date } | null> }; $queryRaw: () => Promise<Array<{ id: string }>> }) => Promise<T>) => operation({
      session,
      activity,
      stravaInboxActivity: { findUnique: async (args: unknown) => {
        calls.push({ owner: 'stravaInboxActivity.findUnique', args: args as Record<string, unknown> });
        return overrides.findInbox ? overrides.findInbox(args) : { fetchedAt: inboxFetchedAt };
      } },
      $queryRaw: async () => [{ id: 'connection-1' }],
    }),
  };
}

function fingerprintedDatabase(calls: Array<{ owner: string; args: Record<string, unknown> }>, saved: Map<string, { id: number; sessionId: number }>) {
  const db = fakeDatabase(calls, {
    performanceProfileJson: powerProfile,
    findActivityFirst: async (args) => saved.get((args as { where: { importFingerprint: string } }).where.importFingerprint) ?? null,
  });
  const create = db.session.create;
  db.session.create = async (args: unknown) => {
    const fingerprint = (args as { data: { activity: { create: { importFingerprint: string } } } }).data.activity.create.importFingerprint;
    if (saved.has(fingerprint)) throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
    saved.set(fingerprint, { id: 71, sessionId: 27 });
    return create(args);
  };
  return db;
}

test('saving an orphaned ride twice creates one standalone activity with power load and its finish time', async () => {
  const calls: Array<{ owner: string; args: Record<string, unknown> }> = [];
  const service = createActivityImportService({ db: fingerprintedDatabase(calls, new Map()) as never });
  const [first, second] = await Promise.all([service.importForUser(7, steadyHour), service.importForUser(7, steadyHour)]);
  const retry = await service.importForUser(7, steadyHour);
  assert.deepEqual([first, second, retry].map((result) => result.ok && [result.activityId, result.sessionId]), [[71, 27], [71, 27], [71, 27]]);
  assert.deepEqual([first, second, retry].filter((result) => result.ok && !result.duplicate).length, 1);
  assert.equal(calls.filter((call) => call.owner === 'session.create').length, 1);
  const activity = createdActivity(calls);
  assert.equal(activity.tss, 100);
  assert.equal((activity.completedAt as Date).toISOString(), '2026-11-16T00:45:00.000Z');
});

test('a standalone save of a ride already saved to its planned session returns that activity', async () => {
  const calls: Array<{ owner: string; args: Record<string, unknown> }> = [];
  const saved = new Map<string, { id: number; sessionId: number }>();
  const planned = createActivityImportService({ db: fakeDatabase(calls, { findFirst: async () => ({ id: 55, status: 'planned', sport: 'BIKING' }) }) as never });
  assert.equal((await planned.importForUser(7, { ...steadyHour, plannedSessionId: 55 })).ok, true);
  const fingerprint = (calls.find((call) => call.owner === 'activity.create')?.args as { data: { importFingerprint: string } }).data.importFingerprint;
  saved.set(fingerprint, { id: 90, sessionId: 55 });
  const service = createActivityImportService({ db: fingerprintedDatabase(calls, saved) as never });
  assert.deepEqual(await service.importForUser(7, steadyHour), { ok: true, activityId: 90, sessionId: 55, duplicate: true });
});
