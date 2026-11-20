import test from 'node:test';
import assert from 'node:assert/strict';

import { cadenceFromCrank, parseCscMeasurement, parseCyclingPowerMeasurement, parseHeartRateMeasurement, parseIndoorBikeData, speedFromWheel } from '../lib/ride/ble-parsers.ts';
import { encodeRequestControl, encodeReset, encodeSetIndoorBikeSimulation, encodeSetTargetPower, encodeStartOrResume, encodeStopOrPause, parseControlPointResponse } from '../lib/ride/ftms-control.ts';
import { applyBias, createRidePlan, ergTargetChanged, planHasPowerTargets, targetWattsAt } from '../lib/ride/ride-plan.ts';
import {
  addReading, advanceStep, createRecording, downsampleSamples, finishRecording, normalizedPower, parseCheckpoint, pauseRecording,
  restoreRecording, resumeRecording, serializeCheckpoint, startRecording, summarizeRecording, tick, toImportPayload, type RideSample,
} from '../lib/ride/recorder.ts';
import { createSessionEditorBlock } from '../lib/session-editor.ts';
import { createEmptyPerformanceProfile } from '../lib/performance-profile.ts';
import { validateActivityImport } from '../lib/activity-import-service.ts';

function bytes(...values: number[]) {
  return Uint8Array.from(values);
}

test('indoor bike data decodes speed, cadence, power with the inverted more-data bit', () => {
  // flags 0x0044: speed present (bit0 clear), cadence (bit2), power (bit6)
  const data = parseIndoorBikeData(bytes(0x44, 0x00, 0xc4, 0x09, 0xb4, 0x00, 0xfa, 0x00));
  assert.equal(data.speedKmh, 25);
  assert.equal(data.cadenceRpm, 90);
  assert.equal(data.powerWatts, 250);
  assert.equal(data.heartRateBpm, null);
});

test('indoor bike data decodes every optional field in order', () => {
  const packet = bytes(
    0xfe, 0x1f, // all flags except bit0 (speed present)
    0x10, 0x27, // speed 100.00 km/h
    0x88, 0x13, // avg speed 50.00
    0xa0, 0x00, // cadence 80
    0x96, 0x00, // avg cadence 75
    0x40, 0x42, 0x0f, // distance 1,000,000 m (uint24)
    0xf6, 0xff, // resistance -10
    0x2c, 0x01, // power 300
    0xc8, 0x00, // avg power 200
    0x64, 0x00, 0xff, 0xff, 0xff, // energy 100 kcal, per hour n/a, per minute n/a
    0x8c, // HR 140
    0x46, // MET 7.0
    0x10, 0x0e, // elapsed 3600
    0x2c, 0x01, // remaining 300
  );
  assert.deepEqual(parseIndoorBikeData(packet), {
    speedKmh: 100, averageSpeedKmh: 50, cadenceRpm: 80, averageCadenceRpm: 75, totalDistanceMeters: 1000000, resistanceLevel: -10,
    powerWatts: 300, averagePowerWatts: 200, totalEnergyKcal: 100, energyPerHourKcal: null, energyPerMinuteKcal: null,
    heartRateBpm: 140, metabolicEquivalent: 7, elapsedSec: 3600, remainingSec: 300,
  });
});

test('indoor bike data with more-data set omits speed and rejects truncated packets', () => {
  assert.equal(parseIndoorBikeData(bytes(0x41, 0x00, 0x64, 0x00)).powerWatts, 100);
  assert.equal(parseIndoorBikeData(bytes(0x41, 0x00, 0x64, 0x00)).speedKmh, null);
  assert.equal(parseIndoorBikeData(bytes(0x41, 0x00, 0xff, 0xff)).powerWatts, -1);
  assert.throws(() => parseIndoorBikeData(bytes(0x44, 0x00, 0xc4)), RangeError);
});

