import test from 'node:test';
import assert from 'node:assert/strict';
import { createAthleteGpxImportService } from '../lib/athlete-gpx-import-service.ts';
import { createAthleteService } from '../lib/athlete-service.ts';
import { createTrainingLoadService } from '../lib/training-load-service.ts';
import { MAX_GPX_TRACK_POINTS, parseGpxActivity } from '../lib/gpx-activity.ts';
import { readActivityUpload } from '../lib/tcx-upload.ts';
import { addSessionEditorBlock, createEmptySessionEditorDraft } from '../lib/session-editor.ts';
import { serializeSessionSnapshot } from '../lib/session-snapshot-service.ts';
import { disposableDatabaseSkip, withDisposableDatabase } from './disposable-postgres.ts';

const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Tempo test" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>Metadata is not the activity title</name></metadata>
  <trk><name>Evening trail</name>
    <trkseg>
      <trkpt lat="59.900" lon="10.700"><ele>100</ele><time>2026-11-07T23:45:00-05:00</time></trkpt>
      <trkpt lat="59.901" lon="10.700"><ele>110</ele><time>2026-11-08T00:00:00-05:00</time></trkpt>
    </trkseg>
    <trkseg>
      <trkpt lat="60.000" lon="10.700"><time>2026-11-08T00:05:00-05:00</time></trkpt>
      <trkpt lat="60.001" lon="10.700"><time>2026-11-08T00:15:00-05:00</time></trkpt>
    </trkseg>
  </trk>
</gpx>`;

const bytes = (source = gpx) => new TextEncoder().encode(source);

test('GPX parser derives timed activity summaries and discards segment coordinates from the result', () => {
  const result = parseGpxActivity(gpx, 'RUNNING');
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.activity.sport, 'RUNNING');
  assert.equal(result.activity.title, 'Evening trail');
  assert.equal(result.activity.startedAt.toISOString(), '2026-11-08T04:45:00.000Z');
  assert.equal(result.activity.completedAt.toISOString(), '2026-11-08T05:15:00.000Z');
  assert.equal(result.activity.completedOn, '2026-11-08');
  assert.equal(result.activity.sourceTimezoneOffsetMinutes, -300);
  assert.equal(result.activity.durationSec, 1800);
  assert.ok(result.activity.distanceMeters !== null && result.activity.distanceMeters > 200 && result.activity.distanceMeters < 230);
  assert.equal(Object.keys(result.activity).some((key) => /coordinate|latitude|longitude|trackpoint/i.test(key)), false);
  assert.equal(parseGpxActivity(gpx, 'BIKING').ok, true);
  assert.equal(parseGpxActivity(gpx, 'SWIMMING').ok, true);
  assert.equal(parseGpxActivity(gpx, 'OTHER').ok, false);
});

test('GPX parser rejects route-only, ambiguous, malformed, untimed, and unsafe activity data', () => {
  const missingTime = gpx.replace('<time>2026-11-08T00:00:00-05:00</time>', '');
  const missingOffset = gpx.replace('2026-11-08T00:00:00-05:00', '2026-11-08T00:00:00');
  const mixedOffset = gpx.replace('2026-11-08T00:00:00-05:00', '2026-11-08T00:00:00-04:00');
  const invalidCoordinate = gpx.replace('lat="59.900"', 'lat="91"');
  const unordered = gpx.replace('2026-11-08T00:00:00-05:00', '2026-11-07T23:40:00-05:00');
  const tooLong = gpx.replace('2026-11-07T23:45:00-05:00', '1900-11-07T23:45:00-05:00');
  const extraTrack = gpx.replace('</gpx>', '<trk><trkseg><trkpt lat="1" lon="1"><time>2026-11-08T00:20:00-05:00</time></trkpt></trkseg></trk></gpx>');
  const routeOnly = `<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"><rte><rtept lat="59" lon="10"/></rte></gpx>`;
  const doctype = gpx.replace('<?xml version="1.0" encoding="UTF-8"?>', '<!DOCTYPE gpx [<!ENTITY x "y">]>');

  for (const source of [missingTime, missingOffset, mixedOffset, invalidCoordinate, unordered, tooLong, extraTrack, routeOnly, doctype, '<gpx><trk>']) {
    assert.equal(parseGpxActivity(source, 'RUNNING').ok, false);
  }
  assert.equal(parseGpxActivity(gpx, '').ok, false);
  assert.equal(parseGpxActivity(`${gpx}${' '.repeat(5 * 1024 * 1024)}`, 'RUNNING').ok, false);

  const tooManyPoints = Array.from({ length: MAX_GPX_TRACK_POINTS + 1 }, () =>
    '<trkpt lat="59" lon="10"><time>2026-11-08T00:00:00Z</time></trkpt>',
  ).join('');
  const overLimit = `<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg>${tooManyPoints}</trkseg></trk></gpx>`;
  const limitResult = parseGpxActivity(overLimit, 'RUNNING');
  assert.equal(limitResult.ok, false);
  if (!limitResult.ok) assert.match(limitResult.error, /at most/);

  const longTrack = Array.from({ length: 110 }, (_, index) => {
    const location = index % 2 === 0 ? 'lat="0" lon="0"' : 'lat="0" lon="180"';
    const time = new Date(Date.parse('2026-11-08T00:00:00.000Z') + index * 1000).toISOString();
    return `<trkpt ${location}><time>${time}</time></trkpt>`;
  }).join('');
  const overRange = parseGpxActivity(`<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg>${longTrack}</trkseg></trk></gpx>`, 'RUNNING');
  assert.equal(overRange.ok, false);
  if (!overRange.ok) assert.match(overRange.error, /distance exceeds/);
});

