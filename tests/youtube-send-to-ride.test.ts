import test from 'node:test';
import assert from 'node:assert/strict';
import {
  sendKeyFromHash,
  listenForSentVideos,
  parseSentStart,
  readAckMessage,
  readAvailableMessage,
  readOfferMessage,
  readPlayMessage,
  sendToWattonautBookmarklet,
  sendVideoToRide,
} from '../lib/youtube/send-to-ride.ts';

const ID = 'aqz-KE-bpKQ';
const KEY = '0f8e0f4c-7c1e-4d5e-9b0a-2f6c7d8e9f01';

type FakeVideo = { currentTime: number; duration?: number; paused?: boolean; rect?: [number, number, number, number] };

/** Runs the bookmark's code against a fake page and reports what it did. */
function runBookmarklet(href: string, page: { url: string; videos?: FakeVideo[]; live?: boolean; blocked?: boolean }) {
  assert.match(href, /^javascript:/);
  const code = decodeURIComponent(href.slice('javascript:'.length));
  const url = new URL(page.url);
  const calls = { opened: [] as unknown[][], alerts: [] as string[], paused: [] as number[] };
  const videos = (page.videos ?? []).map((video, index) => {
    const [left, top, width, height] = video.rect ?? [0, 0, 640, 360];
    return {
      currentTime: video.currentTime,
      duration: video.duration ?? 600,
      paused: video.paused ?? true,
      getBoundingClientRect: () => ({ left, top, right: left + width, bottom: top + height }),
      pause() { calls.paused.push(index); },
    };
  });
  const fakeWindow = {
    location: { href: url.href, hostname: url.hostname },
    innerWidth: 1280,
    innerHeight: 800,
    alert: (message: string) => calls.alerts.push(message),
    open: (...args: unknown[]) => {
      calls.opened.push(args);
      return page.blocked ? null : {};
    },
  };
  const fakeDocument = {
    querySelectorAll: () => videos,
    querySelector: (selector: string) => (selector === '.ytp-live' && page.live ? {} : null),
  };
  new Function('window', 'document', code)(fakeWindow, fakeDocument);
  return calls;
}

const sendUrl = (origin: string, link: string, t?: number) =>
  `${origin}/athlete/ride/send?u=${encodeURIComponent(link)}${t === undefined ? '' : `&t=${t}`}#k=${KEY}`;

test('the bookmark opens the send window with the link, position and key, then pauses the video', () => {
  const href = sendToWattonautBookmarklet('http://localhost:3301/', KEY);
  const link = `https://www.youtube.com/watch?v=${ID}&list=PL123`;
  const calls = runBookmarklet(href, { url: link, videos: [{ currentTime: 83.7 }] });
  assert.deepEqual(calls.alerts, []);
  assert.deepEqual(calls.opened, [[sendUrl('http://localhost:3301', link, 83), 'wattonaut-send', 'popup,width=420,height=260']]);
  assert.deepEqual(calls.paused, [0]);
});

test('the bookmark sends an explicit 0 so an old t= in the page URL does not win', () => {
  const href = sendToWattonautBookmarklet('https://wattonaut.example', KEY);
  const link = `https://www.youtube.com/watch?v=${ID}&t=300s`;
  const calls = runBookmarklet(href, { url: link, videos: [{ currentTime: 0.4 }] });
  assert.equal(calls.opened[0][0], sendUrl('https://wattonaut.example', link, 0));
});

test('the bookmark reads the playing video, else the largest visible one', () => {
  const href = sendToWattonautBookmarklet('https://wattonaut.example', KEY);
  const link = `https://www.youtube.com/shorts/${ID}`;
  const playing = runBookmarklet(href, {
    url: link,
    videos: [{ currentTime: 10, rect: [0, 0, 1280, 720] }, { currentTime: 42, paused: false, rect: [0, 0, 200, 300] }],
  });
  assert.equal(playing.opened[0][0], sendUrl('https://wattonaut.example', link, 42));
  assert.deepEqual(playing.paused, [1]);
  const largest = runBookmarklet(href, {
    url: link,
    videos: [{ currentTime: 5, rect: [0, 0, 100, 100] }, { currentTime: 7, rect: [0, 0, 400, 700] }, { currentTime: 9, rect: [2000, 0, 900, 900] }],
  });
  assert.equal(largest.opened[0][0], sendUrl('https://wattonaut.example', link, 7));
});

test('the bookmark sends no position for a live stream or without a video element', () => {
  const href = sendToWattonautBookmarklet('https://wattonaut.example', KEY);
  const live = `https://www.youtube.com/live/${ID}?si=x`;
  assert.equal(runBookmarklet(href, { url: live, videos: [{ currentTime: 3600 }], live: true }).opened[0][0], sendUrl('https://wattonaut.example', live));
  assert.equal(runBookmarklet(href, { url: live, videos: [{ currentTime: 3600, duration: Infinity }] }).opened[0][0], sendUrl('https://wattonaut.example', live));
  const short = `https://youtu.be/${ID}`;
  const calls = runBookmarklet(href, { url: short });
  assert.equal(calls.opened[0][0], sendUrl('https://wattonaut.example', short));
  assert.deepEqual(calls.paused, []);
});