test('cycling power measurement reads power and crank data after optional fields', () => {
  // flags: balance (bit0), torque (bit2), wheel (bit4), crank (bit5) = 0x35
  const packet = bytes(0x35, 0x00, 0xe8, 0x03, 0x32, 0x10, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x08, 0x0a, 0x00, 0x00, 0x04);
  const result = parseCyclingPowerMeasurement(packet);
  assert.equal(result.powerWatts, 1000);
  assert.deepEqual(result.wheel, { revolutions: 1, eventTime: 0x0800 });
  assert.deepEqual(result.crank, { revolutions: 10, eventTime1024: 0x0400 });
  assert.deepEqual(parseCyclingPowerMeasurement(bytes(0x00, 0x00, 0x96, 0x00)), { powerWatts: 150, wheel: null, crank: null });
});

test('crank cadence handles uint16 rollover and repeated events', () => {
  assert.equal(cadenceFromCrank(null, { revolutions: 1, eventTime1024: 0 }), null);
  assert.equal(cadenceFromCrank({ revolutions: 10, eventTime1024: 1024 }, { revolutions: 11, eventTime1024: 1024 + 683 }), 90);
  assert.equal(cadenceFromCrank({ revolutions: 0xffff, eventTime1024: 0xff00 }, { revolutions: 0, eventTime1024: 0x0100 }), 120);
  assert.equal(cadenceFromCrank({ revolutions: 5, eventTime1024: 100 }, { revolutions: 5, eventTime1024: 100 }), null);
});

test('CSC measurement and wheel speed', () => {
  const both = parseCscMeasurement(bytes(0x03, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x04, 0x05, 0x00, 0x00, 0x08));
  assert.deepEqual(both, { wheel: { revolutions: 10, eventTime: 1024 }, crank: { revolutions: 5, eventTime1024: 2048 } });
  assert.deepEqual(parseCscMeasurement(bytes(0x02, 0x05, 0x00, 0x00, 0x08)), { wheel: null, crank: { revolutions: 5, eventTime1024: 2048 } });
  assert.equal(speedFromWheel({ revolutions: 0, eventTime: 0 }, { revolutions: 5, eventTime: 1024 }, 2.1, 1024), 10.5);
});

test('heart rate measurement reads uint8 and uint16 formats', () => {
  assert.equal(parseHeartRateMeasurement(bytes(0x00, 0x48)), 72);
  assert.equal(parseHeartRateMeasurement(bytes(0x01, 0x2c, 0x01)), 300);
});

test('FTMS control point encoders and responses', () => {
  assert.deepEqual([...encodeRequestControl()], [0x00]);
  assert.deepEqual([...encodeReset()], [0x01]);
  assert.deepEqual([...encodeStartOrResume()], [0x07]);
  assert.deepEqual([...encodeStopOrPause('stop')], [0x08, 0x01]);
  assert.deepEqual([...encodeStopOrPause('pause')], [0x08, 0x02]);
  assert.deepEqual([...encodeSetTargetPower(300)], [0x05, 0x2c, 0x01]);
  assert.deepEqual([...encodeSetTargetPower(-5)], [0x05, 0x00, 0x00]);
  assert.deepEqual([...encodeSetIndoorBikeSimulation({ gradePercent: -1.5 })], [0x11, 0x00, 0x00, 0x6a, 0xff, 40, 51]);
  assert.deepEqual(parseControlPointResponse(bytes(0x80, 0x05, 0x01)), { requestOpcode: 0x05, result: 'success' });
  assert.deepEqual(parseControlPointResponse(bytes(0x80, 0x00, 0x05)), { requestOpcode: 0x00, result: 'control-not-permitted' });
  assert.equal(parseControlPointResponse(bytes(0x05, 0x00)), null);
});

function profileWithFtp(ftpWatts: number | null) {
  const profile = createEmptyPerformanceProfile();
  return { ...profile, cycling: { ...profile.cycling, ftpWatts } };
}

function plan() {
  const warmup = createSessionEditorBlock({ kind: 'warmup', durationSec: 4, target: { metric: 'power' as const, mode: 'relative' as const, reference: 'ftp' as const, low: 50, high: 70 } });
  const work = createSessionEditorBlock({ kind: 'work', durationSec: 3, reps: 2, target: { metric: 'power' as const, mode: 'absolute' as const, reference: null, low: 280, high: 300 } });
  const easy = createSessionEditorBlock({ kind: 'recovery', durationSec: 2, target: null });
  return createRidePlan([warmup, work, easy], profileWithFtp(200));
}

