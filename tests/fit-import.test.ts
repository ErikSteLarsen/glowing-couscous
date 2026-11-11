import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Encoder, Profile } from '@garmin/fitsdk';
import { PrismaClient } from '@prisma/client';
import { createAthleteService } from '../lib/athlete-service.ts';
import { createAthleteFitImportService } from '../lib/athlete-fit-import-service.ts';
import { createTrainingLoadService } from '../lib/training-load-service.ts';
import { MAX_FIT_BYTES, parseFitActivity } from '../lib/fit-activity.ts';
import { formatActivityDateTime } from '../lib/tcx-time.ts';
import { readActivityUpload } from '../lib/tcx-upload.ts';
import { addSessionEditorBlock, createEmptySessionEditorDraft } from '../lib/session-editor.ts';
import { serializeSessionSnapshot } from '../lib/session-snapshot-service.ts';

const fitEpoch = Date.UTC(1989, 11, 31);
const fitSeconds = (value: string) => (Date.parse(value) - fitEpoch) / 1000;

function makeFit(options: {
  fileType?: string;
  sport?: string;
  localOffsetSeconds?: number | null;
  numSessions?: number;
  activityType?: string;
  extraSession?: boolean;
  distance?: number;
  timestampSeconds?: number;
} = {}) {
  const start = options.timestampSeconds ?? fitSeconds('2026-11-07T23:30:00.000Z');
  const finish = start + 2700;
  const startDate = new Date(fitEpoch + start * 1000);
  const finishDate = new Date(fitEpoch + finish * 1000);
  const encoder = new Encoder();
  encoder.onMesg(Profile.MesgNum.FILE_ID, {
    type: options.fileType ?? 'activity', manufacturer: 'garmin', product: 1,
    timeCreated: startDate,
  });
  const session = {
    sport: options.sport ?? 'running',
    startTime: startDate,
    timestamp: finishDate,
    totalElapsedTime: 2700,
    totalTimerTime: 2500,
    totalDistance: options.distance ?? 8500.2,
  };
  encoder.onMesg(Profile.MesgNum.SESSION, session);
  if (options.extraSession) encoder.onMesg(Profile.MesgNum.SESSION, { ...session, sport: 'cycling' });
  encoder.onMesg(Profile.MesgNum.ACTIVITY, {
    timestamp: finish,
    ...(options.localOffsetSeconds === null ? {} : { localTimestamp: finish + (options.localOffsetSeconds ?? -5 * 3600) }),
    numSessions: options.numSessions ?? (options.extraSession ? 2 : 1),
    type: options.activityType ?? 'manual',
  });
  encoder.onMesg(Profile.MesgNum.RECORD, {
    timestamp: new Date('2026-11-07T23:30:01.000Z'),
    positionLat: 59.9,
    positionLong: 10.7,
    heartRate: 150,
  });
  return encoder.close();
}

