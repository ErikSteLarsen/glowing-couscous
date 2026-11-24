const assert = require('node:assert/strict')
const test = require('node:test')
const { isYouTubeWindowUrl, parseYouTubeVideo, youTubeNavigation } = require('../urls.cjs')

test('the YouTube window may show YouTube and the Google sign-in pages', () => {
  for (const value of [
    'https://www.youtube.com/',
    'https://youtube.com/feed/subscriptions',
    'https://m.youtube.com/watch?v=M7lc1UVf-VE',
    'https://music.youtube.com/',
    'https://youtu.be/M7lc1UVf-VE',
    'https://accounts.google.com/ServiceLogin?service=youtube',
    'https://accounts.youtube.com/accounts/SetSID',
    'https://consent.youtube.com/m?continue=x',
    'https://consent.google.com/ml',
    'https://accounts.google.no/accounts/SetSID',
    'https://accounts.google.co.uk/accounts/SetSID',
    'https://www.google.com/accounts/SetSID',
    'https://www.google.com/sorry/index'
  ]) {
    assert.ok(isYouTubeWindowUrl(value), value)
  }

  for (const value of [
    null,
    'http://www.youtube.com/',
    'https://www.youtube.com:8443/',
    'https://user@www.youtube.com/',
    'https://www.youtube.com.evil.example/',
    'https://studio.youtube.com/',
    'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE',
    'https://www.google.com/search?q=x',
    'https://www.google.com/accountsx',
    'https://myaccount.google.com/',
    'https://accounts.google.evil.example/',
    'https://accounts.google.co.evil/',
    'https://www.gstatic.com/',
    'tempo-ride://open?url=x',
    'javascript:alert(1)'
  ]) {
    assert.equal(isYouTubeWindowUrl(value), false, String(value))
  }
})

test('keeps the YouTube window on YouTube and sends other pages to the system browser', () => {
  assert.equal(youTubeNavigation('https://www.youtube.com/watch?v=M7lc1UVf-VE', true), 'allow')
  assert.equal(youTubeNavigation('https://accounts.google.com/v3/signin/identifier', true), 'allow')
  assert.equal(youTubeNavigation('https://example.com/merch', true), 'external')
  assert.equal(youTubeNavigation('https://www.youtube.com.evil.example/', true), 'external')
  assert.equal(youTubeNavigation('http://www.youtube.com/', true), 'external')
  assert.equal(youTubeNavigation('https://tempo.example/athlete/ride', true), 'external')
  for (const value of ['tempo-ride://open?url=x', 'file:///etc/passwd', 'javascript:alert(1)', 'about:blank', 'chrome://gpu']) {
    assert.equal(youTubeNavigation(value, true), 'deny', value)
  }

  // Players, ads and sign-in helpers load in subframes of the sandboxed window.
  for (const value of ['https://googleads.g.doubleclick.net/pagead/x', 'https://www.youtube.com/embed/x', 'about:blank', 'about:srcdoc']) {
    assert.equal(youTubeNavigation(value, false), 'allow', value)
  }
  for (const value of ['http://example.com/', 'file:///etc/passwd', 'tempo-ride://open', 'javascript:alert(1)']) {
    assert.equal(youTubeNavigation(value, false), 'deny', value)
  }
})

test('finds the chosen video on watch, Shorts, live and short-link pages', () => {
  const watch = (id, startSec = 0) => ({ id, url: `https://www.youtube.com/watch?v=${id}`, startSec })
  assert.deepEqual(parseYouTubeVideo('https://www.youtube.com/watch?v=M7lc1UVf-VE'), watch('M7lc1UVf-VE'))
  assert.deepEqual(parseYouTubeVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL1&index=2'), watch('dQw4w9WgXcQ'))
  assert.deepEqual(parseYouTubeVideo('https://m.youtube.com/watch/?v=dQw4w9WgXcQ&t=90s'), watch('dQw4w9WgXcQ', 90))
  assert.deepEqual(parseYouTubeVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=1h2m3s'), watch('dQw4w9WgXcQ', 3723))
  assert.deepEqual(parseYouTubeVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=75'), watch('dQw4w9WgXcQ', 75))
  assert.deepEqual(parseYouTubeVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=soon'), watch('dQw4w9WgXcQ'))
  assert.deepEqual(parseYouTubeVideo('https://www.youtube.com/shorts/abcdefghi_-'), watch('abcdefghi_-'))
  assert.deepEqual(parseYouTubeVideo('https://youtube.com/live/abcdefghi_-?feature=share'), watch('abcdefghi_-'))
  assert.deepEqual(parseYouTubeVideo('https://music.youtube.com/watch?v=abcdefghi_-'), watch('abcdefghi_-'))
  assert.deepEqual(parseYouTubeVideo('https://youtu.be/abcdefghi_-?t=30'), watch('abcdefghi_-', 30))

  for (const value of [
    null,
    'https://www.youtube.com/',
    'https://www.youtube.com/results?search_query=zwift',
    'https://www.youtube.com/@channel/videos',
    'https://www.youtube.com/watch',
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/watch?v=M7lc1UVf-VE1',
    'https://www.youtube.com/watch?v=M7lc1UVf%2BVE',
    'https://www.youtube.com/watch/extra?v=M7lc1UVf-VE',
    'https://www.youtube.com/shorts/M7lc1UVf-VE/extra',
    'https://www.youtube.com/embed/M7lc1UVf-VE',
    'http://www.youtube.com/watch?v=M7lc1UVf-VE',
    'https://www.youtube.com.evil.example/watch?v=M7lc1UVf-VE',
    'https://youtu.be/',
    'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE'
  ]) {
    assert.equal(parseYouTubeVideo(value), null, String(value))
  }
})
