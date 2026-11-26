const assert = require('node:assert/strict')
const test = require('node:test')
const { DEFAULT_SITE, launchTarget, parseSettings, rememberSite, startPageSite } = require('../launch.cjs')

test('normalizes saved settings to origins', () => {
  assert.deepEqual(parseSettings(undefined), { origins: [] })
  assert.deepEqual(parseSettings({ site: 'ftp://x', origins: 'nope' }), { origins: [] })
  assert.deepEqual(parseSettings({
    site: 'https://wattonaut.example/athlete/ride',
    origins: ['http://localhost:3000/x', 'javascript:alert(1)', 'http://localhost:3000']
  }), { site: 'https://wattonaut.example', origins: ['http://localhost:3000'] })
})

test('a deep-linked site becomes the last used site and stays trusted', () => {
  const first = rememberSite({ origins: [] }, 'https://wattonaut.example')
  assert.deepEqual(first, { site: 'https://wattonaut.example', origins: ['https://wattonaut.example'] })
  const second = rememberSite(first, 'http://localhost:3001')
  assert.deepEqual(second, {
    site: 'http://localhost:3001',
    origins: ['https://wattonaut.example', 'http://localhost:3001']
  })
  assert.deepEqual(rememberSite(second, 'https://wattonaut.example').origins, second.origins)
  assert.deepEqual(rememberSite({ site: 'https://a.example', origins: [] }, 'https://a.example').origins, [])
})

test('a plain launch opens the saved site ride home, else the start page', () => {
  assert.equal(launchTarget({ origins: [] }), null)
  assert.equal(launchTarget({ site: 'https://wattonaut.example', origins: [] }).href,
    'https://wattonaut.example/athlete/ride')
})

test('prefills the start page with saved site, then WATTONAUT_URL, then the default', () => {
  const settings = { origins: [] }
  assert.equal(startPageSite({ settings: { site: 'https://a.example', origins: [] }, environmentOrigin: 'http://localhost:3001' }), 'https://a.example')
  assert.equal(startPageSite({ settings, environmentOrigin: 'http://localhost:3001' }), 'http://localhost:3001')
  assert.equal(startPageSite({ settings }), DEFAULT_SITE)
  assert.equal(startPageSite({ settings, defaultSite: null }), '')
  assert.equal(DEFAULT_SITE, 'https://glowing-couscous-delta.vercel.app')
})
