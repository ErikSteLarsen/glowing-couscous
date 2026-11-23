import test from 'node:test';
import assert from 'node:assert/strict';
import { createAthleteService } from '../lib/athlete-service.ts';
import { createAthleteTcxImportService } from '../lib/athlete-tcx-import-service.ts';
import { createTrainingLoadService } from '../lib/training-load-service.ts';
import { MAX_TCX_BYTES, parseTcxActivity } from '../lib/tcx-activity.ts';
import { formatTcxDateTime } from '../lib/tcx-time.ts';
import { readTcxUpload } from '../lib/tcx-upload.ts';
import { disposableDatabaseSkip, withDisposableDatabase } from './disposable-postgres.ts';

const tcx = `<?xml version="1.0"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2" xmlns:ext="http://www.garmin.com/xmlschemas/ActivityExtension/v2">
  <Activities><Activity Sport="Running"><Id>2026-11-07T09:00:00Z</Id><Name>Morning trail</Name>
    <Lap StartTime="2026-11-07T09:00:00Z"><TotalTimeSeconds>2700</TotalTimeSeconds><DistanceMeters>8500.2</DistanceMeters>
      <Track><Trackpoint><Time>2026-11-07T09:00:01Z</Time><Position><LatitudeDegrees>59.9</LatitudeDegrees><LongitudeDegrees>10.7</LongitudeDegrees></Position><Extensions><ext:TPX><ext:Watts>200</ext:Watts></ext:TPX></Extensions></Trackpoint></Track>
    </Lap>
  </Activity></Activities>
</TrainingCenterDatabase>`;

test('TCX parser accepts namespaced lap summaries while rejecting unsafe, unsupported, and incomplete files', () => {
  const parsed = parseTcxActivity(tcx);
  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.activity.sport, 'RUNNING');
  assert.equal(parsed.activity.title, 'Morning trail');
  assert.equal(parsed.activity.durationSec, 2700);
  assert.equal(parsed.activity.distanceMeters, 8500);
  assert.equal(parsed.activity.startedAt.toISOString(), '2026-11-07T09:00:00.000Z');
  assert.equal(parsed.activity.completedAt.toISOString(), '2026-11-07T09:45:00.000Z');
  assert.equal(parsed.activity.completedOn, '2026-11-07');
  assert.equal(parsed.activity.sourceTimezoneOffsetMinutes, 0);
  assert.match(formatTcxDateTime(parsed.activity.startedAt, parsed.activity.sourceTimezoneOffsetMinutes), /UTC\)$/);
  const acrossLocalMidnight = parseTcxActivity(tcx.replaceAll('2026-11-07T09:00:00Z', '2026-11-07T23:30:00-05:00'));
  assert.equal(acrossLocalMidnight.ok, true);
  if (acrossLocalMidnight.ok) {
    assert.equal(acrossLocalMidnight.activity.startedAt.toISOString(), '2026-11-08T04:30:00.000Z');
    assert.equal(acrossLocalMidnight.activity.completedAt.toISOString(), '2026-11-08T05:15:00.000Z');
    assert.equal(acrossLocalMidnight.activity.completedOn, '2026-11-08');
    assert.equal(acrossLocalMidnight.activity.sourceTimezoneOffsetMinutes, -300);
    assert.match(formatTcxDateTime(acrossLocalMidnight.activity.completedAt, -300), /UTC-05:00\)$/);
  }
  assert.equal(parseTcxActivity(`${tcx}${' '.repeat(MAX_TCX_BYTES - Buffer.byteLength(tcx))}`).ok, true);
  const tooLarge = parseTcxActivity(`${tcx}${' '.repeat(MAX_TCX_BYTES + 1)}`);
  assert.equal(tooLarge.ok, false);
  if (!tooLarge.ok) assert.match(tooLarge.error, /5 MB/);
  assert.equal(parseTcxActivity(tcx.replace('Sport="Running"', 'Sport="Other"')).ok, false);
  assert.equal(parseTcxActivity(tcx.replace('<TotalTimeSeconds>2700</TotalTimeSeconds>', '')).ok, false);
  assert.equal(parseTcxActivity(tcx.replace('2026-11-07T09:00:00Z', '2026-02-30T09:00:00Z')).ok, false);
  assert.equal(parseTcxActivity(tcx.replace('</Activity>', '')).ok, false);
  assert.equal(parseTcxActivity(tcx.replace('<?xml version="1.0"?>', '<!DOCTYPE x [<!ENTITY y "z">]>')).ok, false);
  assert.equal(parseTcxActivity(tcx.replace('<TrainingCenterDatabase', '<gpx').replace('</TrainingCenterDatabase>', '</gpx>')).ok, false);
});

