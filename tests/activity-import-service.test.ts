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
  assert.deepEqual(calls.find((call) => call.owner === 'session.update')?.args, {
    where: { id: 27 },
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

  assert.deepEqual(result, { ok: false, status: 409, error: 'This Strava activity changed. Reopen it and review the latest data.' });
  assert.equal(calls.some((call) => call.owner === 'session.create'), false);
});

test('refuses a planned-session match that changed before import', async () => {
  const calls: Array<{ owner: string; args: Record<string, unknown> }> = [];
  const service = createActivityImportService({
    db: fakeDatabase(calls, { findFirst: async () => null }) as never,
  });
  const result = await service.importForUser(7, { ...validInput, plannedSessionId: 27 });

  assert.deepEqual(result, { ok: false, status: 409, error: 'That planned session is no longer available for this activity type.' });
  assert.equal(calls.some((call) => call.owner === 'activity.create'), false);
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

  assert.deepEqual(result, { ok: false, status: 404, error: 'Imported activity not found.' });
  assert.equal(calls.some((call) => call.owner === 'session.delete'), false);
});

function fakeDatabase(
  calls: Array<{ owner: string; args: Record<string, unknown> }>,
  overrides: {
    findFirst?: (args: unknown) => Promise<{ id: number; status: string; sport: string } | null>;
    findActivityFirst?: (args: unknown) => Promise<Record<string, unknown> | null>;
    findInbox?: (args: unknown) => Promise<{ fetchedAt: Date } | null>;
  } = {},
) {
  const session = {
    findMany: async (_args: unknown) => [],
    findFirst: overrides.findFirst ?? (async () => ({ id: 27, status: 'planned', sport: 'RUNNING' })),
    update: async (args: unknown) => { calls.push({ owner: 'session.update', args: args as Record<string, unknown> }); return {}; },
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
    user: { findUnique: async () => ({ performanceProfileJson: null }) },
    session,
    activity,
    $transaction: async <T>(operation: (transaction: { session: typeof session; activity: typeof activity; stravaInboxActivity: { findUnique: () => Promise<{ fetchedAt: Date }> }; $queryRaw: () => Promise<Array<{ id: string }>> }) => Promise<T>) => operation({
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
