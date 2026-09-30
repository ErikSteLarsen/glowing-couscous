import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyPerformanceProfile, validatePerformanceProfile } from '../lib/performance-profile.ts';
import { parseTrainingSports, parseTrainingTime, trainingSetupComplete } from '../lib/training-setup.ts';

test('setup requires real running zones, HRmax and only the selected sports', () => {
  const profile = createEmptyPerformanceProfile();
  assert.equal(trainingSetupComplete(profile, ['running']), false);
  profile.heartRateMaxBpm = 190;
  profile.running.thresholdPaceSecPerKm = 300;
  assert.equal(trainingSetupComplete(profile, ['running']), false);
  profile.running.raceDistanceMeters = 10000;
  profile.running.raceTimeSec = 2700;
  assert.equal(trainingSetupComplete(profile, ['running']), true);
  assert.equal(trainingSetupComplete(profile, ['running', 'cycling']), false);
  profile.cycling.ftpWatts = 250;
  profile.swimming.cssSecPer100m = 105;
  assert.equal(trainingSetupComplete(profile, ['running', 'cycling', 'swimming']), true);
  assert.equal(trainingSetupComplete(profile, []), false);
});

test('manual running zones count only when all five are present', () => {
  const profile = createEmptyPerformanceProfile();
  profile.heartRateMaxBpm = 190;
  for (const zone of [1, 2, 3, 4, 5] as const) profile.running.paceZoneOverrides[zone] = { fastestSecPerKm: 600 - zone * 60, slowestSecPerKm: 660 - zone * 60 };
  assert.equal(trainingSetupComplete(profile, ['running']), true);
  profile.running.paceZoneOverrides[3].fastestSecPerKm = null;
  assert.equal(trainingSetupComplete(profile, ['running']), false);
});

test('sport selection and time input reject incomplete or malformed values', () => {
  assert.equal(parseTrainingSports([]), null);
  assert.equal(parseTrainingSports(['strength']), null);
  assert.deepEqual(parseTrainingSports(['swimming', 'running', 'running']), ['running', 'swimming']);
  assert.equal(parseTrainingTime('1:45'), 105);
  assert.equal(parseTrainingTime('1:45:00'), 6300);
  for (const value of ['', '45', '1:60', '1:61:00', '-1:00', '0:00']) assert.equal(parseTrainingTime(value), null);
});

test('profile saves refuse malformed sport targets and reversed manual pace bounds', () => {
  const profile = createEmptyPerformanceProfile();
  profile.cycling.ftpWatts = -10;
  assert.match(validatePerformanceProfile(profile)!, /Cycling FTP/);
  profile.cycling.ftpWatts = 250;
  profile.swimming.cssSecPer100m = 0;
  assert.match(validatePerformanceProfile(profile)!, /Swimming threshold pace/);
  profile.swimming.cssSecPer100m = 105;
  profile.running.paceZoneOverrides[1] = { fastestSecPerKm: 400, slowestSecPerKm: 300 };
  assert.match(validatePerformanceProfile(profile)!, /faster pace first/);
});
