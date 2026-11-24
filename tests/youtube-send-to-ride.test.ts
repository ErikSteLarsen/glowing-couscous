import test from 'node:test';
import assert from 'node:assert/strict';
import {
  listenForSentVideos,
  parseSentStart,
  readPlayMessage,
  sendToTempoBookmarklet,
  sendVideoToRide,
} from '../lib/youtube/send-to-ride.ts';

const ID = 'aqz-KE-bpKQ';

/** Runs the bookmark's code against a fake page and reports what it did. */
function runBookmarklet(href: string, page: { url: string; currentTime?: number; noVideo?: boolean }) {
  assert.match(href, /^javascript:/);
  const code = decodeURIComponent(href.slice('javascript:'.length));
  const url = new URL(page.url);
  const calls = { opened: [] as unknown[][], alerts: [] as string[], paused: 0 };
  const video = { currentTime: page.currentTime ?? 0, pause() { calls.paused += 1; } };
  const fakeWindow = {
    location: { href: url.href, hostname: url.hostname },
    alert: (message: string) => calls.alerts.push(message),
    open: (...args: unknown[]) => calls.opened.push(args),
  };
  const fakeDocument = { querySelector: (selector: string) => (page.noVideo || selector !== '#movie_player video' ? null : video) };
  new Function('window', 'document', code)(fakeWindow, fakeDocument);
  return calls;
}

test('the bookmark pauses the video and opens the send window with the link and position', () => {
  const href = sendToTempoBookmarklet('http://localhost:3301/');
  const calls = runBookmarklet(href, { url: `https://www.youtube.com/watch?v=${ID}&list=PL123`, currentTime: 83.7 });
  assert.equal(calls.paused, 1);
  assert.deepEqual(calls.alerts, []);
  assert.deepEqual(calls.opened, [[
    `http://localhost:3301/athlete/ride/send?u=${encodeURIComponent(`https://www.youtube.com/watch?v=${ID}&list=PL123`)}&t=83`,
    'tempo-send',
    'popup,width=420,height=260',
  ]]);
});

test('the bookmark works on shorts, live and youtu.be pages, and without a video element', () => {
  const href = sendToTempoBookmarklet('https://tempo.example');
  for (const url of [`https://www.youtube.com/shorts/${ID}`, `https://m.youtube.com/live/${ID}?si=x`, `https://youtu.be/${ID}`]) {
    const calls = runBookmarklet(href, { url, noVideo: true });
    assert.equal(calls.opened.length, 1, url);
    assert.match(String(calls.opened[0][0]), /^https:\/\/tempo\.example\/athlete\/ride\/send\?u=.+&t=0$/);
  }
});

test('outside a YouTube video the bookmark only asks for one', () => {
  const href = sendToTempoBookmarklet('https://tempo.example');
  for (const url of ['https://www.youtube.com/', 'https://www.youtube.com/results?search_query=bikes', 'https://example.com/watch?v=aqz-KE-bpKQ']) {
    const calls = runBookmarklet(href, { url, currentTime: 10 });
    assert.deepEqual(calls.alerts, ['Open a YouTube video first'], url);
    assert.equal(calls.opened.length, 0);
    assert.equal(calls.paused, 0);
  }
});

test('sent start times and play messages are validated', () => {
  assert.equal(parseSentStart('90'), 90);
  assert.equal(parseSentStart('0'), undefined);
  assert.equal(parseSentStart('-3'), undefined);
  assert.equal(parseSentStart('1e3'), undefined);
  assert.equal(parseSentStart(null), undefined);
  assert.deepEqual(readPlayMessage({ type: 'play', id: 'x', videoId: ID, startSec: 12.9 }), { type: 'play', id: 'x', videoId: ID, startSec: 12 });
  assert.deepEqual(readPlayMessage({ type: 'play', id: 'x', videoId: ID }), { type: 'play', id: 'x', videoId: ID, startSec: 0 });
  assert.equal(readPlayMessage({ type: 'play', id: 'x', videoId: 'nope' }), null);
  assert.equal(readPlayMessage({ type: 'ack', id: 'x' }), null);
  assert.equal(readPlayMessage('play'), null);
});

test('a ride tab acks a sent video and plays it once', async () => {
  const played: unknown[] = [];
  const stop = listenForSentVideos((video) => played.push(video));
  try {
    assert.equal(await sendVideoToRide({ id: 'one', videoId: ID, startSec: 42 }), true);
    assert.equal(await sendVideoToRide({ id: 'one', videoId: ID, startSec: 42 }), true, 'a repeat is acked');
    assert.deepEqual(played, [{ videoId: ID, startSec: 42 }], 'but played once');
  } finally {
    stop();
  }
});

test('without a ride tab the send times out', async () => {
  assert.equal(await sendVideoToRide({ id: 'two', videoId: ID, startSec: 0 }, 50), false);
});
