import assert from 'node:assert/strict';
import test from 'node:test';
import { hasExecutionSteps } from '../lib/athlete-execution.ts';
import { detectRideOs } from '../lib/ride/launch.ts';
import { getWorkoutStartOptions, type WorkoutStartRuntime } from '../lib/workout-start.ts';

const bike = { sport: 'BIKING', status: 'planned', hasSteps: true };
const follow = ['live', 'Follow along'];
const openApp = ['app', 'Open in Wattonaut Ride'];
const rideInBrowser = ['ride', 'Ride in this browser'];
const targetsOnly = ['ride', 'Ride without devices'];
const rideInApp = ['ride', 'Ride in Wattonaut Ride'];

function choices(workout: typeof bike, runtime: WorkoutStartRuntime) {
  return getWorkoutStartOptions(workout, runtime).map(({ mode, label }) => [mode, label]);
}

test('bike choices follow Web Bluetooth capability, desktop platform and host app', () => {
  for (const os of ['windows', 'macos', 'linux'] as const) {
    assert.deepEqual(choices(bike, { os, webBluetooth: true, inTempoRide: false }), [openApp, rideInBrowser, follow]);
    assert.deepEqual(choices(bike, { os, webBluetooth: false, inTempoRide: false }), [openApp, follow, targetsOnly]);
  }
  assert.deepEqual(choices(bike, { os: 'other', webBluetooth: true, inTempoRide: false }), [rideInBrowser, follow]);
  assert.deepEqual(choices(bike, { os: 'other', webBluetooth: false, inTempoRide: false }), [follow, targetsOnly]);
  for (const webBluetooth of [true, false]) {
    const options = getWorkoutStartOptions(bike, { os: 'linux', webBluetooth, inTempoRide: true });
    assert.deepEqual(options.map(({ mode, label }) => [mode, label]), [rideInApp, follow]);
    assert.match(options[0].description, webBluetooth ? /over Bluetooth/ : /ride time is saved/);
  }
});

test('open non-bike workouts follow along, and terminal, rest and stepless workouts have no start', () => {
  const runtime: WorkoutStartRuntime = { os: 'macos', webBluetooth: true, inTempoRide: false };
  for (const sport of ['RUNNING', 'SWIMMING', 'STRENGTH', 'STRETCHING']) {
    assert.deepEqual(choices({ ...bike, sport }, runtime), [follow]);
  }
  for (const workout of [
    { ...bike, status: 'completed' },
    { ...bike, status: 'skipped' },
    { ...bike, sport: 'REST' },
    { ...bike, hasSteps: hasExecutionSteps([]) },
    { ...bike, hasSteps: hasExecutionSteps([{ skipped: true }]) },
  ]) {
    assert.deepEqual(choices(workout, runtime), []);
  }
  assert.equal(hasExecutionSteps([{ skipped: true }, { skipped: false }]), true);
});

test('mobile devices with desktop-like platform hints have no desktop app choice', () => {
  assert.equal(detectRideOs({ platform: 'MacIntel', userAgent: 'Macintosh', maxTouchPoints: 5 }), 'other');
  assert.equal(detectRideOs({ platform: 'MacIntel', userAgent: 'Macintosh', maxTouchPoints: 0 }), 'macos');
  assert.equal(detectRideOs({ platform: 'Linux', userAgent: 'Android' }), 'other');
});