test('TCX upload reader enforces actual streamed bytes without trusting Content-Length', async () => {
  const form = new FormData();
  form.set('file', new Blob([tcx]), 'activity.tcx');
  form.set('confirmed', 'true');
  const validRequest = new Request('http://localhost/api/import', { method: 'POST', body: form });
  const validUpload = await readTcxUpload(validRequest);
  assert.equal(validUpload.ok, true);
  if (validUpload.ok) {
    assert.equal(validUpload.upload.confirmed, true);
    assert.equal(new TextDecoder().decode(validUpload.upload.bytes), tcx);
  }

  const boundary = 'tcx-test-boundary';
  const body = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="activity.tcx"\r\nContent-Type: application/xml\r\n\r\n${'x'.repeat(MAX_TCX_BYTES + 1)}\r\n--${boundary}--\r\n`;
  const request = new Request('http://localhost/api/import', {
    method: 'POST',
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    body,
  });
  assert.equal(request.headers.has('content-length'), false);
  const result = await readTcxUpload(request);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.error, /5 MB/);
});

test('TCX import requires confirmation, scopes fingerprints per athlete, survives concurrent retry, and appears across history views', { skip: disposableDatabaseSkip }, async (t) => {
  await withDisposableDatabase(async (db) => {
    const athlete = await db.user.create({ data: { email: 'tcx-athlete@example.test', role: 'ATHLETE' } });
    const otherAthlete = await db.user.create({ data: { email: 'tcx-other@example.test', role: 'ATHLETE' } });
    const coach = await db.user.create({ data: { email: 'tcx-coach@example.test', role: 'COACH' } });
    const service = createAthleteTcxImportService({ db });
    const bytes = new TextEncoder().encode(tcx);

    await t.test('preview is read-only and save requires explicit confirmation', async () => {
      const preview = await service.preview(athlete.id, bytes);
      assert.equal(preview.ok, true);
      assert.equal(await db.session.count({ where: { athleteId: athlete.id } }), 0);
      const notConfirmed = await service.import(athlete.id, bytes, false);
      assert.equal(notConfirmed.ok, false);
      assert.equal(await db.session.count({ where: { athleteId: athlete.id } }), 0);
    });

    await t.test('concurrent retries persist one outcome and isolate the fingerprint by athlete', async () => {
      const concurrent = await Promise.all([service.import(athlete.id, bytes, true), service.import(athlete.id, bytes, true)]);
      assert.ok(concurrent.every((result) => result.ok));
      const ids = concurrent.flatMap((result) => result.ok ? [result.sessionId] : []);
      assert.equal(new Set(ids).size, 1);
      assert.equal(await db.session.count({ where: { athleteId: athlete.id } }), 1);
      const session = await db.session.findFirst({ where: { athleteId: athlete.id }, include: { blocks: true, activity: true } });
      assert.ok(session);
      assert.equal(session.source, 'athlete-tcx-import');
      assert.equal(session.status, 'completed');
      assert.equal(session.coachBaselineJson, null);
      assert.equal(session.planId, null);
      assert.equal(session.coachOwnerId, null);
      assert.equal(session.sportMetricsJson, null);
      assert.equal(session.blocks.length, 0);
      assert.equal(session.activity?.metricsSource, 'tcx-import');
      assert.equal(session.activity?.durationSec, 2700);
      assert.equal(session.activity?.distanceMeters, 8500);
      assert.equal(session.activity?.tss, null);
      assert.equal(session.activity?.compliancePct, null);
      assert.equal(session.activity?.importFingerprint?.length, 64);
      assert.equal(JSON.stringify(session).includes('59.9'), false);

      const duplicatePreview = await service.preview(athlete.id, bytes);
      assert.equal(duplicatePreview.ok && duplicatePreview.duplicate, true);
      const foreign = await service.import(otherAthlete.id, bytes, true);
      assert.equal(foreign.ok && foreign.duplicate, false);
      assert.equal(await db.session.count({ where: { athleteId: otherAthlete.id } }), 1);
      assert.equal((await service.preview(coach.id, bytes)).ok, false);
      assert.equal((await service.import(coach.id, bytes, true)).ok, false);
    });

    await t.test('preview offers only eligible same-day sessions and pairing preserves the planned workout', async () => {
      const planned = await db.session.create({
        data: {
          athleteId: athlete.id,
          date: new Date('2026-11-07T12:00:00.000Z'),
          sport: 'RUNNING',
          title: 'Planned intervals',
          status: 'planned',
          source: 'athlete-planner',
          adjusted: false,
          blocks: { create: [{ kind: 'work', zone: 3, durationSec: 600, reps: 2, sortOrder: 0 }] },
        },
        include: { blocks: true },
      });
      await db.session.create({
        data: {
          athleteId: otherAthlete.id,
          date: new Date('2026-11-07T12:00:00.000Z'),
          sport: 'RUNNING',
          title: 'Another athlete plan',
          status: 'planned',
          source: 'athlete-planner',
          adjusted: false,
        },
      });
      const coachPlan = await db.trainingPlan.create({ data: { coachOwnerId: coach.id, name: 'Coach plan', sport: 'RUNNING' } });
      await db.session.createMany({
        data: [
          { athleteId: athlete.id, date: new Date('2026-11-07T12:00:00.000Z'), sport: 'BIKING', title: 'Different sport', status: 'planned', source: 'athlete-planner' },
          { athleteId: athlete.id, date: new Date('2026-11-08T12:00:00.000Z'), sport: 'RUNNING', title: 'Different date', status: 'planned', source: 'athlete-planner' },
          { athleteId: athlete.id, date: new Date('2026-11-07T12:00:00.000Z'), sport: 'RUNNING', title: 'Coach assignment', status: 'planned', source: 'coach-assignment', assignedById: coach.id },
          { athleteId: athlete.id, date: new Date('2026-11-07T12:00:00.000Z'), sport: 'RUNNING', title: 'Training plan', status: 'planned', source: 'training-plan', trainingPlanId: coachPlan.id },
          { athleteId: athlete.id, date: new Date('2026-11-07T12:00:00.000Z'), sport: 'RUNNING', title: 'Missed session', status: 'missed', source: 'athlete-planner' },
        ],
      });
      const pairedBytes = new TextEncoder().encode(tcx.replace('<Name>Morning trail</Name>', '<Name>Paired trail</Name>'));
      const preview = await service.preview(athlete.id, pairedBytes);
      assert.equal(preview.ok, true);
      if (!preview.ok) return;
      assert.deepEqual(preview.candidates?.map(({ id, title, plannedDurationSec }) => ({ id, title, plannedDurationSec })), [
        { id: planned.id, title: 'Planned intervals', plannedDurationSec: 1200 },
      ]);

      const saved = await service.import(athlete.id, pairedBytes, true, planned.id);
      assert.equal(saved.ok, true);
      const attached = await db.session.findUnique({ where: { id: planned.id }, include: { blocks: true, activity: true } });
      assert.equal(attached?.status, 'completed');
      assert.equal(attached?.title, 'Planned intervals');
      assert.equal(attached?.date?.toISOString(), '2026-11-07T12:00:00.000Z');
      assert.equal(attached?.blocks.length, 1);
      assert.equal(attached?.blocks[0]?.durationSec, 600);
      assert.ok(attached?.coachBaselineJson);
      assert.equal(attached?.activity?.metricsSource, 'tcx-import');
      assert.equal(attached?.activity?.durationSec, 2700);
      assert.equal(attached?.activity?.tss, null);
      assert.equal(attached?.activity?.segmentsJson, '[]');
      assert.equal(attached?.activity?.actualSnapshotJson, null);

      const detail = await createAthleteService({ db }).loadSessionDetail(athlete.id, planned.id);
      assert.equal(detail?.session.plannedDurationSec, 1200);
      assert.equal(detail?.session.actualDurationSec, 2700);
      assert.equal(detail?.session.compliance, 'duration-only');
      const overview = await createTrainingLoadService({ db }).loadOverview(athlete.id, { now: new Date('2026-11-10T12:00:00.000Z') });
      const loadEntry = overview.sessions.find((item) => item.sessionId === planned.id);
      assert.equal(loadEntry?.plannedDurationSec, 1200);
      assert.equal(loadEntry?.actualDurationSec, 2700);
      assert.equal(loadEntry?.actualTss, null);
      assert.equal(loadEntry?.compliance, 'duration-only');
      const week = overview.weeks.find((item) => item.weekStart === '2026-11-02');
      assert.equal(week?.planned.durationSec, 1200);
      assert.equal(week?.completed.durationSec, 5400);
      const feed = await createAthleteService({ db }).loadActivityFeed(athlete.id);
      assert.equal(feed?.activities.find((activity) => activity.sessionId === planned.id)?.plannedDurationSec, 1200);
    });

    await t.test('a stale pairing is rejected without saving the import', async () => {
      const planned = await db.session.create({
        data: {
          athleteId: athlete.id,
          date: new Date('2026-11-07T12:00:00.000Z'),
          sport: 'RUNNING',
          title: 'Stale planned run',
          status: 'planned',
          source: 'athlete-planner',
          adjusted: false,
        },
      });
      const staleBytes = new TextEncoder().encode(tcx.replace('<Name>Morning trail</Name>', '<Name>Stale trail</Name>'));
      const preview = await service.preview(athlete.id, staleBytes);
      assert.equal(preview.ok, true);
      await db.session.update({ where: { id: planned.id }, data: { status: 'completed' } });
      const result = await service.import(athlete.id, staleBytes, true, planned.id);
      assert.deepEqual(result, { ok: false, status: 409, error: 'That planned workout is no longer available. Check the file again and choose another workout.' });
      assert.equal(await db.activity.count({ where: { athleteId: athlete.id, importFingerprint: { not: null } } }), 2);
    });

    await t.test('a missed session is not eligible for pairing', async () => {
      const missed = await db.session.create({
        data: {
          athleteId: athlete.id,
          date: new Date('2026-11-07T12:00:00.000Z'),
          sport: 'RUNNING',
          title: 'Missed run',
          status: 'missed',
          source: 'athlete-planner',
          adjusted: false,
        },
      });
      const missedBytes = new TextEncoder().encode(tcx.replace('<Name>Morning trail</Name>', '<Name>Missed pairing check</Name>'));
      const preview = await service.preview(athlete.id, missedBytes);
      assert.equal(preview.ok, true);
      if (!preview.ok) return;
      assert.equal(preview.candidates?.some((candidate) => candidate.id === missed.id), false);
      const result = await service.import(athlete.id, missedBytes, true, missed.id);
      assert.deepEqual(result, { ok: false, status: 409, error: 'That planned workout is no longer available. Check the file again and choose another workout.' });
    });

    await t.test('the recorded completion day, distance, and import provenance appear in Activity, detail, and Calendar', async () => {
      const imported = await db.session.findFirst({ where: { athleteId: athlete.id }, select: { id: true } });
      assert.ok(imported);
      const activityService = createAthleteService({ db });
      const feed = await activityService.loadActivityFeed(athlete.id);
      assert.ok(feed);
      const row = feed.activities.find((item) => item.sessionId === imported.id);
      assert.ok(row);
      assert.equal(row.completedAt.toISOString(), '2026-11-07T09:45:00.000Z');
      assert.equal(row.distanceMeters, 8500);
      assert.equal(row.tss, null);
      assert.equal(row.plannedDurationSec, 0);
      assert.equal((await activityService.loadSessionDetail(athlete.id, imported.id))?.session.compliance, 'unplanned');
      assert.equal(row.metricsSource, 'tcx-import');
      const detail = await activityService.loadSessionDetail(athlete.id, imported.id);
      assert.equal(detail?.session.activityDistanceMeters, 8500);
      assert.equal(detail?.session.metricsSource, 'tcx-import');
      assert.equal(await activityService.loadSessionDetail(otherAthlete.id, imported.id), null);
      const calendar = await activityService.loadCalendarView(athlete.id, '2026-11-07', 'month');
      assert.ok(calendar);
      const importDay = calendar.weeks.flatMap((week) => week).find((day) => day.isoDate === '2026-11-07');
      assert.ok(importDay);
      const calendarSession = importDay.sessions.find((session) => session.id === imported.id);
      assert.ok(calendarSession);
      assert.equal(calendarSession.date.toISOString().slice(0, 10), '2026-11-07');
      assert.equal(calendarSession.distanceMeters, 8500);
    });

    await t.test('a TCX completion across UTC midnight stays on the device-local day in Calendar and load history', async () => {
      const boundaryBytes = new TextEncoder().encode(tcx.replaceAll('2026-11-07T09:00:00Z', '2026-11-07T23:30:00-05:00'));
      const imported = await service.import(athlete.id, boundaryBytes, true);
      assert.equal(imported.ok, true);
      if (!imported.ok || !imported.sessionId) return;
      const session = await db.session.findUnique({ where: { id: imported.sessionId }, include: { activity: true } });
      assert.ok(session?.activity);
      assert.equal(session.date?.toISOString(), '2026-11-08T12:00:00.000Z');
      assert.equal(session.activity.startedAt?.toISOString(), '2026-11-08T04:30:00.000Z');
      assert.equal(session.activity.completedAt.toISOString(), '2026-11-08T05:15:00.000Z');
      assert.equal(session.activity.sourceTimezoneOffsetMinutes, -300);

      const activityService = createAthleteService({ db });
      const feed = await activityService.loadActivityFeed(athlete.id);
      const row = feed?.activities.find((activity) => activity.sessionId === imported.sessionId);
      assert.equal(row?.startedAt?.toISOString(), '2026-11-08T04:30:00.000Z');
      assert.equal(row?.sourceTimezoneOffsetMinutes, -300);
      const detail = await activityService.loadSessionDetail(athlete.id, imported.sessionId);
      assert.equal(detail?.session.activityStartedAt?.toISOString(), '2026-11-08T04:30:00.000Z');
      assert.equal(detail?.session.activityTimezoneOffsetMinutes, -300);

      const calendar = await activityService.loadCalendarView(athlete.id, '2026-11-08', 'month');
      const calendarDay = calendar?.weeks.flatMap((week) => week).find((day) => day.isoDate === '2026-11-08');
      assert.ok(calendarDay?.sessions.some((item) => item.id === imported.sessionId));
      assert.equal(calendar?.weeks.flatMap((week) => week).find((day) => day.isoDate === '2026-11-07')?.sessions.some((item) => item.id === imported.sessionId), false);

      const load = await createTrainingLoadService({ db }).loadOverview(athlete.id, { now: new Date('2026-11-10T12:00:00.000Z') });
      const loadedSession = load.sessions.find((item) => item.sessionId === imported.sessionId);
      assert.equal(loadedSession?.day, '2026-11-08');
      assert.equal(loadedSession?.actualDay, '2026-11-08');
    });
  });
});