test('FIT parser validates Activity shape, timestamps, local timezone, sport and integrity', () => {
  const validBytes = makeFit();
  const parsed = parseFitActivity(validBytes);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.activity.sport, 'RUNNING');
  assert.equal(parsed.activity.title, 'Running activity');
  assert.equal(parsed.activity.startedAt.toISOString(), '2026-11-07T23:30:00.000Z');
  assert.equal(parsed.activity.completedAt.toISOString(), '2026-11-08T00:15:00.000Z');
  assert.equal(parsed.activity.completedOn, '2026-11-07');
  assert.equal(parsed.activity.sourceTimezoneOffsetMinutes, -300);
  assert.equal(parsed.activity.durationSec, 2700);
  assert.equal(parsed.activity.distanceMeters, 8500);
  assert.match(formatActivityDateTime(parsed.activity.startedAt, parsed.activity.sourceTimezoneOffsetMinutes), /UTC-05:00\)$/);

  const otherSports = [
    ['cycling', 'BIKING'],
    ['swimming', 'SWIMMING'],
  ] as const;
  for (const [source, expected] of otherSports) {
    const result = parseFitActivity(makeFit({ sport: source }));
    assert.equal(result.ok && result.activity.sport, expected);
  }
  assert.equal(parseFitActivity(makeFit({ fileType: 'workout' })).ok, false);
  assert.equal(parseFitActivity(makeFit({ sport: 'walking' })).ok, false);
  assert.equal(parseFitActivity(makeFit({ extraSession: true })).ok, false);
  assert.equal(parseFitActivity(makeFit({ activityType: 'autoMultiSport' })).ok, false);
  assert.equal(parseFitActivity(makeFit({ numSessions: 0 })).ok, false);
  assert.equal(parseFitActivity(makeFit({ localOffsetSeconds: null })).ok, false);
  assert.equal(parseFitActivity(makeFit({ localOffsetSeconds: 15 * 3600 })).ok, false);
  assert.equal(parseFitActivity(makeFit({ timestampSeconds: 0x0fffffff })).ok, false);
  assert.equal(parseFitActivity(makeFit({ timestampSeconds: 0x10000000, localOffsetSeconds: -3600 })).ok, false);

  const corrupt = new Uint8Array(validBytes);
  corrupt[20] = (corrupt[20] ?? 0) ^ 0xff;
  assert.equal(parseFitActivity(corrupt).ok, false);
  assert.equal(parseFitActivity(new Uint8Array([1, 2, 3])).ok, false);
  assert.equal(parseFitActivity(new Uint8Array(MAX_FIT_BYTES + 1)).ok, false);
});

test('activity upload accepts bounded FIT files and reports their format', async () => {
  const bytes = makeFit();
  const form = new FormData();
  form.set('file', new Blob([bytes]), 'activity.fit');
  const result = await readActivityUpload(new Request('http://localhost/api/import', { method: 'POST', body: form }));
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.upload.format, 'fit');
    assert.equal(Buffer.compare(Buffer.from(result.upload.bytes), Buffer.from(bytes)), 0);
  }

  const wrongExtension = new FormData();
  wrongExtension.set('file', new Blob([bytes]), 'activity.bin');
  const rejected = await readActivityUpload(new Request('http://localhost/api/import', { method: 'POST', body: wrongExtension }));
  assert.equal(rejected.ok, false);
});

