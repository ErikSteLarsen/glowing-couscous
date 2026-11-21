import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyPerformanceProfile, validatePerformanceProfile } from '../lib/performance-profile.ts';
import { getTrainingSetupTarget, parseTrainingSports } from '../lib/training-setup.ts';

test('setup links to the next missing target within the selected sports', () => {
  const profile = createEmptyPerformanceProfile();
  assert.equal(getTrainingSetupTarget(profile, ['running']), 'heart-rate');
  profile.heartRateMaxBpm = 190;
  profile.running.thresholdPaceSecPerKm = 300;
  assert.equal(getTrainingSetupTarget(profile, ['running']), 'running');
  profile.running.raceDistanceMeters = 10000;
  profile.running.raceTimeSec = 2700;
  assert.equal(getTrainingSetupTarget(profile, ['running']), null);
  assert.equal(getTrainingSetupTarget(profile, ['running', 'cycling']), 'cycling');
  profile.cycling.ftpWatts = 250;
  profile.swimming.cssSecPer100m = 105;
  assert.equal(getTrainingSetupTarget(profile, null), null);
});

test('setup prioritizes the sport of today’s workout when its targets are missing', () => {
  const profile = createEmptyPerformanceProfile();
  assert.equal(getTrainingSetupTarget(profile, null, 'BIKING'), 'cycling');
  assert.equal(getTrainingSetupTarget(profile, ['running'], 'BIKING'), 'heart-rate');
  profile.cycling.ftpWatts = 250;
  assert.equal(getTrainingSetupTarget(profile, null, 'BIKING'), 'heart-rate');
});

test('manual running zones count only when all five are present', () => {
  const profile = createEmptyPerformanceProfile();
  profile.heartRateMaxBpm = 190;
  for (const zone of [1, 2, 3, 4, 5] as const) profile.running.paceZoneOverrides[zone] = { fastestSecPerKm: 600 - zone * 60, slowestSecPerKm: 660 - zone * 60 };
  assert.equal(getTrainingSetupTarget(profile, ['running']), null);
  profile.running.paceZoneOverrides[3].fastestSecPerKm = null;
  assert.equal(getTrainingSetupTarget(profile, ['running']), 'running');
});

test('sport selection rejects incomplete or malformed values', () => {
  assert.equal(parseTrainingSports([]), null);
  assert.equal(parseTrainingSports(['strength']), null);
  assert.deepEqual(parseTrainingSports(['swimming', 'running', 'running']), ['running', 'swimming']);
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