test('activity upload reader requires one selected sport for GPX only', async () => {
  const form = new FormData();
  form.set('file', new Blob([gpx]), 'training.gpx');
  form.set('sport', 'BIKING');
  const result = await readActivityUpload(new Request('http://localhost/api/import', { method: 'POST', body: form }));
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.upload.format, 'gpx');
    assert.equal(result.upload.sport, 'BIKING');
  }

  const confirmedForm = new FormData();
  confirmedForm.set('file', new Blob([gpx]), 'training.gpx');
  confirmedForm.set('confirmed', 'true');
  confirmedForm.set('pairingChoice', 'separate');
  confirmedForm.set('sport', 'RUNNING');
  const confirmed = await readActivityUpload(new Request('http://localhost/api/import', { method: 'POST', body: confirmedForm }));
  assert.equal(confirmed.ok, true);
  if (confirmed.ok) {
    assert.equal(confirmed.upload.confirmed, true);
    assert.equal(confirmed.upload.pairingChoice, 'separate');
    assert.equal(confirmed.upload.sport, 'RUNNING');
  }

  const missingSport = new FormData();
  missingSport.set('file', new Blob([gpx]), 'training.gpx');
  const missing = await readActivityUpload(new Request('http://localhost/api/import', { method: 'POST', body: missingSport }));
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.match(missing.error, /Choose Running, Cycling, or Swimming/);

  const invalidSport = new FormData();
  invalidSport.set('file', new Blob([gpx]), 'training.gpx');
  invalidSport.set('sport', 'WALKING');
  const invalid = await readActivityUpload(new Request('http://localhost/api/import', { method: 'POST', body: invalidSport }));
  assert.equal(invalid.ok, false);

  const multipleFiles = new FormData();
  multipleFiles.append('file', new Blob([gpx]), 'one.gpx');
  multipleFiles.append('file', new Blob([gpx]), 'two.gpx');
  multipleFiles.set('sport', 'RUNNING');
  const multiple = await readActivityUpload(new Request('http://localhost/api/import', { method: 'POST', body: multipleFiles }));
  assert.equal(multiple.ok, false);
  if (!multiple.ok) assert.match(multiple.error, /one activity file/);
});

