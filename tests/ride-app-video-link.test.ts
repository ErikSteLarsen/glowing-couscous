import assert from 'node:assert/strict';
import test from 'node:test';
import { rideAppVideoLink } from '../lib/youtube/send-to-ride.ts';

test('links a video to the Tempo Ride app', () => {
  assert.equal(rideAppVideoLink('M7lc1UVf-VE', 90), 'tempo-ride://video?v=M7lc1UVf-VE&t=90');
  assert.equal(rideAppVideoLink('M7lc1UVf-VE', 0), 'tempo-ride://video?v=M7lc1UVf-VE');
});