test('ride plan resolves watts, expands reps, ramps warm-ups and leaves free-ride steps empty', () => {
  const ride = plan();
  assert.equal(ride.steps.length, 4);
  assert.equal(ride.totalSec, 12);
  assert.deepEqual(ride.steps.map((step) => [step.startSec, step.startWatts, step.endWatts]), [[0, 100, 140], [4, 290, 290], [7, 290, 290], [10, null, null]]);
  assert.equal(targetWattsAt(ride.steps[0], 2), 120);
  assert.equal(targetWattsAt(ride.steps[1], 1, 10), 319);
  assert.equal(targetWattsAt(ride.steps[3], 1), null);
  assert.equal(applyBias(200, -5), 190);
  assert.equal(planHasPowerTargets(ride), true);
  assert.equal(ergTargetChanged(100, 103), false);
  assert.equal(ergTargetChanged(100, 105), true);
  assert.equal(ergTargetChanged(null, 100), true);
});

test('relative power targets without FTP become free ride', () => {
  const warmup = createSessionEditorBlock({ kind: 'warmup', durationSec: 60, target: { metric: 'power' as const, mode: 'relative' as const, reference: 'ftp' as const, low: 50, high: 70 } });
  const ride = createRidePlan([warmup], profileWithFtp(null));
  assert.equal(ride.steps[0].startWatts, null);
  assert.equal(planHasPowerTargets(ride), false);
});

const reading = (powerWatts: number) => ({ powerWatts, heartRateBpm: 140, cadenceRpm: 90, speedMetersPerSecond: 10 });

test('recorder writes 1 Hz samples, follows steps as laps and pauses without moving time', () => {
  const ride = plan();
  let rec = startRecording(createRecording(7, 'Threshold', ride), ride, 0);
  rec = addReading(rec, reading(100));
  rec = addReading(rec, reading(120));
  rec = tick(rec, ride, 1000);
  assert.equal(rec.samples[0].p, 110);
  assert.equal(rec.samples[0].tgt, 100);
  rec = tick(rec, ride, 4000, reading(130));
  assert.equal(rec.timerSec, 4);
  assert.equal(rec.stepIndex, 1);
  assert.deepEqual(rec.laps[0], { stepIndex: 0, startSec: 0, endSec: 4 });
  rec = pauseRecording(rec, ride, 4500);
  rec = tick(rec, ride, 9000);
  assert.equal(rec.timerSec, 4);
  assert.equal(rec.elapsedSec, 9);
  rec = resumeRecording(rec, ride, 9000);
  rec = advanceStep(rec, ride);
  assert.equal(rec.stepIndex, 2);
  rec = tick(rec, ride, 10000, reading(0));
  assert.equal(rec.movingSec, 4 + 0 + 1); // cadence still > 0
  rec = finishRecording(rec, ride, 10000);
  assert.equal(rec.status, 'finished');
  assert.ok(rec.laps.every((lap) => lap.endSec !== null));
});

test('recorder after the plan keeps recording as a free-ride lap', () => {
  const ride = plan();
  let rec = startRecording(createRecording(7, 'Threshold', ride), ride, 0);
  rec = tick(rec, ride, 15000, reading(200));
  assert.equal(rec.stepIndex, ride.steps.length);
  assert.equal(rec.laps.at(-1)?.stepIndex, ride.steps.length);
  assert.equal(rec.samples.at(-1)?.tgt, null);
  // Long gaps keep the timer but record no sensor values after the hold window.
  assert.equal(rec.samples[3].p, 200);
  assert.equal(rec.samples[10].p, null);
});

