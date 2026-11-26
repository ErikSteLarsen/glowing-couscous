const assert = require('node:assert/strict')
const test = require('node:test')
const { isTrustedWebUrl, isYouTubeEmbedUrl, parseRideLink, parseWebUrl } = require('../urls.cjs')

function rideLink(url) {
  return 'tempo-ride://open?url=' + encodeURIComponent(url)
}

test('decodes a ride URL once and preserves its session ID, query and fragment', () => {
  const url = 'https://wattonaut.example/athlete/ride/session%20one?resume=a%2Bb&device=hr#metrics'
  assert.equal(parseRideLink(rideLink(url)).href, url)
  const localRide = 'http://localhost:3000/athlete/ride/session-1'
  assert.equal(parseRideLink(rideLink(localRide)).href, localRide)
  const hub = 'https://wattonaut.example/athlete/ride'
  assert.equal(parseRideLink(rideLink(hub)).href, hub)
})

test('rejects malformed deep links and links to other routes or protocols', () => {
  const encoded = encodeURIComponent('https://wattonaut.example/athlete/ride/one')
  for (const value of [
    null,
    'tempo-ride://open',
    'tempo-ride://open?url=%ZZ',
    `tempo-ride://other?url=${encoded}`,
    `tempo-ride://open/extra?url=${encoded}`,
    `tempo-ride://open?url=${encoded}&url=${encoded}`,
    `tempo-ride://open?url=${encoded}#extra`,
    `tempo-ride://open?url=${encodeURIComponent(encoded)}`,
    rideLink('https://wattonaut.example/athlete/ride/session/extra'),
    rideLink('https://wattonaut.example/profile'),
    rideLink('file:///athlete/ride/one'),
    rideLink('https://user:pass@wattonaut.example/athlete/ride/one')
  ]) {
    assert.equal(parseRideLink(value), null, String(value))
  }
})

test('matches canonical origins including the scheme and port', () => {
  const origins = new Set(['https://wattonaut.example', 'http://localhost:3000'])
  assert.equal(parseWebUrl('https://WATTONAUT.example:443/settings').origin, 'https://wattonaut.example')
  assert.ok(isTrustedWebUrl('https://WATTONAUT.example:443/login', origins))
  assert.ok(isTrustedWebUrl('http://localhost:3000/', origins))

  for (const value of [
    'http://wattonaut.example', 'https://wattonaut.example:444', 'https://sub.wattonaut.example',
    'https://wattonaut.example.evil.example', 'https://wattonaut.example@evil.example',
    'https://other@wattonaut.example', 'blob:https://wattonaut.example/id', '//wattonaut.example',
    'https:wattonaut.example', 'javascript:alert(1)', 'about:blank'
  ]) {
    assert.equal(isTrustedWebUrl(value, origins), false, value)
  }
})

test('allows only the privacy-enhanced YouTube player for one video', () => {
  for (const value of [
    'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE',
    'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?enablejsapi=1&origin=https%3A%2F%2Fwattonaut.example&rel=0',
    'https://WWW.YOUTUBE-NOCOOKIE.COM:443/embed/dQw4w9WgXcQ#t=5'
  ]) {
    assert.ok(isYouTubeEmbedUrl(value), value)
  }

  for (const value of [
    null,
    'http://www.youtube-nocookie.com/embed/M7lc1UVf-VE',
    'https://youtube-nocookie.com/embed/M7lc1UVf-VE',
    'https://www.youtube.com/embed/M7lc1UVf-VE',
    'https://www.youtube.com/watch?v=M7lc1UVf-VE',
    'https://www.youtube-nocookie.com/embed/M7lc1UVf-V',
    'https://www.youtube-nocookie.com/embed/M7lc1UVf-VE/extra',
    'https://www.youtube-nocookie.com/embed/?list=PL123',
    'https://www.youtube-nocookie.com:8443/embed/M7lc1UVf-VE',
    'https://user@www.youtube-nocookie.com/embed/M7lc1UVf-VE',
    'https://www.youtube-nocookie.com.evil.example/embed/M7lc1UVf-VE'
  ]) {
    assert.equal(isYouTubeEmbedUrl(value), false, String(value))
  }
})
