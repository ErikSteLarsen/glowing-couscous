import test from 'node:test';
import assert from 'node:assert/strict';
import { findYouTubeLink, parseYouTubeLink, parseYouTubeTimestamp, youTubeWatchUrl } from '../lib/youtube/youtube-url.ts';

const ID = 'dQw4w9WgXcQ';

test('reads the video ID from every common YouTube link shape', () => {
  for (const link of [
    `https://www.youtube.com/watch?v=${ID}`,
    `http://youtube.com/watch?feature=share&v=${ID}`,
    `www.youtube.com/watch?v=${ID}`,
    `youtube.com/watch?v=${ID}`,
    `https://m.youtube.com/watch?v=${ID}&app=desktop`,
    `https://music.youtube.com/watch?v=${ID}&si=abc`,
    `https://youtu.be/${ID}`,
    `https://youtu.be/${ID}?si=Xyz123`,
    `https://www.youtube.com/shorts/${ID}`,
    `https://youtube.com/shorts/${ID}?feature=share`,
    `https://www.youtube.com/live/${ID}?si=abc`,
    `https://www.youtube.com/embed/${ID}`,
    `https://www.youtube-nocookie.com/embed/${ID}?rel=0`,
    `  https://www.youtube.com/watch?v=${ID}  `,
    `HTTPS://WWW.YOUTUBE.COM/watch?v=${ID}`,
  ]) {
    assert.deepEqual(parseYouTubeLink(link), { videoId: ID }, link);
  }
});

test('reads start times and playlists', () => {
  assert.deepEqual(parseYouTubeLink(`https://youtu.be/${ID}?t=90`), { videoId: ID, startSec: 90 });
  assert.deepEqual(parseYouTubeLink(`https://www.youtube.com/watch?v=${ID}&t=1m30s`), { videoId: ID, startSec: 90 });
  assert.deepEqual(parseYouTubeLink(`https://www.youtube.com/watch?v=${ID}&t=1h2m3s`), { videoId: ID, startSec: 3723 });
  assert.deepEqual(parseYouTubeLink(`https://www.youtube.com/embed/${ID}?start=42`), { videoId: ID, startSec: 42 });
  assert.deepEqual(parseYouTubeLink(`https://www.youtube.com/watch?v=${ID}#t=2m`), { videoId: ID, startSec: 120 });
  assert.deepEqual(
    parseYouTubeLink(`https://www.youtube.com/watch?v=${ID}&list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG&index=3`),
    { videoId: ID, playlistId: 'PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG' },
  );
  assert.deepEqual(parseYouTubeLink(`https://www.youtube.com/watch?v=${ID}&t=0`), { videoId: ID });
});

test('rejects links that are not a playable YouTube video, and bare words (an 11-character search is a search)', () => {
  for (const link of [
    '',
    '   ',
    'cycling music',
    'documentary',
    ID,
    'dQw4w9WgXc',
    'dQw4w9WgXcQQ',
    'https://www.youtube.com/',
    'https://www.youtube.com/playlist?list=PLx0sYbCqOb8TBPRdmBHs5Iftvv9TPboYG',
    'https://www.youtube.com/@GCN',
    'https://www.youtube.com/watch?v=short',
    `https://vimeo.com/watch?v=${ID}`,
    `https://youtube.com.evil.example/watch?v=${ID}`,
    `https://evil.example/youtu.be/${ID}`,
    `javascript:alert(1)//youtu.be/${ID}`,
    `ftp://youtu.be/${ID}`,
    `https://user:pass@youtu.be/${ID}`,
  ]) {
    assert.equal(parseYouTubeLink(link), null, link);
  }
});

test('parses timestamps and ignores nonsense', () => {
  assert.equal(parseYouTubeTimestamp('75'), 75);
  assert.equal(parseYouTubeTimestamp('75s'), 75);
  assert.equal(parseYouTubeTimestamp('2m'), 120);
  assert.equal(parseYouTubeTimestamp('1:02:03'), 3723);
  assert.equal(parseYouTubeTimestamp('01:30'), 90);
  for (const value of [undefined, null, '', '0', 'abc', '1x', '-5', '99999999']) {
    assert.equal(parseYouTubeTimestamp(value), undefined, String(value));
  }
});

test('builds watch links for Open on YouTube', () => {
  assert.equal(youTubeWatchUrl(ID), `https://www.youtube.com/watch?v=${ID}`);
  assert.equal(youTubeWatchUrl(ID, 90), `https://www.youtube.com/watch?v=${ID}&t=90s`);
});

test('finds a link in dropped or pasted text', () => {
  assert.deepEqual(findYouTubeLink(`# dragged from YouTube\r\nhttps://www.youtube.com/watch?v=${ID}&t=42s\r\n`), { videoId: ID, startSec: 42 });
  assert.deepEqual(findYouTubeLink(`Watch this: https://youtu.be/${ID} so good`), { videoId: ID });
  assert.deepEqual(findYouTubeLink(`https://example.com/a https://www.youtube.com/shorts/${ID}`), { videoId: ID });
  assert.deepEqual(findYouTubeLink(`https://i.ytimg.com/vi/${ID}/hqdefault.jpg?sqp=abc`), { videoId: ID });
  assert.equal(findYouTubeLink('https://www.youtube.com/'), null);
  assert.equal(findYouTubeLink('documentary'), null);
  assert.equal(findYouTubeLink(''), null);
  assert.equal(findYouTubeLink(null), null);
});