test('FIT import previews without writes, persists safe summary, deduplicates by athlete, and preserves local date', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'tempo-fit-import-'));
  const databaseUrl = `file:${path.join(directory, 'test.db')}`;
  const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    execFileSync(process.execPath, [
      path.join(process.cwd(), 'node_modules/prisma/build/index.js'),
      'db', 'push', '--skip-generate', '--schema', path.join(process.cwd(), 'prisma/schema.prisma'),
    ], { env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'pipe' });
    const athlete = await db.user.create({ data: { email: 'fit-athlete@example.test', role: 'ATHLETE' } });
    const otherAthlete = await db.user.create({ data: { email: 'fit-other@example.test', role: 'ATHLETE' } });
    const coach = await db.user.create({ data: { email: 'fit-coach@example.test', role: 'COACH' } });
    const service = createAthleteFitImportService({ db });
    const bytes = makeFit();

    await t.test('preview is read-only, validates athlete role, and confirmation is required', async () => {
      const preview = await service.preview(athlete.id, bytes);
      assert.equal(preview.ok, true);
      assert.equal(await db.session.count({ where: { athleteId: athlete.id } }), 0);
      assert.equal(await db.activity.count({ where: { athleteId: athlete.id } }), 0);
      assert.equal((await service.preview(coach.id, bytes)).ok, false);
      assert.equal((await service.import(coach.id, bytes, true)).ok, false);
      assert.equal((await service.import(athlete.id, bytes, false)).ok, false);
      assert.equal(await db.session.count({ where: { athleteId: athlete.id } }), 0);
    });

    await t.test('save maps summary fields, omits FIT sensor data, and retries safely per athlete', async () => {
      const attempts = await Promise.all([
        service.import(athlete.id, bytes, true),
        service.import(athlete.id, bytes, true),
      ]);
      assert.ok(attempts.every((result) => result.ok));
      const ids = attempts.flatMap((result) => result.ok ? [result.sessionId] : []);
      assert.equal(new Set(ids).size, 1);
      assert.equal(await db.session.count({ where: { athleteId: athlete.id } }), 1);
      const session = await db.session.findFirst({ where: { athleteId: athlete.id }, include: { blocks: true, activity: true } });
      assert.ok(session?.activity);
      assert.equal(session.source, 'athlete-fit-import');
      assert.equal(session.sport, 'RUNNING');
      assert.equal(session.title, 'Running activity');
      assert.equal(session.status, 'completed');
      assert.equal(session.date?.toISOString(), '2026-11-07T12:00:00.000Z');
      assert.equal(session.coachBaselineJson, null);
      assert.equal(session.planId, null);
      assert.equal(session.coachOwnerId, null);
      assert.equal(session.blocks.length, 0);
      assert.equal(session.activity.metricsSource, 'fit-import');
      assert.equal(session.activity.startedAt?.toISOString(), '2026-11-07T23:30:00.000Z');
      assert.equal(session.activity.completedAt.toISOString(), '2026-11-08T00:15:00.000Z');
      assert.equal(session.activity.sourceTimezoneOffsetMinutes, -300);
      assert.equal(session.activity.durationSec, 2700);
      assert.equal(session.activity.distanceMeters, 8500);
      assert.equal(session.activity.tss, null);
      assert.equal(session.activity.compliancePct, null);
      assert.equal(session.activity.importFingerprint?.length, 64);
      assert.equal(JSON.stringify(session).includes('59.9'), false);
      assert.equal(JSON.stringify(session).includes('heartRate'), false);

      const duplicatePreview = await service.preview(athlete.id, bytes);
      assert.equal(duplicatePreview.ok && duplicatePreview.duplicate, true);
      const foreign = await service.import(otherAthlete.id, bytes, true);
      assert.equal(foreign.ok && foreign.duplicate, false);
      assert.equal(await db.session.count({ where: { athleteId: otherAthlete.id } }), 1);
    });

    await t.test('source-local finish date appears in Activity, session detail, Calendar and load history', async () => {
      const imported = await db.session.findFirst({ where: { athleteId: athlete.id }, select: { id: true } });
      assert.ok(imported);
      const activityService = createAthleteService({ db });
      const feed = await activityService.loadActivityFeed(athlete.id);
      const row = feed?.activities.find((activity) => activity.sessionId === imported.id);
      assert.ok(row);
      assert.equal(row.completedAt.toISOString(), '2026-11-08T00:15:00.000Z');
      assert.equal(row.sourceTimezoneOffsetMinutes, -300);
      assert.equal(row.metricsSource, 'fit-import');
      const detail = await activityService.loadSessionDetail(athlete.id, imported.id);
      assert.equal(detail?.session.activityStartedAt?.toISOString(), '2026-11-07T23:30:00.000Z');
      assert.equal(detail?.session.activityTimezoneOffsetMinutes, -300);
      assert.equal(await activityService.loadSessionDetail(otherAthlete.id, imported.id), null);
      const calendar = await activityService.loadCalendarView(athlete.id, '2026-11-07', 'month');
      const localDay = calendar?.weeks.flatMap((week) => week).find((day) => day.isoDate === '2026-11-07');
      assert.ok(localDay?.sessions.some((session) => session.id === imported.id));
      const utcDay = calendar?.weeks.flatMap((week) => week).find((day) => day.isoDate === '2026-11-08');
      assert.equal(utcDay?.sessions.some((session) => session.id === imported.id), false);
      const load = await createTrainingLoadService({ db }).loadOverview(athlete.id, { now: new Date('2026-11-10T12:00:00.000Z') });
      const loadRow = load.sessions.find((session) => session.sessionId === imported.id);
      assert.equal(loadRow?.actualDay, '2026-11-07');
      assert.equal(loadRow?.plannedTss, 0);
      assert.equal(loadRow?.compliance, 'unplanned');
    });

    await t.test('explicit FIT pairing preserves planned metadata and captures actual summary without inventing blocks or TSS', async () => {
      const plannedDraft = addSessionEditorBlock(createEmptySessionEditorDraft({
        mode: 'planned',
        athleteId: athlete.id,
        scheduledDate: '2026-11-07',
        title: 'FIT paired plan',
        sport: 'RUNNING',
      }), { kind: 'work', zone: 3, durationSec: 1800 });
      const existingBaseline = serializeSessionSnapshot(plannedDraft);
      const planned = await db.session.create({
        data: {
          athleteId: athlete.id,
          date: new Date('2026-11-07T12:00:00.000Z'),
          sport: 'RUNNING',
          title: 'FIT paired plan',
          status: 'planned',
          source: 'athlete-planner',
          adjusted: false,
          coachBaselineJson: existingBaseline,
          blocks: { create: [{ kind: 'work', zone: 3, durationSec: 1800, sortOrder: 0 }] },
        },
      });
      const pairBytes = makeFit({ distance: 8501 });
      const preview = await service.preview(athlete.id, pairBytes);
      assert.equal(preview.ok, true);
      if (!preview.ok) return;
      assert.deepEqual(preview.candidates?.map((candidate) => ({ id: candidate.id, title: candidate.title, date: candidate.date, plannedDurationSec: candidate.plannedDurationSec })), [
        { id: planned.id, title: 'FIT paired plan', date: '2026-11-07', plannedDurationSec: 1800 },
      ]);

      const saved = await service.import(athlete.id, pairBytes, true, planned.id);
      assert.equal(saved.ok, true);
      const attached = await db.session.findUnique({ where: { id: planned.id }, include: { blocks: true, activity: true } });
      assert.equal(attached?.status, 'completed');
      assert.equal(attached?.title, 'FIT paired plan');
      assert.equal(attached?.date?.toISOString(), '2026-11-07T12:00:00.000Z');
      assert.equal(attached?.coachBaselineJson, existingBaseline);
      assert.equal(attached?.blocks.length, 1);
      assert.equal(attached?.blocks[0]?.durationSec, 1800);
      assert.equal(attached?.activity?.metricsSource, 'fit-import');
      assert.equal(attached?.activity?.durationSec, 2700);
      assert.equal(attached?.activity?.tss, null);
      assert.equal(attached?.activity?.segmentsJson, '[]');
      assert.equal(attached?.activity?.actualSnapshotJson, null);

      const retry = await service.import(athlete.id, pairBytes, true, planned.id);
      assert.equal(retry.ok && retry.duplicate, true);
      assert.equal(await db.activity.count({ where: { sessionId: planned.id } }), 1);
      const detail = await createAthleteService({ db }).loadSessionDetail(athlete.id, planned.id);
      assert.equal(detail?.session.plannedDurationSec, 1800);
      assert.equal(detail?.session.actualDurationSec, 2700);
      assert.equal(detail?.session.compliance, 'duration-only');
      const feed = await createAthleteService({ db }).loadActivityFeed(athlete.id);
      assert.equal(feed?.activities.find((activity) => activity.sessionId === planned.id)?.plannedDurationSec, 1800);
      const load = await createTrainingLoadService({ db }).loadOverview(athlete.id, { now: new Date('2026-11-10T12:00:00.000Z') });
      assert.equal(load.sessions.find((session) => session.sessionId === planned.id)?.compliance, 'duration-only');
    });
  } finally {
    await db.$disconnect();
    await rm(directory, { recursive: true, force: true });
  }
});