test('GPX import persists summary-only activity, deduplicates by athlete, and can attach to a planned session', { skip: disposableDatabaseSkip }, async (t) => {
  await withDisposableDatabase(async (db) => {
    const athlete = await db.user.create({ data: { email: 'gpx-athlete@example.test', role: 'ATHLETE' } });
    const otherAthlete = await db.user.create({ data: { email: 'gpx-other@example.test', role: 'ATHLETE' } });
    const coach = await db.user.create({ data: { email: 'gpx-coach@example.test', role: 'COACH' } });
    const service = createAthleteGpxImportService({ db });
    const activityBytes = bytes();

    await t.test('preview is read-only, confirmation is required, and duplicate preview keeps the saved sport', async () => {
      const preview = await service.preview(athlete.id, activityBytes, 'RUNNING');
      assert.equal(preview.ok, true);
      assert.equal(await db.session.count({ where: { athleteId: athlete.id } }), 0);
      const denied = await service.preview(coach.id, activityBytes, 'RUNNING');
      assert.equal(denied.ok, false);
      const unconfirmed = await service.import(athlete.id, activityBytes, 'RUNNING', false);
      assert.equal(unconfirmed.ok, false);

      const first = await service.import(athlete.id, activityBytes, 'RUNNING', true);
      assert.equal(first.ok, true);
      if (!first.ok || !first.sessionId) return;
      const duplicate = await service.preview(athlete.id, activityBytes, 'BIKING');
      assert.equal(duplicate.ok, true);
      if (duplicate.ok) {
        assert.equal(duplicate.duplicate, true);
        assert.equal(duplicate.activity.sport, 'RUNNING');
        assert.equal(duplicate.sessionId, first.sessionId);
      }
      const secondOwner = await service.import(otherAthlete.id, activityBytes, 'BIKING', true);
      assert.equal(secondOwner.ok, true);
      if (secondOwner.ok) assert.equal(secondOwner.duplicate, false);

      const saved = await db.session.findUnique({ where: { id: first.sessionId }, include: { activity: true } });
      assert.equal(saved?.source, 'athlete-gpx-import');
      assert.equal(saved?.activity?.metricsSource, 'gpx-import');
      assert.equal(saved?.activity?.startedAt?.toISOString(), '2026-11-08T04:45:00.000Z');
      assert.equal(saved?.activity?.completedAt.toISOString(), '2026-11-08T05:15:00.000Z');
      assert.equal(saved?.activity?.sourceTimezoneOffsetMinutes, -300);
      assert.equal(saved?.activity?.tss, null);
      assert.equal(saved?.activity?.compliancePct, null);
      assert.equal(saved?.activity?.segmentsJson, '[]');
      assert.equal(saved?.activity?.actualSnapshotJson, null);
      assert.equal(saved?.activity?.distanceMeters !== null, true);
    });

    await t.test('standalone GPX source-local day appears consistently in Activity, Calendar, and load history', async () => {
      const imported = await db.session.findFirst({ where: { athleteId: athlete.id }, select: { id: true } });
      assert.ok(imported);
      const athleteService = createAthleteService({ db });
      const feed = await athleteService.loadActivityFeed(athlete.id);
      const row = feed?.activities.find((item) => item.sessionId === imported.id);
      assert.equal(row?.metricsSource, 'gpx-import');
      assert.equal(row?.completedAt.toISOString(), '2026-11-08T05:15:00.000Z');
      assert.ok(row?.distanceMeters !== null);
      assert.equal(row?.plannedDurationSec, 0);
      const detail = await athleteService.loadSessionDetail(athlete.id, imported.id);
      assert.equal(detail?.session.metricsSource, 'gpx-import');
      assert.equal(detail?.session.activityTimezoneOffsetMinutes, -300);
      assert.equal(await athleteService.loadSessionDetail(otherAthlete.id, imported.id), null);
      const calendar = await athleteService.loadCalendarView(athlete.id, '2026-11-08', 'month');
      const activityDay = calendar?.weeks.flatMap((week) => week).find((day) => day.isoDate === '2026-11-08');
      assert.ok(activityDay?.sessions.some((session) => session.id === imported.id));
      const load = await createTrainingLoadService({ db }).loadOverview(athlete.id, { now: new Date('2026-11-12T12:00:00.000Z') });
      const loadRow = load.sessions.find((session) => session.sessionId === imported.id);
      assert.equal(loadRow?.actualDay, '2026-11-08');
      assert.equal(loadRow?.compliance, 'unplanned');
    });

    await t.test('concurrent retries create one activity for the athlete', async () => {
      const concurrentBytes = bytes(gpx.replace('Evening trail', 'Concurrent GPX'));
      const attempts = await Promise.all([
        service.import(athlete.id, concurrentBytes, 'RUNNING', true),
        service.import(athlete.id, concurrentBytes, 'RUNNING', true),
      ]);
      assert.ok(attempts.every((result) => result.ok));
      const ids = attempts.flatMap((result) => result.ok ? [result.sessionId] : []);
      assert.equal(new Set(ids).size, 1);
      assert.equal(await db.session.count({ where: { athleteId: athlete.id, title: 'Concurrent GPX' } }), 1);
    });

    await t.test('explicit GPX pairing preserves the plan and only records duration comparison', async () => {
      const plannedDraft = addSessionEditorBlock(createEmptySessionEditorDraft({
        mode: 'planned', athleteId: athlete.id, scheduledDate: '2026-11-08', title: 'GPX paired plan', sport: 'RUNNING',
      }), { kind: 'work', zone: 3, durationSec: 1200 });
      const baseline = serializeSessionSnapshot(plannedDraft);
      const planned = await db.session.create({
        data: {
          athleteId: athlete.id,
          date: new Date('2026-11-08T12:00:00.000Z'),
          sport: 'RUNNING',
          title: 'GPX paired plan',
          status: 'planned',
          source: 'athlete-planner',
          adjusted: false,
          coachBaselineJson: baseline,
          blocks: { create: [{ kind: 'work', zone: 3, durationSec: 1200, sortOrder: 0 }] },
        },
      });
      const pairedBytes = bytes(gpx.replace('Evening trail', 'Paired run'));
      const preview = await service.preview(athlete.id, pairedBytes, 'RUNNING');
      assert.equal(preview.ok, true);
      if (preview.ok) assert.deepEqual(preview.candidates?.map((candidate) => candidate.id), [planned.id]);
      const imported = await service.import(athlete.id, pairedBytes, 'RUNNING', true, planned.id);
      assert.equal(imported.ok, true);
      const saved = await db.session.findUnique({ where: { id: planned.id }, include: { activity: true, blocks: true } });
      assert.equal(saved?.status, 'completed');
      assert.equal(saved?.title, 'GPX paired plan');
      assert.equal(saved?.coachBaselineJson, baseline);
      assert.equal(saved?.blocks[0]?.durationSec, 1200);
      assert.equal(saved?.activity?.metricsSource, 'gpx-import');
      assert.equal(saved?.activity?.actualSnapshotJson, null);
      assert.equal(saved?.activity?.tss, null);
      const detail = await createAthleteService({ db }).loadSessionDetail(athlete.id, planned.id);
      assert.equal(detail?.session.compliance, 'duration-only');
      assert.equal(detail?.session.plannedDurationSec, 1200);
      const feed = await createAthleteService({ db }).loadActivityFeed(athlete.id);
      assert.equal(feed?.activities.find((activity) => activity.sessionId === planned.id)?.plannedDurationSec, 1200);
    });
  });
});