test('a blocked pop-up asks to allow pop-ups and leaves the video playing', () => {
  const href = sendToWattonautBookmarklet('https://wattonaut.example', KEY);
  const calls = runBookmarklet(href, { url: `https://www.youtube.com/watch?v=${ID}`, videos: [{ currentTime: 12, paused: false }], blocked: true });
  assert.equal(calls.opened.length, 1);
  assert.deepEqual(calls.alerts, ['Allow pop-ups for YouTube to send videos to Wattonaut.']);
  assert.deepEqual(calls.paused, []);
});

test('outside a YouTube video the bookmark only asks for one', () => {
  const href = sendToWattonautBookmarklet('https://wattonaut.example', KEY);
  for (const url of ['https://www.youtube.com/', 'https://www.youtube.com/results?search_query=bikes', 'https://example.com/watch?v=aqz-KE-bpKQ']) {
    const calls = runBookmarklet(href, { url, videos: [{ currentTime: 10 }] });
    assert.deepEqual(calls.alerts, ['Open a YouTube video first'], url);
    assert.equal(calls.opened.length, 0);
    assert.deepEqual(calls.paused, []);
  }
});

test('sent start times and messages are validated', () => {
  assert.equal(parseSentStart('90'), 90);
  assert.equal(parseSentStart('0'), 0);
  assert.equal(parseSentStart('-3'), undefined);
  assert.equal(parseSentStart('1e3'), undefined);
  assert.equal(parseSentStart('999999'), undefined);
  assert.equal(parseSentStart(null), undefined);
  assert.deepEqual(readOfferMessage({ type: 'offer', id: 'x' }), { type: 'offer', id: 'x' });
  assert.equal(readOfferMessage({ type: 'offer', id: '' }), null);
  assert.deepEqual(readAvailableMessage({ type: 'available', id: 'x', tabId: 't1' }), { type: 'available', id: 'x', tabId: 't1' });
  assert.equal(readAvailableMessage({ type: 'available', id: 'x' }), null);
  assert.deepEqual(readAckMessage({ type: 'ack', id: 'x', tabId: 't1' }), { type: 'ack', id: 'x', tabId: 't1' });
  assert.equal(readAckMessage({ type: 'ack', id: 'x', tabId: 'a b' }), null);
  assert.deepEqual(readPlayMessage({ type: 'play', id: 'x', tabId: 't1', videoId: ID, startSec: 12.9 }), { type: 'play', id: 'x', tabId: 't1', videoId: ID, startSec: 12 });
  assert.deepEqual(readPlayMessage({ type: 'play', id: 'x', tabId: 't1', videoId: ID }), { type: 'play', id: 'x', tabId: 't1', videoId: ID, startSec: 0 });
  assert.equal(readPlayMessage({ type: 'play', id: 'x', videoId: ID }), null, 'a play must be addressed to a tab');
  assert.equal(readPlayMessage({ type: 'play', id: 'x', tabId: 't1', videoId: 'nope' }), null);
  assert.equal(readPlayMessage({ type: 'ack', id: 'x', tabId: 't1' }), null);
  assert.equal(readPlayMessage('play'), null);
});

test('a ride tab answers the offer, plays the video addressed to it once and acks', async () => {
  const played: unknown[] = [];
  const stop = listenForSentVideos((video) => played.push(video), 'tab-a');
  try {
    assert.equal(await sendVideoToRide({ id: 'one', videoId: ID, startSec: 42 }), true);
    assert.equal(await sendVideoToRide({ id: 'one', videoId: ID, startSec: 42 }), true, 'a repeat is acked');
    assert.deepEqual(played, [{ videoId: ID, startSec: 42 }], 'but played once');
  } finally {
    stop();
  }
});

test('with two ride tabs open only one plays the video', async () => {
  const played: string[] = [];
  const stopA = listenForSentVideos(() => played.push('a'), 'tab-a');
  const stopB = listenForSentVideos(() => played.push('b'), 'tab-b');
  try {
    assert.equal(await sendVideoToRide({ id: 'two', videoId: ID, startSec: 0 }), true);
    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(played.length, 1, played.join());
  } finally {
    stopA();
    stopB();
  }
});

test('without a ride tab the send times out', async () => {
  assert.equal(await sendVideoToRide({ id: 'three', videoId: ID, startSec: 0 }, 50), false);
});

test('the send key is read only from a valid URL fragment', () => {
  assert.equal(sendKeyFromHash(`#k=${KEY}`), KEY);
  assert.equal(sendKeyFromHash(''), null);
  assert.equal(sendKeyFromHash('#k=no'), null);
  assert.equal(sendKeyFromHash('#other=1'), null);
});
