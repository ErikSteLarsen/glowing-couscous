import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  addSessionEditorBlock,
  createEmptySessionEditorDraft,
  updateSessionEditorBlock,
  type SessionEditorDraft,
} from '../lib/session-editor.ts';
import {
  createSessionSnapshotService,
  deserializeSessionSnapshot,
  serializeSessionSnapshot,
} from '../lib/session-snapshot-service.ts';

function createDraft(): SessionEditorDraft {
  let draft = createEmptySessionEditorDraft({
    mode: 'planned',
    id: 11,
    athleteId: 7,
    scheduledDate: '2026-08-24',
    title: 'Threshold run',
    summary: 'Controlled work',
    coachNotes: 'Keep the first interval smooth.',
    athleteNotes: 'Legs felt ready.',
    rpe: 8,
  });
  draft = addSessionEditorBlock(draft, {
    kind: 'warmup',
    zone: 1,
    durationSec: 600,
    note: 'Easy start',
  });
  draft = addSessionEditorBlock(draft, {
    kind: 'work',
    zone: 4,
    durationSec: 900,
    reps: 2,
    target: { metric: 'pace', mode: 'absolute', reference: null, low: 240, high: 250 },
    note: 'Hold form',
    skipped: true,
  });
  return updateSessionEditorBlock(draft, 0, { skipped: false });
}

function createDb() {
  const state = {
    coachBaselineJson: null as string | null,
    actualSnapshotJson: null as string | null,
    sessionUpdates: [] as unknown[],
    activityUpdates: [] as unknown[],
  };
  const db = {
    session: {
      async findUnique() {
        return { coachBaselineJson: state.coachBaselineJson };
      },
      async update(args: { data: { coachBaselineJson: string; coachNotes: string | null; rpe: number | null } }) {
        state.sessionUpdates.push(args);
        state.coachBaselineJson = args.data.coachBaselineJson;
        return { id: 11 };
      },
    },
    activity: {
      async findUnique() {
        return { actualSnapshotJson: state.actualSnapshotJson };
      },
      async update(args: { data: { actualSnapshotJson: string; rpe: number | null; notes: string | null } }) {
        state.activityUpdates.push(args);
        state.actualSnapshotJson = args.data.actualSnapshotJson;
        return { id: 20 };
      },
    },
  };
  return { db, state };
}

test('schema stores one coach baseline payload and one latest actual payload', async () => {
  const schema = await readFile(path.join(process.cwd(), 'prisma/schema.prisma'), 'utf8');

  assert.match(schema, /coachBaselineJson\s+String\?/);
  assert.match(schema, /coachNotes\s+String\?/);
  assert.match(schema, /rpe\s+Int\?/);
  assert.match(schema, /actualSnapshotJson\s+String\?/);
});

test('snapshot payload round-trips skipped blocks, notes, RPE, and schedule', () => {
  const draft = createDraft();
  const restored = deserializeSessionSnapshot('planned', serializeSessionSnapshot(draft));

  assert.ok(restored);
  assert.equal(restored?.scheduledDate, '2026-08-24');
  assert.equal(restored?.coachNotes, 'Keep the first interval smooth.');
  assert.equal(restored?.athleteNotes, 'Legs felt ready.');
  assert.equal(restored?.rpe, 8);
  assert.equal(restored?.blocks[1]?.skipped, true);
});

test('baseline changes replace one durable payload and actual equality exposes no second version', async () => {
  const { db, state } = createDb();
  const service = createSessionSnapshotService({ db: db as never });
  const baseline = createDraft();

  await service.saveCoachBaseline(11, baseline);
  const changedBaseline = { ...baseline, title: 'Updated threshold run' };
  await service.saveCoachBaseline(11, changedBaseline);
  await service.saveActual(11, { ...changedBaseline, mode: 'actual' });

  const snapshots = await service.loadSnapshots(11);
  assert.equal(state.sessionUpdates.length, 2);
  assert.equal(state.activityUpdates.length, 1);
  assert.equal(snapshots.baseline?.title, 'Updated threshold run');
  assert.equal(snapshots.actual, null);
});

test('actual replacement updates the latest payload without creating history', async () => {
  const { db, state } = createDb();
  const service = createSessionSnapshotService({ db: db as never });
  const baseline = createDraft();

  await service.saveCoachBaseline(11, baseline);
  const firstActual = updateSessionEditorBlock(baseline, 0, { durationSec: 700 });
  const correctedActual = updateSessionEditorBlock(firstActual, 0, { durationSec: 800 });
  await service.saveActual(11, { ...firstActual, mode: 'actual', athleteNotes: 'First result', rpe: 7 });
  await service.saveActual(11, { ...correctedActual, mode: 'actual', athleteNotes: 'Corrected result', rpe: 9 });

  const snapshots = await service.loadSnapshots(11);
  assert.equal(state.activityUpdates.length, 2);
  assert.equal(snapshots.actual?.athleteNotes, 'Corrected result');
  assert.equal(snapshots.actual?.rpe, 9);
});

test('snapshot saves reject out-of-range RPE and overlong notes', async () => {
  const { db } = createDb();
  const service = createSessionSnapshotService({ db: db as never });
  const draft = createDraft();

  assert.deepEqual(await service.saveCoachBaseline(11, { ...draft, rpe: 11 }), {
    ok: false,
    status: 400,
    error: 'RPE must be a whole number from 1 to 10.',
  });
  assert.deepEqual(await service.saveCoachBaseline(11, { ...draft, coachNotes: 'x'.repeat(2001) }), {
    ok: false,
    status: 400,
    error: 'Your note is too long.',
  });
});

test('actual snapshots remain readable when a legacy session has no baseline', async () => {
  const { db } = createDb();
  const service = createSessionSnapshotService({ db: db as never });

  await service.saveActual(11, { ...createDraft(), mode: 'actual' });

  const snapshots = await service.loadSnapshots(11);
  assert.equal(snapshots.baseline, null);
  assert.equal(snapshots.actual?.mode, 'actual');
});

test('serialized source content is independent from later source mutation', () => {
  const source = createDraft();
  const copiedPayload = serializeSessionSnapshot({ ...source, id: 40 });
  const mutatedSource = updateSessionEditorBlock(source, 0, { durationSec: 1200 });

  assert.notEqual(mutatedSource.blocks[0]?.durationSec, deserializeSessionSnapshot('planned', copiedPayload)?.blocks[0]?.durationSec);
  assert.equal(deserializeSessionSnapshot('planned', copiedPayload)?.blocks[0]?.durationSec, 600);
});
