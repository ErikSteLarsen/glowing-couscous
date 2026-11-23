import assert from 'node:assert/strict';
import test from 'node:test';

import { bucketActivityMetric, formatActivityMetricValue } from '../lib/activity-series.ts';

test('heart rate uses minute-sized bars and keeps the observed interval range', () => {
  const chart = bucketActivityMetric([
    { elapsedSec: 2, heartRateBpm: 120 },
    { elapsedSec: 30, heartRateBpm: 140 },
    { elapsedSec: 61, heartRateBpm: 150 },
  ], 'heartRate', { durationSec: 120 });

  assert.equal(chart.buckets.length, 2);
  assert.equal(chart.interval, 60);
  assert.equal(chart.buckets[0].average, 130);
  assert.equal(chart.buckets[0].min, 120);
  assert.equal(chart.buckets[0].max, 140);
});

test('a 30-minute heart-rate recording produces one bar per minute', () => {
  const chart = bucketActivityMetric(
    Array.from({ length: 1800 }, (_, elapsedSec) => ({ elapsedSec, heartRateBpm: 120 + (elapsedSec % 20) })),
    'heartRate',
    { durationSec: 1800 },
  );

  assert.equal(chart.buckets.length, 30);
  assert.equal(chart.interval, 60);
});

test('elevation uses distance bins and adapts to long activities', () => {
  const chart = bucketActivityMetric([
    { elapsedSec: 0, distanceMeters: 0, elevationMeters: 80 },
    { elapsedSec: 60, distanceMeters: 50, elevationMeters: 82 },
    { elapsedSec: 120, distanceMeters: 100, elevationMeters: 89 },
  ], 'elevation', { distanceMeters: 100 });

  assert.equal(chart.axis, 'distance');
  assert.equal(chart.interval, 50);
  assert.equal(chart.buckets.length, 2);
  assert.equal(chart.buckets[1].sampleCount, 2);

  const longChart = bucketActivityMetric(
    Array.from({ length: 401 }, (_, index) => ({
      elapsedSec: index * 10,
      distanceMeters: index * 100,
      elevationMeters: index,
    })),
    'elevation',
    { distanceMeters: 40000 },
  );
  assert.ok(longChart.buckets.length <= 120);
  assert.ok(longChart.interval > 50);
});

test('pace converts speed to min/km and uses higher bars for faster pace', () => {
  const chart = bucketActivityMetric([
    { elapsedSec: 0, speedMetersPerSecond: 2.5 },
    { elapsedSec: 61, speedMetersPerSecond: 5 },
  ], 'pace', { durationSec: 120 });

  assert.equal(formatActivityMetricValue('pace', chart.buckets[0].average), '6:40\u00A0/km');
  assert.ok(chart.buckets[1].heightPercent > chart.buckets[0].heightPercent);
});

test('missing or non-finite sensor values do not create bars', () => {
  const chart = bucketActivityMetric([
    { elapsedSec: 0, heartRateBpm: null },
    { elapsedSec: 10, heartRateBpm: Number.NaN },
  ], 'heartRate', { durationSec: 60 });

  assert.equal(chart.buckets.length, 0);
});
