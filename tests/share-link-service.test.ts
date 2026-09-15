import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createPlannerEditorDraftFromSharedProjection,
  createTemplateEditorDraftFromSharedProjection,
} from '../lib/session-editor-adapters.ts';
import {
  createSharePath,
  createSharedWorkoutProjection,
  getSafeShareCallbackPath,
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
        target: { metric: 'pace', mode: 'absolute', reference: null, low: 240, high: 250 },
        note: 'Hold form',
        skipped: false,
      },
    ],
    metrics: {
      durationSec: 2700,
      tss: 72,
      segments: [
        {
          key: 'work-0-0',
          zone: 4,
          durationSec: 900,
          label: 'Z4 Threshold',
          color: '#F97316',
          tint: '#FEEDE0',
        },
        { key: 'work-0-1', zone: 4, durationSec: 900, label: 'Z4 Threshold', color: '#F97316', tint: '#FEEDE0' },
        { key: 'work-0-2', zone: 4, durationSec: 900, label: 'Z4 Threshold', color: '#F97316', tint: '#FEEDE0' },
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

  const valid = createSharedWorkoutProjection({
    sourceKind: 'template',
    title: 'Valid snapshot',
    sport: 'RUNNING',
    blocks: [{ kind: 'work', zone: 3, durationSec: 600, sortOrder: 0 }],
  });
  assert.equal(
    parseSharedWorkoutProjection(JSON.stringify({
      ...valid,
      blocks: [{ ...valid.blocks[0], durationSec: 'not-a-duration' }],
    })),
    null,
  );
  assert.equal(
    parseSharedWorkoutProjection(JSON.stringify({
      ...valid,
      metrics: { ...valid.metrics, tss: valid.metrics.tss + 1 },
    })),
    null,
  );
  const parsed = parseSharedWorkoutProjection(JSON.stringify({ ...valid, coachNotes: 'must not escape' }));
  assert.equal(parsed && 'coachNotes' in parsed, false);
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

test('standalone coach sessions are owner-scoped and training-plan children are deferred', async () => {
  const standalone = {
    id: 23,
    athleteId: null,
    coachOwnerId: 4,
    trainingPlanId: null,
    coachBaselineJson: null,
    sport: 'STRENGTH',
    title: 'Coach library session',
    summary: null,
    blocks: [{ kind: 'work', zone: 3, durationSec: 600, sortOrder: 0 }],
    athlete: null,
  };
  const trainingPlanChild = { ...standalone, id: 24, trainingPlanId: 8 };
  const created: number[] = [];
  const service = createShareLinkService({
    createToken: () => 'f'.repeat(43),
    db: {
      session: {
        async findUnique(args: { where: { id: number } }) {
          return args.where.id === 23 ? standalone : trainingPlanChild;
        },
      },
      shareLink: {
        async create() {
          created.push(1);
          return { id: created.length };
        },
      },
    } as never,
  });

  assert.equal((await service.createForUser(4, 'session', 23)).ok, true);
  assert.deepEqual(await service.createForUser(5, 'session', 23), {
    ok: false,
    error: 'Share link not found.',
    status: 404,
  });
  assert.deepEqual(await service.createForUser(4, 'session', 24), {
    ok: false,
    error: 'Share link not found.',
    status: 404,
  });
  assert.equal(created.length, 1);
});

test('completed sessions use the stored planned baseline and never expose actual or private fields', async () => {
  const baseline = JSON.stringify({
    sport: 'BIKING',
    title: 'Baseline title',
    summary: 'Baseline summary',
    scheduledDate: '2026-09-01',
    status: 'planned',
    coachNotes: 'Private coach note',
    athleteNotes: 'Private athlete note',
    rpe: 9,
    blocks: [{ kind: 'work', zone: 4, durationSec: 900, note: 'Public cue', sortOrder: 0 }],
  });
  let snapshotJson = '';
  const service = createShareLinkService({
    createToken: () => 'g'.repeat(43),
    db: {
      session: {
        async findUnique() {
          return {
            id: 25,
            athleteId: 7,
            coachOwnerId: null,
            trainingPlanId: null,
            coachBaselineJson: baseline,
            status: 'completed',
            sport: 'RUNNING',
            title: 'Mutable current title',
            summary: 'Current summary',
            blocks: [{ kind: 'work', zone: 1, durationSec: 60, note: 'Current data', sortOrder: 0 }],
            athlete: { coachId: 3 },
          };
        },
      },
      shareLink: {
        async create(args: { data: { snapshotJson: string } }) {
          snapshotJson = args.data.snapshotJson;
          return { id: 1 };
        },
      },
    } as never,
  });

  assert.equal((await service.createForUser(7, 'session', 25)).ok, true);
  const projection = JSON.parse(snapshotJson) as Record<string, unknown>;
  assert.equal(projection.title, 'Baseline title');
  assert.equal('coachNotes' in projection, false);
  assert.equal('athleteNotes' in projection, false);
  assert.equal('rpe' in projection, false);
  assert.equal('actualSnapshotJson' in projection, false);
  assert.equal('activity' in projection, false);
});

test('planned sessions share current planned fields instead of a stale coach baseline', async () => {
  let snapshotJson = '';
  const service = createShareLinkService({
    createToken: () => 'h'.repeat(43),
    db: {
      session: {
        async findUnique() {
          return {
            id: 26,
            athleteId: 7,
            coachOwnerId: null,
            trainingPlanId: null,
            coachBaselineJson: JSON.stringify({
              sport: 'RUNNING',
              title: 'Old coach version',
              summary: 'Old summary',
              blocks: [{ kind: 'work', zone: 2, durationSec: 300, sortOrder: 0 }],
            }),
            status: 'planned',
            sport: 'RUNNING',
            title: 'Current adjusted version',
            summary: 'Current summary',
            blocks: [{ kind: 'work', zone: 4, durationSec: 900, sortOrder: 0 }],
            athlete: { coachId: 3 },
          };
        },
      },
      shareLink: {
        async create(args: { data: { snapshotJson: string } }) {
          snapshotJson = args.data.snapshotJson;
          return { id: 1 };
        },
      },
    } as never,
  });

  assert.equal((await service.createForUser(7, 'session', 26)).ok, true);
  assert.equal(JSON.parse(snapshotJson).title, 'Current adjusted version');
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

test('share continuation paths are local, token-bound, and action-bound', () => {
  const token = 'd'.repeat(43);
  assert.equal(createSharePath(token, 'planner'), `/share/${token}?action=planner`);
  assert.equal(getSafeShareCallbackPath(`/share/${token}?action=template`), `/share/${token}?action=template`);
  assert.equal(getSafeShareCallbackPath('https://evil.example/share/anything?action=planner'), null);
  assert.equal(getSafeShareCallbackPath(`/share/${token}?next=https://evil.example`), null);
  assert.equal(getSafeShareCallbackPath('/coach'), null);
  assert.equal(getSafeShareCallbackPath(`/share/${token}?action=planner&action=template`), null);
});

test('recipient copy commands sanitize ownership and delegate only after explicit save', async () => {
  const token = 'e'.repeat(43);
  const snapshot = JSON.stringify(createSharedWorkoutProjection({
    sourceKind: 'session',
    title: 'Imported workout',
    sport: 'RUNNING',
    blocks: [{ kind: 'work', zone: 3, durationSec: 600, sortOrder: 0 }],
  }));
  let templateInput: Record<string, unknown> | undefined;
  let athleteInput: Record<string, unknown> | undefined;
  let coachInput: Record<string, unknown> | undefined;
  const db = {
    shareLink: {
      async findUnique() {
        return { sessionId: 22, templateId: null, snapshotJson: snapshot };
      },
    },
  };
  const service = createShareLinkService({
    db: db as never,
    templatePersistence: {
      async saveForOwner(_ownerId: number, input: Record<string, unknown>) {
        templateInput = input;
        return { error: null };
      },
    } as never,
    athletePlannerPersistence: {
      async saveSession(_ownerId: number, input: Record<string, unknown>) {
        athleteInput = input;
        return { ok: true, sessionIds: [31] };
      },
    } as never,
    coachLibraryPersistence: {
      async saveForCoach(_ownerId: number, input: Record<string, unknown>) {
        coachInput = input;
        return { ok: true, sessionId: 32 };
      },
    } as never,
  });

  assert.equal((await service.loadPreview(token))?.title, 'Imported workout');
  const draft = {
    id: 999,
    athleteId: 888,
    coachOwnerId: 777,
    templateId: 666,
    scheduledDate: '2026-09-12',
    title: 'Edited imported workout',
    sport: 'RUNNING',
    summary: 'Recipient edit',
    coachNotes: 'Must not copy',
    athleteNotes: 'Must not copy',
    rpe: 10,
    blocks: [{ kind: 'work', zone: 3, durationSec: 900, sortOrder: 0 }],
  };

  assert.deepEqual(await service.saveTemplateCopy(50, token, draft), { ok: true });
  assert.deepEqual(await service.savePlannerCopy(50, 'ATHLETE', token, draft), { ok: true, sessionIds: [31] });
  assert.deepEqual(await service.savePlannerCopy(51, 'COACH', token, draft), { ok: true, sessionIds: [32] });
  assert.equal(templateInput?.name, 'Edited imported workout');
  assert.equal((athleteInput?.templateId ?? null), null);
  assert.equal((athleteInput?.coachOwnerId ?? null), null);
  assert.equal((coachInput?.sourceTemplateId ?? null), null);
  assert.equal((coachInput?.athleteId ?? null), null);
});
