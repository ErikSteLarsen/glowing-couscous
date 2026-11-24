import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearRecentVideos,
  readRecentVideos,
  RECENT_MAX_AGE_MS,
  recentVideosKey,
  rememberRecentVideo,
} from '../components/ride/entertainment/youtube/recent-videos.ts';

const store = new Map<string, string>();
Object.assign(globalThis, {
  window: {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
    },
  },
});

const video = (id: string) => ({ id, title: `Video ${id}`, channelTitle: 'Channel' });
const DAY = 24 * 60 * 60 * 1000;

test('recently watched videos are kept per account and the old shared list is dropped', () => {
  store.clear();
  store.set('tempo-ride-youtube-recent', JSON.stringify([video('aaaaaaaaaaa')]));
  const now = Date.UTC(2026, 10, 24);
  rememberRecentVideo(1, video('aaaaaaaaaaa'), now);
  rememberRecentVideo(2, video('bbbbbbbbbbb'), now);
  assert.deepEqual(readRecentVideos(1, now).map((entry) => entry.id), ['aaaaaaaaaaa']);
  assert.deepEqual(readRecentVideos(2, now).map((entry) => entry.id), ['bbbbbbbbbbb']);
  assert.equal(store.has('tempo-ride-youtube-recent'), false);
  assert.ok(store.has(recentVideosKey(1)));
  assert.equal('watchedAt' in readRecentVideos(1, now)[0], false, 'the timestamp stays in storage');
});

test('entries older than 30 days expire on read; Clear empties the list', () => {
  store.clear();
  const start = Date.UTC(2026, 9, 1);
  rememberRecentVideo(1, video('aaaaaaaaaaa'), start);
  rememberRecentVideo(1, { ...video('bbbbbbbbbbb'), startSec: 90 }, start + 10 * DAY);
  assert.deepEqual(readRecentVideos(1, start + 10 * DAY).map((entry) => entry.id), ['bbbbbbbbbbb', 'aaaaaaaaaaa']);
  assert.equal(readRecentVideos(1, start + 10 * DAY)[0].startSec, undefined, 'a start time is not remembered');
  assert.deepEqual(readRecentVideos(1, start + RECENT_MAX_AGE_MS + DAY).map((entry) => entry.id), ['bbbbbbbbbbb']);
  assert.deepEqual(readRecentVideos(1, start + 41 * DAY), []);

  rememberRecentVideo(1, video('ccccccccccc'), start + 11 * DAY);
  clearRecentVideos(1);
  assert.deepEqual(readRecentVideos(1, start + 11 * DAY), []);
});

test('entries without a watch time or with a bad ID are ignored', () => {
  store.clear();
  store.set(recentVideosKey(1), JSON.stringify([video('aaaaaaaaaaa'), { ...video('nope'), watchedAt: Date.now() }, 'junk']));
  assert.deepEqual(readRecentVideos(1), []);
});
