import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  addSessionEditorBlock,
  createEmptySessionEditorDraft,
  updateSessionEditorBlock,
} from '../lib/session-editor.ts';
import { serializeSessionSnapshot } from '../lib/session-snapshot-service.ts';
import { createSessionComparisonService } from '../lib/session-comparison-service.ts';

function createDrafts() {
  let baseline = addSessionEditorBlock(
    createEmptySessionEditorDraft({
      mode: 'planned',
      id: 40,
      athleteId: 7,
      scheduledDate: '2026-08-24',
      title: 'Coach baseline',
      summary: 'Original plan',
      coachNotes: 'Stay smooth.',
    }),
    { kind: 'work', zone: 3, durationSec: 900, note: 'Original work' },
  );
  baseline = updateSessionEditorBlock(baseline, 0, { durationSec: 600 });
  const actual = updateSessionEditorBlock({ ...baseline, mode: 'actual', athleteNotes: 'Stopped early.' }, 0, {
    durationSec: 300,
    skipped: true,
  });
  return { baseline, actual };
}

function createDb(actualSnapshotJson: string | null) {
  const { baseline } = createDrafts();
  const db = {
    session: {
      async findUnique() {
        return {
          id: 40,
          athleteId: 7,
          coachBaselineJson: serializeSessionSnapshot(baseline),
          activity: actualSnapshotJson ? { actualSnapshotJson } : null,
          athlete: { coachId: 2 },
        };
      },
    },
  };
  return { db, baseline };
}

test('comparison exposes separate baseline and actual drafts for an authorized athlete or coach', async () => {
  const { actual } = createDrafts();
  const { db } = createDb(serializeSessionSnapshot(actual));
  const service = createSessionComparisonService({ db: db as never });

  const athlete = await service.loadComparison({ role: 'ATHLETE', userId: 7 }, 40);
  const coach = await service.loadComparison({ role: 'COACH', userId: 2 }, 40);

  assert.equal(athlete.ok, true);
  assert.equal(athlete.baseline?.title, 'Coach baseline');
  assert.equal(athlete.actual?.athleteNotes, 'Stopped early.');
  assert.equal(athlete.hasDifference, true);
  assert.equal(coach.ok, true);
  assert.equal(coach.actual?.blocks[0]?.skipped, true);
});

test('comparison hides equal actuals, supports missing baselines, and rejects unrelated users', async () => {
  const { baseline } = createDrafts();
  const equalDb = createDb(serializeSessionSnapshot({ ...baseline, mode: 'actual' }));
  const equalService = createSessionComparisonService({ db: equalDb.db as never });
  const equal = await equalService.loadComparison({ role: 'ATHLETE', userId: 7 }, 40);
  assert.equal(equal.ok, true);
  assert.equal(equal.actual, null);
  assert.equal(equal.hasDifference, false);

  const missingBaselineDb = {
    session: {
      async findUnique() {
        return {
          id: 40,
          athleteId: 7,
          coachBaselineJson: null,
          activity: { actualSnapshotJson: serializeSessionSnapshot({ ...baseline, mode: 'actual' }) },
          athlete: { coachId: 2 },
        };
      },
    },
  };
  const missing = await createSessionComparisonService({ db: missingBaselineDb as never }).loadComparison({ role: 'ATHLETE', userId: 7 }, 40);
  assert.equal(missing.baseline, null);
  assert.ok(missing.actual);

  assert.deepEqual(await equalService.loadComparison({ role: 'ATHLETE', userId: 8 }, 40), {
    ok: false,
    status: 404,
    error: 'Session not found',
  });
  assert.deepEqual(await equalService.loadComparison({ role: 'COACH', userId: 99 }, 40), {
    ok: false,
    status: 404,
    error: 'Session not found',
  });
});

test('comparison routes and shared dialog declare both role adapters and complete-version toggles', async () => {
  const athleteRoute = await readFile(path.join(process.cwd(), 'app/api/athlete/sessions/[sessionId]/comparison/route.ts'), 'utf8');
  const coachRoute = await readFile(path.join(process.cwd(), 'app/api/coach/sessions/[sessionId]/comparison/route.ts'), 'utf8');
  const dialog = await readFile(path.join(process.cwd(), 'components/SessionComparisonDialog.tsx'), 'utf8');
  const athleteDetail = await readFile(path.join(process.cwd(), 'app/(app)/athlete/session/[sessionId]/SessionDetailClient.tsx'), 'utf8');
  const activityPage = await readFile(path.join(process.cwd(), 'app/(app)/athlete/activity/page.tsx'), 'utf8');
  const coachDetail = await readFile(path.join(process.cwd(), 'app/(app)/coach/athletes/[athleteId]/page.tsx'), 'utf8');

  assert.match(athleteRoute, /requireAthlete/);
  assert.match(athleteRoute, /loadComparison/);
  assert.match(coachRoute, /requireCoach/);
  assert.match(coachRoute, /loadComparison/);
  assert.match(dialog, /Coach plan/);
  assert.match(dialog, /Athlete actual/);
  assert.match(dialog, /perspective === 'coach'/);
  assert.match(dialog, /'Planned'/);
  assert.match(dialog, /<dialog/);
  assert.match(dialog, /showModal\(\)/);
  assert.match(dialog, /Loading comparison/);
  assert.match(dialog, /Close comparison/);
  assert.match(athleteDetail, /SessionComparisonDialog/);
  assert.match(activityPage, /SessionComparisonDialog/);
  assert.match(coachDetail, /SessionComparisonDialog/);
});
