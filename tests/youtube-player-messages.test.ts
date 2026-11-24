import assert from 'node:assert/strict';
import test from 'node:test';
import { readPlayerMessage } from '../components/ride/entertainment/youtube/iframe-api.ts';
import { rideAppVideoLink } from '../lib/youtube/send-to-ride.ts';

test('reads player messages and ignores anything malformed', () => {
  const read = (value: unknown) => readPlayerMessage(JSON.stringify(value));
  assert.deepEqual(read({ event: 'onReady' }), { ready: true });
  assert.deepEqual(read({ event: 'onError', info: 150 }), { error: 150 });
  assert.deepEqual(read({ event: 'onStateChange', info: 1 }), { state: 1 });
  assert.deepEqual(read({ event: 'infoDelivery', info: { playerState: 2, currentTime: 12.5, title: 'x' } }), { state: 2, time: 12.5 });
  assert.deepEqual(read({ event: 'initialDelivery', info: { currentTime: 'soon' } }), {});
  for (const value of [null, 'text', { event: 'onError' }, { event: 'infoDelivery', info: null }, { event: 'apiInfoDelivery', info: {} }]) {
    assert.equal(read(value), null);
  }
  assert.equal(readPlayerMessage('{'), null);
  assert.equal(readPlayerMessage({ event: 'onReady' }), null);
});

test('links a video to the Tempo Ride app', () => {
  assert.equal(rideAppVideoLink('M7lc1UVf-VE', 90), 'tempo-ride://video?v=M7lc1UVf-VE&t=90');
  assert.equal(rideAppVideoLink('M7lc1UVf-VE', 0), 'tempo-ride://video?v=M7lc1UVf-VE');
});