test('summary computes power, heart rate, cadence, work and TSS', () => {
  const ride = plan();
  let rec = startRecording(createRecording(7, 'Threshold', ride), ride, 0);
  for (let second = 1; second <= 60; second += 1) rec = tick(addReading(rec, reading(200)), ride, second * 1000);
  const summary = summarizeRecording(rec, 200);
  assert.equal(summary.averagePowerWatts, 200);
  assert.equal(summary.normalizedPowerWatts, 200);
  assert.equal(summary.maxPowerWatts, 200);
  assert.equal(summary.averageHeartRateBpm, 140);
  assert.equal(summary.averageCadenceRpm, 90);
  assert.equal(summary.workKj, 12);
  assert.equal(summary.intensityFactor, 1);
  assert.equal(summary.tss, 2);
  assert.equal(summary.distanceMeters, 600);
  assert.equal(normalizedPower([null, null]), null);
});

test('import payload passes the activity import validator and downsamples long rides', () => {
  const ride = plan();
  let rec = startRecording(createRecording(7, 'Threshold', ride), ride, Date.UTC(2026, 10, 20, 7));
  rec = tick(rec, ride, Date.UTC(2026, 10, 20, 7) + 13000, reading(210));
  rec = finishRecording(rec, ride, Date.UTC(2026, 10, 20, 7) + 13000);
  const payload = toImportPayload(rec);
  assert.equal(payload.startedAt, '2026-11-20T07:00:00.000Z');
  assert.equal(payload.durationSec, 13);
  assert.equal(payload.plannedSessionId, 7);
  assert.deepEqual(payload.laps.map((lap) => [lap.startSec, lap.endSec]), [[0, 4], [4, 7], [7, 10], [10, 12], [12, 13]]);
  const validated = validateActivityImport(payload);
  assert.equal(validated.ok, true, validated.ok ? '' : validated.error);

  const samples: RideSample[] = Array.from({ length: 45000 }, (_, t) => ({ t, p: t % 2 ? 100 : 200, hr: 150, cad: 90, spd: 9, d: t * 9, tgt: null }));
  const points = downsampleSamples(samples);
  assert.ok(points.length <= 20000);
  assert.equal(points.length, 15000);
  assert.deepEqual(points[1], { elapsedSec: 3, powerWatts: 133, heartRateBpm: 150, cadenceRpm: 90, speedMetersPerSecond: 9, distanceMeters: 45 });
});

test('empty ride still produces a valid payload', () => {
  const ride = plan();
  const rec = finishRecording(startRecording(createRecording(7, 'Threshold', ride), ride, 0), ride, 500);
  const validated = validateActivityImport(toImportPayload(rec));
  assert.equal(validated.ok, true);
});

test('checkpoint round-trips, rejects other versions and restores paused', () => {
  const ride = plan();
  let rec = startRecording(createRecording(7, 'Threshold', ride), ride, 0);
  rec = tick(rec, ride, 3000, reading(150));
  const parsed = parseCheckpoint(serializeCheckpoint(rec, 3000));
  assert.ok(parsed);
  assert.equal(parsed.savedAtMs, 3000);
  assert.deepEqual(parsed.recording.samples, rec.samples);
  const restored = restoreRecording(parsed.recording);
  assert.equal(restored.status, 'paused');
  assert.equal(restored.lastTickAtMs, null);
  const resumed = tick(resumeRecording(restored, ride, 100000), ride, 101000, reading(150));
  assert.equal(resumed.timerSec, 4);

  assert.equal(parseCheckpoint(serializeCheckpoint(rec, 1).replace('"version":1,"savedAtMs"', '"version":2,"savedAtMs"')), null);
  assert.equal(parseCheckpoint('not json'), null);
  assert.equal(parseCheckpoint(JSON.stringify({ kind: 'tempo-ride', version: 1, savedAtMs: 1, recording: { ...rec, timerSec: 99 } })), null);
});

