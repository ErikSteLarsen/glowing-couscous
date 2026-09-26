import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeStravaActivity,
  normalizeStravaSport,
  toStravaActivitySummary,
} from '../lib/strava-normalizer.ts';

test('Strava sport types map to the app workout categories with a safe fallback', () => {
  assert.equal(normalizeStravaSport('TrailRun'), 'RUNNING');
  assert.equal(normalizeStravaSport('MountainBikeRide'), 'BIKING');
  assert.equal(normalizeStravaSport('Swim'), 'SWIMMING');
  assert.equal(normalizeStravaSport('WeightTraining'), 'STRENGTH');
  assert.equal(normalizeStravaSport('Yoga'), 'STRETCHING');
  assert.equal(normalizeStravaSport('Snowshoe'), 'OTHER');
});

test('summary mapping keeps training metadata and excludes location and free text', () => {
  const summary = toStravaActivitySummary({
    id: 123,
    name: 'Morning run',
    sport_type: 'Run',
    start_date: '2026-09-26T08:00:00Z',
    elapsed_time: 1800,
    distance: 5000,
    total_elevation_gain: 82,
    moving_time: 1700,
    elev_high: 122,
    elev_low: 40,
    timezone: '(GMT+01:00) Europe/Oslo',
    average_heartrate: 144,
    max_heartrate: 181,
    average_speed: 2.78,
    kilojoules: 510,
    device_watts: true,
    start_latlng: [59.91, 10.75],
    description: 'Private route note',
  });

  assert.equal(summary.sport, 'RUNNING');
  assert.equal(summary.durationSec, 1800);
  assert.equal(summary.distanceMeters, 5000);
  assert.equal(summary.elevationGainMeters, 82);
  assert.equal(summary.metadata.averageHeartrate, 144);
  assert.equal(summary.metadata.maxHeartrate, 181);
  assert.equal(summary.metadata.averageSpeed, 2.78);
  assert.equal(summary.metadata.movingTimeSec, 1700);
  assert.equal(summary.metadata.elevationHighMeters, 122);
  assert.equal(summary.metadata.elevationLowMeters, 40);
  assert.equal(summary.metadata.kilojoules, 510);
  assert.equal(summary.metadata.deviceWatts, true);
  assert.equal(summary.metadata.timezone, '(GMT+01:00) Europe/Oslo');
  assert.equal('start_latlng' in summary.metadata, false);
  assert.equal('description' in summary.metadata, false);
});

test('recorded streams align by elapsed time and ignore unsafe sensor values', () => {
  const normalized = normalizeStravaActivity({
    id: 123,
    name: 'Interval run',
    sport_type: 'Run',
    start_date: '2026-09-26T08:00:00Z',
    elapsed_time: 180,
    distance: 600,
    total_elevation_gain: 12,
  }, {
    time: { data: [0, 60, 120, 180] },
    distance: { data: [0, 200, 300, 600] },
    altitude: { data: [100, 104, 105, 112] },
    heartrate: { data: [120, 144, 280, 150] },
    velocity_smooth: { data: [2.5, 3, 2.7, 0] },
    watts: { data: [180, 220, 5001, 200] },
    cadence: { data: [80, 86, 88, 90] },
    grade_smooth: { data: [1, 2, 150, -1] },
    temp: { data: [12, 13, 14, 15] },
  });

  assert.equal(normalized.points.length, 4);
  assert.deepEqual(normalized.points[1], {
    elapsedSec: 60,
    distanceMeters: 200,
    elevationMeters: 104,
    heartRateBpm: 144,
    speedMetersPerSecond: 3,
    powerWatts: 220,
    cadenceRpm: 86,
    gradePercent: 2,
    temperatureCelsius: 13,
  });
  assert.equal(normalized.points[2].heartRateBpm, undefined);
  assert.equal(normalized.points[2].powerWatts, undefined);
  assert.equal(normalized.points[2].gradePercent, undefined);
  assert.equal(normalized.points[3].heartRateBpm, 150);
});

test('summary-only fallback does not mislabel elevation gain as altitude', () => {
  const normalized = normalizeStravaActivity({
    name: 'Gym session',
    sport_type: 'WeightTraining',
    start_date: '2026-09-26T08:00:00Z',
    elapsed_time: 3600,
    total_elevation_gain: 250,
    average_heartrate: 110,
    average_cadence: 70,
  }, {});

  assert.equal(normalized.points.length, 1);
  assert.equal(normalized.points[0].heartRateBpm, 110);
  assert.equal(normalized.points[0].cadenceRpm, 70);
  assert.equal(normalized.points[0].elevationMeters, undefined);
  assert.equal(normalized.elevationGainMeters, 250);
});

test('long Strava streams are capped while preserving the final sample', () => {
  const time = Array.from({ length: 20_500 }, (_, index) => index);
  const normalized = normalizeStravaActivity({
    name: 'Long activity',
    sport_type: 'Ride',
    start_date: '2026-09-26T08:00:00Z',
    elapsed_time: time.length,
  }, { time: { data: time }, heartrate: { data: time.map(() => 120) } });

  assert.equal(normalized.points.length, 20_000);
  assert.equal(normalized.points.at(-1)?.elapsedSec, 20_499);
});
