import test from 'node:test';
import assert from 'node:assert/strict';

import { acceleration, cadenceFromSpeed, courseProfile, createCourse, createRiderState, elevationAt, gradientAt, lakesideLoop, lapDistance, step } from '../lib/ride/virtual-course.ts';

const kmh = (mps: number) => mps * 3.6;

/** A straight course at a constant gradient, long enough not to wrap during a test. */
function constantCourse(gradient: number) {
  return createCourse('Test', [[0, 0], [50_000, 50_000 * gradient], [100_000, 0]]);
}

function ride(gradient: number, watts: number, seconds: number, start = createRiderState()) {
  const course = constantCourse(gradient);
  const state = { ...start, distanceM: 1_000 };
  for (let t = 0; t < seconds; t++) step(state, watts, 1, course);
  return state;
}

test('Lakeside Loop is a 10–14 km loop with rollers, a real climb and a descent', () => {
  const { lengthM } = lakesideLoop;
  assert.ok(lengthM >= 10_000 && lengthM <= 14_000);
  let steepest = 0;
  let longestClimb = 0;
  let climb = 0;
  let steepestDescent = 0;
  for (let d = 0; d < lengthM; d += 10) {
    const g = gradientAt(d);
    steepest = Math.max(steepest, g);
    steepestDescent = Math.min(steepestDescent, g);
    climb = g >= 0.04 ? climb + 10 : 0;
    longestClimb = Math.max(longestClimb, climb);
  }
  assert.ok(steepest >= 0.04 && steepest <= 0.075, `steepest ${steepest}`);
  assert.ok(longestClimb >= 1_000 && longestClimb <= 2_000, `climb ${longestClimb} m`);
  assert.ok(steepestDescent <= -0.035, `descent ${steepestDescent}`);
  assert.ok(Math.abs(gradientAt(2_000)) < 0.04, 'rollers stay gentle');
});

test('elevation and gradient wrap around the loop and stay continuous', () => {
  const { lengthM } = lakesideLoop;
  assert.equal(lapDistance(lengthM + 250), 250);
  assert.equal(lapDistance(-250), lengthM - 250);
  assert.ok(Math.abs(elevationAt(lengthM + 1_234) - elevationAt(1_234)) < 1e-6);
  assert.ok(Math.abs(gradientAt(3 * lengthM + 5_200) - gradientAt(5_200)) < 1e-6);
  assert.ok(Math.abs(elevationAt(lengthM - 1) - elevationAt(0)) < 0.2, 'no step at the start line');
  for (let d = 0; d < lengthM; d += 5) assert.ok(Math.abs(gradientAt(d + 5) - gradientAt(d)) < 0.01, `gradient jumps at ${d} m`);
});

test('profile covers one lap with the requested number of points', () => {
  const profile = courseProfile(60);
  assert.equal(profile.length, 60);
  assert.equal(profile[0].distanceM, 0);
  assert.equal(profile[59].distanceM, lakesideLoop.lengthM);
  assert.ok(profile.some((point) => point.elevationM > lakesideLoop.minElevationM + 60));
});

test('200 W holds a realistic speed on the flat and on a 6 % climb', () => {
  const flat = kmh(ride(0, 200, 180).speedMps);
  assert.ok(flat >= 32 && flat <= 36, `flat ${flat} km/h`);
  const climb = kmh(ride(0.06, 200, 180).speedMps);
  assert.ok(climb >= 11 && climb <= 14, `6 % climb ${climb} km/h`);
});

test('starting from rest accelerates, and more power is faster', () => {
  const afterTwo = ride(0, 200, 2);
  assert.ok(afterTwo.speedMps > 2 && afterTwo.distanceM > 1_000);
  assert.ok(ride(0, 300, 180).speedMps > ride(0, 150, 180).speedMps);
});

test('without power the rider slows gradually on the flat and stops on a climb without rolling back', () => {
  const cruising = { distanceM: 0, speedMps: 9.4 };
  const afterFive = ride(0, 0, 5, cruising).speedMps;
  assert.ok(afterFive > 7 && afterFive < 9.3, `after 5 s ${kmh(afterFive)} km/h`);
  const climbing = ride(0.06, 0, 30, cruising);
  assert.equal(climbing.speedMps, 0);
  const stoppedAt = climbing.distanceM;
  step(climbing, 0, 5, constantCourse(0.06));
  assert.equal(climbing.distanceM, stoppedAt);
});

test('coasting downhill speeds up toward a sane terminal speed', () => {
  const after10 = kmh(ride(-0.05, 0, 10, { distanceM: 0, speedMps: 8 }).speedMps);
  const after120 = kmh(ride(-0.05, 0, 120, { distanceM: 0, speedMps: 8 }).speedMps);
  assert.ok(after10 > 30 && after120 > after10);
  assert.ok(after120 > 45 && after120 < 65, `terminal ${after120} km/h`);
  assert.ok(Math.abs(acceleration(after120 / 3.6, 0, -0.05)) < 0.05);
});

test('stepping is frame-rate independent and long gaps are cut short', () => {
  const course = constantCourse(0.03);
  const coarse = createRiderState(100, 5);
  const fine = createRiderState(100, 5);
  for (let i = 0; i < 20; i++) step(coarse, 250, 0.25, course);
  for (let i = 0; i < 300; i++) step(fine, 250, 1 / 60, course);
  assert.ok(Math.abs(coarse.speedMps - fine.speedMps) < 0.02);
  assert.ok(Math.abs(coarse.distanceM - fine.distanceM) < 0.2);

  const hidden = createRiderState(100, 9);
  step(hidden, 200, 3_600, constantCourse(0));
  assert.ok(hidden.distanceM < 100 + 9 * 6, 'an hour-long gap simulates only a few seconds');
  step(hidden, 200, Number.NaN, constantCourse(0));
  assert.ok(Number.isFinite(hidden.distanceM));
});

test('derived cadence pedals only while moving under power', () => {
  assert.equal(cadenceFromSpeed(0, 200), 0);
  assert.equal(cadenceFromSpeed(9, 0), 0);
  const cadence = cadenceFromSpeed(9, 200);
  assert.ok(cadence >= 70 && cadence <= 100);
});