test('chart maps recorded power onto the plan timeline after a skip', async () => {
  const { planPositionSec, powerBuckets, complianceTone } = await import('../lib/ride/ride-chart.ts');
  const ride = plan();
  let rec = startRecording(createRecording(7, 'Threshold', ride), ride, 0);
  rec = tick(rec, ride, 2000, reading(100));
  rec = advanceStep(rec, ride); // skip rest of warm-up → plan second 4
  rec = tick(rec, ride, 3000, reading(300));
  assert.equal(planPositionSec(rec, ride), 5);
  const buckets = powerBuckets(rec, ride, ride.totalSec, 100);
  assert.deepEqual(buckets.map((bucket) => [bucket.x, bucket.power, bucket.target]), [[0, 100, 100], [1, 100, 110], [4, 300, 290]]);
  assert.equal(complianceTone(300, 290), 'on');
  assert.equal(complianceTone(330, 290), 'over');
  assert.equal(complianceTone(200, 290), 'under');
  assert.equal(complianceTone(200, null), 'none');
});

test('lap stats average each step and report the open lap', async () => {
  const { summarizeLaps, currentLapStats } = await import('../lib/ride/recorder.ts');
  const profile = createEmptyPerformanceProfile();
  profile.cycling.ftpWatts = 200;
  const blocks = [
    createSessionEditorBlock({ kind: 'work', durationSec: 3, target: { metric: 'power' as const, mode: 'relative' as const, reference: 'ftp' as const, low: 50, high: 50 } }),
    createSessionEditorBlock({ kind: 'recovery', durationSec: 10, target: null }),
  ];
  const plan = createRidePlan(blocks, profile);
  let recording = startRecording(createRecording(1, 'Laps', plan), plan, 0);
  for (const [second, power, hr] of [[1, 100, 120], [2, 110, 0], [3, 120, 130], [4, 300, 150], [5, 200, 140]] as const) {
    recording = tick(addReading(recording, { powerWatts: power, heartRateBpm: hr || null, cadenceRpm: 90, speedMetersPerSecond: null }), plan, second * 1000);
  }
  const laps = summarizeLaps(recording);
  assert.equal(laps.length, 2);
  assert.deepEqual(
    { ...laps[0] },
    { stepIndex: 0, startSec: 0, durationSec: 3, averagePowerWatts: 110, maxPowerWatts: 120, averageTargetWatts: 100, averageHeartRateBpm: 125, maxHeartRateBpm: 130, averageCadenceRpm: 90 },
  );
  const open = currentLapStats(recording);
  assert.equal(open?.stepIndex, 1);
  assert.equal(open?.durationSec, 2);
  assert.equal(open?.averagePowerWatts, 250);
  assert.equal(open?.maxHeartRateBpm, 150);
  assert.equal(currentLapStats(createRecording(1, 'x', plan)), null);
});

test('ride app launch detects OS and orders installers', async () => {
  const { detectRideOs, rideDownloads, rideDownloadBase, rideAppLink, rideInstallHints } = await import('../lib/ride/launch.ts');
  assert.equal(detectRideOs({ platform: 'Windows' }), 'windows');
  assert.equal(detectRideOs({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit' }), 'macos');
  assert.equal(detectRideOs({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64)' }), 'linux');
  assert.equal(detectRideOs({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)' }), 'other');
  assert.equal(detectRideOs({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)' }), 'other');
  assert.equal(detectRideOs({}), 'other');

  assert.equal(rideDownloadBase(null), 'https://github.com/ErikSteLarsen/glowing-couscous/releases/latest/download');
  assert.equal(rideDownloadBase(' https://example.com/r/ '), 'https://example.com/r');
  const mac = rideDownloads('macos', 'https://x');
  assert.equal(mac[0].url, 'https://x/Tempo-Ride-macOS-arm64.dmg');
  assert.equal(rideDownloads('macos', 'https://x', 'x86')[0].fileName, 'Tempo-Ride-macOS-x64.dmg');
  assert.equal(rideDownloads('linux')[0].fileName, 'Tempo-Ride-Linux.AppImage');
  assert.equal(rideDownloads('windows')[0].fileName, 'Tempo-Ride-Windows-Setup.exe');
  assert.equal(rideDownloads('other').length, 5);
  assert.equal(rideAppLink('https://t.app/athlete/ride/4'), 'tempo-ride://open?url=https%3A%2F%2Ft.app%2Fathlete%2Fride%2F4');
  assert.ok(rideInstallHints('linux').some((hint) => hint.includes('chmod +x')));
});
