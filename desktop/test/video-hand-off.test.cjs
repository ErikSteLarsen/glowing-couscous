const assert = require('node:assert/strict')
const test = require('node:test')
const { parseVideoLink } = require('../urls.cjs')
const { createVideoHandOff } = require('../video-hand-off.cjs')

const VIDEO = { url: 'https://www.youtube.com/watch?v=M7lc1UVf-VE', startSec: 90 }

function appWindow(url = 'https://tempobuilder.example/athlete/ride/1') {
  const sent = []
  return { sent, isDestroyed: () => false, webContents: { getURL: () => url, send: (channel, video) => sent.push([channel, video]) } }
}

function handOff(window) {
  return createVideoHandOff({
    getAppWindow: () => window,
    isTrusted: (url) => url.startsWith('https://tempobuilder.example/'),
    ackTimeoutMs: 20
  })
}

test('reads a video link and rejects anything else', () => {
  assert.deepEqual(parseVideoLink('tempo-ride://video?v=M7lc1UVf-VE&t=90'), VIDEO)
  assert.deepEqual(parseVideoLink('tempo-ride://video/?v=M7lc1UVf-VE'), { ...VIDEO, startSec: 0 })
  for (const value of [
    null,
    'tempo-ride://video',
    'tempo-ride://video?v=short',
    'tempo-ride://video?v=M7lc1UVf-VE&v=M7lc1UVf-VE',
    'tempo-ride://video?v=M7lc1UVf-VE&t=-1',
    'tempo-ride://video?v=M7lc1UVf-VE&t=999999',
    'tempo-ride://video?v=M7lc1UVf-VE&t=1&t=2',
    'tempo-ride://video?v=M7lc1UVf-VE&url=https://evil.example',
    'tempo-ride://video/x?v=M7lc1UVf-VE',
    'tempo-ride://user@video?v=M7lc1UVf-VE',
    'tempo-ride://open?v=M7lc1UVf-VE',
    'https://video?v=M7lc1UVf-VE'
  ]) {
    assert.equal(parseVideoLink(value), null, String(value))
  }
})

test('resolves true only when the page acks that video', async () => {
  const window = appWindow()
  const sender = handOff(window)
  const result = sender.send(VIDEO)
  assert.deepEqual(window.sent, [['youtube:video', { ...VIDEO, id: 1 }]])
  sender.ack(2)
  sender.ack(1)
  assert.equal(await result, true)
  assert.equal(await sender.send(VIDEO), false)
})

test('a newer video supersedes one still waiting', async () => {
  const sender = handOff(appWindow())
  const first = sender.send(VIDEO)
  const second = sender.send(VIDEO)
  assert.equal(await first, false)
  sender.ack(1)
  sender.ack(2)
  assert.equal(await second, true)
})

test('sends nothing to an untrusted page or without a window', async () => {
  const start = appWindow('file:///start.html')
  assert.equal(await handOff(start).send(VIDEO), false)
  assert.deepEqual(start.sent, [])
  assert.equal(await handOff(undefined).send(VIDEO), false)
})
