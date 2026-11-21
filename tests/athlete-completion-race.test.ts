import test from 'node:test';
import assert from 'node:assert/strict';

import { createAthleteCompletionService } from '../lib/athlete-completion-service.ts';
import { createActivityImportService } from '../lib/activity-import-service.ts';
import { disposableDatabaseSkip, withDisposableDatabase } from './disposable-postgres.ts';

const rideInput = {
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
};

type Db = Parameters<Parameters<typeof withDisposableDatabase>[0]>[0];

async function createPlannedSession(db: Db, email: string) {
  const athlete = await db.user.create({ data: { email, role: 'ATHLETE' } });
  const session = await db.session.create({ data: {
    athleteId: athlete.id,
    date: new Date('2026-09-25T00:00:00.000Z'),
    sport: 'RUNNING',
    title: 'Easy run',
    source: 'athlete',
    blocks: { create: [{ kind: 'work', zone: 2, durationSec: 1800, sortOrder: 0 }] },
  } });
  return { athlete, session };
}

// Hold the completion service between its session read and its writes so another
// writer can commit in between.
function pauseAfterSessionRead(db: Db) {
  let release!: () => void;
  const mayWrite = new Promise<void>((resolve) => { release = resolve; });
  let hasRead!: () => void;
  const read = new Promise<void>((resolve) => { hasRead = resolve; });
  const pausedDb = new Proxy(db, {
    get(target, property, receiver) {
      if (property !== 'session') return Reflect.get(target, property, receiver);
      return new Proxy(target.session, {
        get(sessionTarget, method, sessionReceiver) {
          if (method !== 'findUnique') return Reflect.get(sessionTarget, method, sessionReceiver);
          return async (args: Parameters<typeof db.session.findUnique>[0]) => {
            const row = await sessionTarget.findUnique(args);
            hasRead();
            await mayWrite;
            return row;
          };
        },
      });
    },
  });
  return { pausedDb, read, release };
}

test('a manual completion that read the session before a ride upload committed keeps the recorded activity', { skip: disposableDatabaseSkip }, async () => {
  await withDisposableDatabase(async (db) => {
    const { athlete, session } = await createPlannedSession(db, 'complete-vs-ride@example.test');
    const { pausedDb, read, release } = pauseAfterSessionRead(db);
    const completion = createAthleteCompletionService({ db: pausedDb as never });
    const imports = createActivityImportService({ db: db as never });

    const [completed, imported] = await Promise.all([
      completion.completeSession(athlete.id, session.id, {}),
      (async () => {
        await read;
        const result = await imports.importForUser(athlete.id, { ...rideInput, plannedSessionId: session.id });
        release();
        return result;
      })(),
    ]);

    assert.equal(imported.ok, true);
    assert.equal(completed.ok, false);
    assert.equal(!completed.ok && completed.status, 409);
    const stored = await db.session.findUniqueOrThrow({ where: { id: session.id }, include: { activity: true } });
    assert.equal(stored.status, 'completed');
    assert.equal(stored.activity?.metricsSource, 'file-import');
  });
});

test('two completions that read the same session cannot both apply', { skip: disposableDatabaseSkip }, async () => {
  await withDisposableDatabase(async (db) => {
    const { athlete, session } = await createPlannedSession(db, 'complete-twice@example.test');
    const { pausedDb, read, release } = pauseAfterSessionRead(db);
    const slow = createAthleteCompletionService({ db: pausedDb as never });
    const fast = createAthleteCompletionService({ db: db as never });

    const [first, second] = await Promise.all([
      slow.completeSession(athlete.id, session.id, { notes: 'slow' }),
      (async () => {
        await read;
        const result = await fast.completeSession(athlete.id, session.id, { notes: 'fast' });
        release();
        return result;
      })(),
    ]);

    assert.equal(second.ok, true);
    assert.equal(first.ok, false);
    assert.equal(!first.ok && first.status, 409);
    const stored = await db.session.findUniqueOrThrow({ where: { id: session.id }, include: { activity: true } });
    assert.equal(stored.activity?.notes, 'fast');
  });
});

