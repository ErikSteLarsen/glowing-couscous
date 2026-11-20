const assert = require('node:assert/strict')
const test = require('node:test')
const { isTrustedWebUrl, parseRideLink, parseWebUrl } = require('../urls.cjs')

function rideLink(url) {
  return 'tempo-ride://open?url=' + encodeURIComponent(url)
}

test('decodes a ride URL once and preserves its session ID, query and fragment', () => {
  const url = 'https://tempo.example/athlete/ride/session%20one?resume=a%2Bb&device=hr#metrics'
  assert.equal(parseRideLink(rideLink(url)).href, url)
  const localRide = 'http://localhost:3000/athlete/ride/session-1'
  assert.equal(parseRideLink(rideLink(localRide)).href, localRide)
})

test('rejects malformed deep links and links to other routes or protocols', () => {
  const encoded = encodeURIComponent('https://tempo.example/athlete/ride/one')
  for (const value of [
    null,
    'tempo-ride://open',
    'tempo-ride://open?url=%ZZ',
    `tempo-ride://other?url=${encoded}`,
    `tempo-ride://open/extra?url=${encoded}`,
    `tempo-ride://open?url=${encoded}&url=${encoded}`,
    `tempo-ride://open?url=${encoded}#extra`,
    `tempo-ride://open?url=${encodeURIComponent(encoded)}`,
    rideLink('https://tempo.example/athlete/ride/'),
    rideLink('https://tempo.example/athlete/ride/session/extra'),
    rideLink('https://tempo.example/profile'),
    rideLink('file:///athlete/ride/one'),
    rideLink('https://user:pass@tempo.example/athlete/ride/one')
  ]) {
    assert.equal(parseRideLink(value), null, String(value))
  }
})

test('matches canonical origins including the scheme and port', () => {
  const origins = new Set(['https://tempo.example', 'http://localhost:3000'])
  assert.equal(parseWebUrl('https://TEMPO.example:443/settings').origin, 'https://tempo.example')
  assert.ok(isTrustedWebUrl('https://TEMPO.example:443/login', origins))
  assert.ok(isTrustedWebUrl('http://localhost:3000/', origins))

  for (const value of [
    'http://tempo.example', 'https://tempo.example:444', 'https://sub.tempo.example',
    'https://tempo.example.evil.example', 'https://tempo.example@evil.example',
    'https://other@tempo.example', 'blob:https://tempo.example/id', '//tempo.example',
    'https:tempo.example', 'javascript:alert(1)', 'about:blank'
  ]) {
    assert.equal(isTrustedWebUrl(value, origins), false, value)
  }
})
