import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createPlannerEditorDraftFromSharedProjection,
  createTemplateEditorDraftFromSharedProjection,
} from '../lib/session-editor-adapters.ts';
import {
  createSharedWorkoutProjection,
  parseSharedWorkoutProjection,
} from '../lib/share-link.ts';
import { createShareLinkService, hashShareToken } from '../lib/share-link-service.ts';

test('shared projection keeps workout definition content and drops private session fields', () => {
  const projection = createSharedWorkoutProjection({
    sourceKind: 'session',
    sport: 'RUNNING',
    title: 'Threshold session',
    summary: 'Controlled work',
    blocks: [
      {
        id: 91,
        kind: 'work',
        zone: 4,
        durationSec: 900,
        reps: 3,
        targetType: 'pace',
        targetLow: 240,
        targetHigh: 250,
        note: 'Hold form',
        skipped: false,
        sortOrder: 0,
      },
    ],
  });

  assert.deepEqual(projection, {
    snapshotVersion: 1,
    sourceKind: 'session',
    sport: 'RUNNING',
    title: 'Threshold session',
    summary: 'Controlled work',
    blocks: [
      {
        kind: 'work',
        zone: 4,
        durationSec: 900,
        reps: 3,
        target: { type: 'pace', low: 240, high: 250 },
        note: 'Hold form',
        skipped: false,
      },
    ],
    metrics: {
      durationSec: 900,
      tss: 24,
      segments: [
        {
          key: 'work-0',
          zone: 4,
          durationSec: 900,
          label: 'Z4 Threshold',
          color: '#F97316',
          tint: '#FEEDE0',
        },
      ],
    },
  });
  assert.equal('id' in projection, false);
  assert.equal('scheduledDate' in projection, false);
  assert.equal('rpe' in projection, false);
});

test('shared projection excludes skipped blocks from derived metrics', () => {
  const projection = createSharedWorkoutProjection({
    sourceKind: 'template',
    name: 'Mixed session',
    sport: 'BIKING',
    blocks: [
      { kind: 'work', zone: 4, durationSec: 1200, skipped: true, sortOrder: 0 },
      { kind: 'recovery', zone: 1, durationSec: 300, skipped: false, sortOrder: 1 },
    ],
  });

  assert.equal(projection.blocks.length, 2);
  assert.equal(projection.metrics.durationSec, 300);
  assert.equal(projection.metrics.tss, 3);
});

test('shared import creates independent canonical drafts with no source identity or schedule', () => {
  const projection = createSharedWorkoutProjection({
    sourceKind: 'template',
    name: 'Shared workout',
    sport: 'SWIMMING',
    summary: 'Public summary',
    blocks: [{ kind: 'work', zone: 3, durationSec: 600, sortOrder: 0 }],
  });

  const templateDraft = createTemplateEditorDraftFromSharedProjection(projection);
  const athleteDraft = createPlannerEditorDraftFromSharedProjection(projection, {
    ownershipMode: 'athlete',
    athleteId: 12,
    scheduledDate: '2026-09-04',
  });
  const coachDraft = createPlannerEditorDraftFromSharedProjection(projection, {
    ownershipMode: 'coach-library',
    scheduledDate: '2026-09-04',
  });

  for (const draft of [templateDraft, athleteDraft, coachDraft]) {
    assert.equal(draft.mode, 'create');
    assert.equal(draft.id, null);
    assert.equal(draft.templateId, null);
    assert.equal(draft.coachOwnerId, null);
    assert.equal(draft.planId, null);
    assert.equal(draft.trainingPlanId, null);
    assert.equal(draft.assignedById, null);
    assert.equal(draft.status, 'planned');
    assert.equal(draft.source, 'share');
    assert.equal(draft.coachNotes, '');
    assert.equal(draft.athleteNotes, '');
    assert.equal(draft.rpe, null);
  }
  assert.equal(templateDraft.scheduledDate, null);
  assert.equal(athleteDraft.athleteId, 12);
  assert.equal(athleteDraft.scheduledDate, '2026-09-04');
  assert.equal(coachDraft.scheduledDate, '2026-09-04');
  assert.equal(coachDraft.ownershipMode, 'coach-library');
});