test('a reopen that read the session before a ride upload committed keeps the ride', { skip: disposableDatabaseSkip }, async () => {
  await withDisposableDatabase(async (db) => {
    const { athlete, session } = await createPlannedSession(db, 'reopen-vs-ride@example.test');
    const { pausedDb, read, release } = pauseAfterSessionRead(db);
    const completion = createAthleteCompletionService({ db: pausedDb as never });
    const imports = createActivityImportService({ db: db as never });

    const [reopened, imported] = await Promise.all([
      completion.reopenSession(athlete.id, session.id, {}),
      (async () => {
        await read;
        const result = await imports.importForUser(athlete.id, { ...rideInput, plannedSessionId: session.id });
        release();
        return result;
      })(),
    ]);

    assert.equal(imported.ok, true);
    assert.equal(reopened.ok, false);
    assert.equal(!reopened.ok && reopened.status, 409);
    const stored = await db.session.findUniqueOrThrow({ where: { id: session.id }, include: { activity: true } });
    assert.equal(stored.status, 'completed');
    assert.equal(stored.activity?.metricsSource, 'file-import');
  });
});

test('a reopen of a manual completion cannot delete a correction that committed after its read', { skip: disposableDatabaseSkip }, async () => {
  await withDisposableDatabase(async (db) => {
    const { athlete, session } = await createPlannedSession(db, 'reopen-vs-complete@example.test');
    const completion = createAthleteCompletionService({ db: db as never });
    assert.equal((await completion.completeSession(athlete.id, session.id, { notes: 'first' })).ok, true);
    const { pausedDb, read, release } = pauseAfterSessionRead(db);
    const pausedCompletion = createAthleteCompletionService({ db: pausedDb as never });

    const [reopened, renoted] = await Promise.all([
      pausedCompletion.reopenSession(athlete.id, session.id, {}),
      (async () => {
        await read;
        const result = await completion.completeSession(athlete.id, session.id, { notes: 'second' });
        release();
        return result;
      })(),
    ]);

    assert.equal(renoted.ok, true);
    assert.equal(reopened.ok, false);
    assert.equal(!reopened.ok && reopened.status, 409);
    const stored = await db.session.findUniqueOrThrow({ where: { id: session.id }, include: { activity: true } });
    assert.equal(stored.status, 'completed');
    assert.equal(stored.activity?.notes, 'second');
  });
});

test('a ride upload cannot attach to a session completed manually while it was in flight', { skip: disposableDatabaseSkip }, async () => {
  await withDisposableDatabase(async (db) => {
    const { athlete, session } = await createPlannedSession(db, 'ride-vs-complete@example.test');
    // Pause the import inside its transaction, after its availability check.
    let release!: () => void;
    const mayWrite = new Promise<void>((resolve) => { release = resolve; });
    let hasRead!: () => void;
    const read = new Promise<void>((resolve) => { hasRead = resolve; });
    const pausedDb = new Proxy(db, {
      get(target, property, receiver) {
        if (property !== '$transaction') return Reflect.get(target, property, receiver);
        return (run: (tx: Db) => Promise<unknown>) => target.$transaction((tx) => run(new Proxy(tx, {
          get(txTarget, txProperty, txReceiver) {
            if (txProperty !== 'session') return Reflect.get(txTarget, txProperty, txReceiver);
            return new Proxy(txTarget.session, {
              get(sessionTarget, method, sessionReceiver) {
                if (method !== 'findFirst') return Reflect.get(sessionTarget, method, sessionReceiver);
                return async (args: Parameters<typeof db.session.findFirst>[0]) => {
                  const row = await sessionTarget.findFirst(args);
                  hasRead();
                  await mayWrite;
                  return row;
                };
              },
            });
          },
        }) as Db));
      },
    });
    const imports = createActivityImportService({ db: pausedDb as never });
    const completion = createAthleteCompletionService({ db: db as never });

    const [imported, completed] = await Promise.all([
      imports.importForUser(athlete.id, { ...rideInput, plannedSessionId: session.id }),
      (async () => {
        await read;
        const result = await completion.completeSession(athlete.id, session.id, {});
        release();
        return result;
      })(),
    ]);

    assert.equal(completed.ok, true);
    assert.equal(imported.ok, false);
    assert.equal(!imported.ok && imported.status, 409);
    const stored = await db.session.findUniqueOrThrow({ where: { id: session.id }, include: { activity: true } });
    assert.equal(stored.activity?.metricsSource, 'manual-actual');
  });
});
