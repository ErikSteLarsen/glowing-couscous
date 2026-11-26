import assert from 'node:assert/strict';
import test from 'node:test';
import { hasExecutionSteps } from '../lib/athlete-execution.ts';
import { detectRideOs } from '../lib/ride/launch.ts';
import { getWorkoutStartChoices, getWorkoutStartOptions, type WorkoutStartRuntime } from '../lib/workout-start.ts';

const bike = { sport: 'BIKING', status: 'planned', hasSteps: true };
const follow = ['live', 'Block timer'];
const openApp = ['app', 'Open in TempoBuilder Ride'];
const rideInBrowser = ['ride', 'Ride in this browser'];
const targetsOnly = ['ride', 'Ride without devices'];
const rideInApp = ['ride', 'Ride in TempoBuilder Ride'];

function choices(workout: typeof bike, runtime: WorkoutStartRuntime) {
  return getWorkoutStartOptions(workout, runtime).map(({ mode, label }) => [mode, label]);
}

test('bike choices put the best way to ride on this device first', () => {
  for (const os of ['windows', 'macos', 'linux'] as const) {
    assert.deepEqual(choices(bike, { os, webBluetooth: true, inTempoBuilderRide: false }), [rideInBrowser, openApp, follow]);
    assert.deepEqual(choices(bike, { os, webBluetooth: false, inTempoBuilderRide: false }), [openApp, follow, targetsOnly]);
  }
  assert.deepEqual(choices(bike, { os: 'other', webBluetooth: true, inTempoBuilderRide: false }), [rideInBrowser, follow]);
  assert.deepEqual(choices(bike, { os: 'other', webBluetooth: false, inTempoBuilderRide: false }), [follow, targetsOnly]);
  for (const webBluetooth of [true, false]) {
    const options = getWorkoutStartOptions(bike, { os: 'linux', webBluetooth, inTempoBuilderRide: true });
    assert.deepEqual(options.map(({ mode, label }) => [mode, label]), [rideInApp, follow]);
    assert.match(options[0].detail, webBluetooth ? /over Bluetooth/ : /ride time is saved/);
  }
});

test('a bike workout recommends its first option and says why; a single option is not a recommendation', () => {
  const bluetooth = getWorkoutStartChoices(bike, { os: 'macos', webBluetooth: true, inTempoBuilderRide: false });
  assert.equal(bluetooth.recommended?.label, 'Ride in this browser');
  assert.match(bluetooth.recommended?.reason ?? '', /Bluetooth/);
  assert.deepEqual(bluetooth.others.map(({ label }) => label), ['Open in TempoBuilder Ride', 'Block timer']);

  const noBluetooth = getWorkoutStartChoices(bike, { os: 'windows', webBluetooth: false, inTempoBuilderRide: false });
  assert.equal(noBluetooth.recommended?.label, 'Open in TempoBuilder Ride');
  assert.equal(noBluetooth.recommended?.reason, 'This browser can’t use Bluetooth');

  const run = getWorkoutStartChoices({ ...bike, sport: 'RUNNING' }, { os: 'other', webBluetooth: false, inTempoBuilderRide: false });
  assert.equal(run.recommended, null);
  assert.deepEqual(run.others.map(({ label }) => label), ['Block timer']);

  for (const option of getWorkoutStartOptions(bike, { os: 'linux', webBluetooth: true, inTempoBuilderRide: false })) {
    assert.ok(option.hint.split(' ').length <= 6, `${option.label} hint stays short`);
  }
});

test('open runs, strength and stretching use the block timer; swims, terminal, rest and stepless workouts have no start', () => {
  const runtime: WorkoutStartRuntime = { os: 'macos', webBluetooth: true, inTempoBuilderRide: false };
  for (const sport of ['RUNNING', 'STRENGTH', 'STRETCHING']) {
    assert.deepEqual(choices({ ...bike, sport }, runtime), [follow]);
  }
  for (const workout of [
    { ...bike, status: 'completed' },
    { ...bike, status: 'skipped' },
    { ...bike, sport: 'SWIMMING' },
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