test('shared projection parser rejects malformed snapshots', () => {
  assert.equal(parseSharedWorkoutProjection(undefined), null);
  assert.equal(parseSharedWorkoutProjection('{"snapshotVersion":1}'), null);
});

test('share link creation hashes an opaque token and stores exactly one sanitized source', async () => {
  let createArgs: { data: Record<string, unknown> } | undefined;
  const token = 'a'.repeat(43);
  const service = createShareLinkService({
    createToken: () => token,
    db: {
      template: {
        async findUnique() {
          return {
            id: 17,
            ownerId: 2,
            name: 'Private template',
            sport: 'RUNNING',
            summary: 'Public summary',
            blocks: [{ kind: 'work', zone: 3, durationSec: 600, note: 'Cue', sortOrder: 0 }],
          };
        },
      },
      shareLink: {
        async create(args: { data: Record<string, unknown> }) {
          createArgs = args;
          return { id: 1 };
        },
      },
    } as never,
  });

  const result = await service.createForUser(2, 'template', 17);

  assert.deepEqual(result, {
    ok: true,
    url: `/share/${token}`,
    sourceKind: 'template',
    sourceId: 17,
  });
  assert.equal(createArgs?.data.tokenHash, hashShareToken(token));
  assert.notEqual(createArgs?.data.tokenHash, token);
  assert.equal(createArgs?.data.sessionId, null);
  assert.equal(createArgs?.data.templateId, 17);
  const snapshot = JSON.parse(String(createArgs?.data.snapshotJson)) as Record<string, unknown>;
  assert.equal(snapshot.title, 'Private template');
  assert.equal('ownerId' in snapshot, false);
  assert.equal('createdById' in snapshot, false);
});

test('share link session access allows the athlete or roster coach but not unrelated users', async () => {
  const session = {
    id: 22,
    athleteId: 7,
    coachOwnerId: null,
    trainingPlanId: null,
    coachBaselineJson: null,
    sport: 'BIKING',
    title: 'Assigned ride',
    summary: 'Planned only',
    blocks: [{ kind: 'work', zone: 2, durationSec: 1200, sortOrder: 0 }],
    athlete: { coachId: 3 },
  };
  const createArgs: Array<{ data: Record<string, unknown> }> = [];
  const service = createShareLinkService({
    createToken: () => 'b'.repeat(43),
    db: {
      session: { async findUnique() { return session; } },
      shareLink: { async create(args: { data: Record<string, unknown> }) { createArgs.push(args); return { id: 1 }; } },
    } as never,
  });

  assert.equal((await service.createForUser(7, 'session', 22)).ok, true);
  assert.equal((await service.createForUser(3, 'session', 22)).ok, true);
  assert.deepEqual(await service.createForUser(99, 'session', 22), {
    ok: false,
    error: 'Share link not found.',
    status: 404,
  });
  assert.equal(createArgs.length, 2);
});

test('public preview uses the stored snapshot and rejects malformed or mixed links', async () => {
  const token = 'c'.repeat(43);
  const snapshot = JSON.stringify(createSharedWorkoutProjection({
    sourceKind: 'session',
    title: 'Snapshot workout',
    sport: 'RUNNING',
    blocks: [{ kind: 'work', zone: 3, durationSec: 600, sortOrder: 0 }],
  }));
  let lookups = 0;
  const service = createShareLinkService({
    db: {
      shareLink: {
        async findUnique(args: { where: { tokenHash: string } }) {
          lookups += 1;
          assert.equal(args.where.tokenHash, hashShareToken(token));
          return { sessionId: 22, templateId: null, snapshotJson: snapshot };
        },
      },
    } as never,
  });

  const preview = await service.loadPreview(token);
  assert.equal(preview?.title, 'Snapshot workout');
  assert.equal(await service.loadPreview('bad-token'), null);
  assert.equal(lookups, 1);
});
