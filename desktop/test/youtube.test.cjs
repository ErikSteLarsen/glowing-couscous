const assert = require('node:assert/strict')
const { EventEmitter } = require('node:events')
const test = require('node:test')
const vm = require('node:vm')
const { chromeUserAgent, createYouTubeBrowser, handOffScript } = require('../youtube.cjs')

const ELECTRON_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'tempo-ride/0.2.2 Chrome/156.0.8078.100 Electron/45.4.1 Safari/537.36'
const CHROME_UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/156.0.0.0 Safari/537.36'

function fakeWindow(url = '', { playerTime = 0 } = {}) {
  const window = new EventEmitter()
  const session = Object.assign(new EventEmitter(), {
    getUserAgent: () => ELECTRON_UA,
    setUserAgent: (value) => { session.userAgent = value },
    setPermissionCheckHandler: (handler) => { session.check = handler },
    setPermissionRequestHandler: (handler) => { session.request = handler },
    setDevicePermissionHandler: (handler) => { session.device = handler }
  })
  const contents = Object.assign(new EventEmitter(), {
    session,
    sent: [],
    scripts: [],
    muted: false,
    getURL: () => url,
    getUserAgent: () => ELECTRON_UA,
    setUserAgent: (value) => { contents.userAgent = value },
    setAudioMuted: (value) => { contents.muted = value },
    setWindowOpenHandler: (handler) => { contents.openHandler = handler },
    loadURL: async (value) => { contents.loaded = value },
    executeJavaScript: (script) => {
      contents.scripts.push(script)
      return typeof playerTime === 'function' ? playerTime() : Promise.resolve(playerTime)
    },
    send: (channel, value) => contents.sent.push([channel, value])
  })
  return Object.assign(window, {
    webContents: contents,
    visible: true,
    destroyed: false,
    focused: 0,
    isDestroyed: () => window.destroyed,
    isVisible: () => window.visible,
    isMinimized: () => false,
    restore() {},
    show: () => { window.visible = true },
    hide: () => { window.visible = false },
    focus: () => { window.focused++ },
    loadURL: (value) => contents.loadURL(value),
    destroy: () => { window.destroyed = true; window.emit('closed') }
  })
}

function setup({ tempoUrl = 'https://tempo.example/athlete/ride/1', playerTime, timeoutMs } = {}) {
  const tempo = fakeWindow(tempoUrl)
  const external = []
  const created = []
  const youtube = createYouTubeBrowser({
    createWindow: () => {
      const window = fakeWindow('', { playerTime })
      created.push(window)
      return window
    },
    getTempoWindow: () => tempo,
    isTrusted: (url) => url.startsWith('https://tempo.example/'),
    openExternal: (url) => external.push(url),
    timeoutMs
  })
  return { tempo, external, created, youtube }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 5))
const navigate = (window, url) => window.webContents.emit('did-navigate', {}, url)
const navigateInPage = (window, url, isMainFrame = true) =>
  window.webContents.emit('did-navigate-in-page', {}, url, isMainFrame)

test('strips the Electron and app tokens from the user agent', () => {
  assert.equal(chromeUserAgent(ELECTRON_UA), CHROME_UA)
  assert.equal(chromeUserAgent(CHROME_UA), CHROME_UA)
})

test('reads the position of the chosen video only and pauses every video', async () => {
  const paused = []
  const listeners = []
  const player = (id, time) => ({
    getVideoData: () => ({ video_id: id }),
    getCurrentTime: () => time,
    pauseVideo: () => paused.push(id)
  })
  const run = (players, videos = []) => {
    const context = {
      setTimeout,
      document: {
        querySelectorAll: (selector) => selector === 'video' ? videos : players,
        querySelector: () => videos[0],
        addEventListener: (...args) => listeners.push(args)
      }
    }
    context.window = context
    return { result: vm.runInNewContext(handOffScript('M7lc1UVf-VE'), context), context }
  }

  const chosen = run([player('M7lc1UVf-VE', 42.5)], [{ currentTime: 42.5, pause: () => paused.push('video') }])
  assert.equal(await chosen.result, 42.5)
  assert.equal(chosen.context.__tempoHandedOff, true)
  assert.deepEqual(paused, ['M7lc1UVf-VE', 'video'])
  assert.equal(listeners.length, 1)
  assert.equal(listeners[0][0], 'play')

  // A player still showing the previous video reports no position for the new one.
  assert.equal(await run([player('dQw4w9WgXcQ', 300)]).result, 0)
  // Without YouTube's player API, the page's video element is the fallback.
  assert.equal(await run([], [{ currentTime: 7, pause() {} }]).result, 7)
})

test('opens one YouTube window with a locked-down session and reuses it', () => {
  const { youtube, created } = setup()
  youtube.open()
  assert.equal(created.length, 1)
  const [window] = created
  const { session } = window.webContents
  assert.equal(window.webContents.loaded, 'https://www.youtube.com/')
  assert.equal(window.webContents.userAgent, CHROME_UA)
  assert.equal(session.userAgent, CHROME_UA)
  for (const permission of ['notifications', 'geolocation', 'media', 'midi', 'openExternal', 'display-capture']) {
    assert.equal(session.check(null, permission), false, permission)
    let granted
    session.request(null, permission, (value) => { granted = value })
    assert.equal(granted, false, permission)
  }
  assert.equal(session.check(null, 'fullscreen'), true)
  assert.equal(session.device({ deviceType: 'usb' }), false)
  let downloadBlocked = false
  session.emit('will-download', { preventDefault: () => { downloadBlocked = true } })
  assert.ok(downloadBlocked)

  window.hide()
  window.webContents.muted = true
  youtube.open()
  assert.equal(created.length, 1)
  assert.ok(window.isVisible())
  assert.equal(window.webContents.muted, false)
  assert.equal(window.webContents.scripts.at(-1), 'window.__tempoHandedOff = false')

  window.destroy()
  youtube.open()
  assert.equal(created.length, 2)
})

test('guards navigation and popups in the YouTube window', () => {
  const { youtube, created, external } = setup()
  youtube.open()
  const contents = created[0].webContents
  const attempt = (url, isMainFrame = true) => {
    let prevented = false
    contents.emit('will-frame-navigate', { url, isMainFrame, preventDefault: () => { prevented = true } })
    return prevented
  }
  assert.equal(attempt('https://accounts.google.com/signin'), false)
  assert.equal(attempt('https://googleads.g.doubleclick.net/x', false), false)
  assert.equal(attempt('https://example.com/shop'), true)
  assert.equal(attempt('tempo-ride://open?url=x'), true)
  assert.deepEqual(external, ['https://example.com/shop'])

  assert.deepEqual(contents.openHandler({ url: 'https://example.org/' }), { action: 'deny' })
  assert.deepEqual(contents.openHandler({ url: 'file:///etc/passwd' }), { action: 'deny' })
  assert.deepEqual(external, ['https://example.com/shop', 'https://example.org/'])
})

test('hands a chosen video to the Tempo page once, pauses YouTube and steps aside', async () => {
  const { youtube, created, tempo } = setup({ playerTime: 12.7 })
  youtube.open()
  const [window] = created
  navigateInPage(window, 'https://www.youtube.com/')
  navigateInPage(window, 'https://www.youtube.com/watch?v=M7lc1UVf-VE')
  navigateInPage(window, 'https://www.youtube.com/watch?v=M7lc1UVf-VE&pp=abc')
  navigateInPage(window, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', false)
  await settle()

  assert.deepEqual(tempo.webContents.sent, [['youtube:video', { url: 'https://www.youtube.com/watch?v=M7lc1UVf-VE', startSec: 12 }]])
  assert.match(window.webContents.scripts[0], /"M7lc1UVf-VE"/)
  assert.match(window.webContents.scripts[0], /pause/)
  assert.equal(window.webContents.muted, true)
  assert.equal(window.isVisible(), false)
  assert.equal(tempo.focused, 1)

  // A different video after the rider comes back is a new choice.
  youtube.open()
  navigate(window, 'https://www.youtube.com/shorts/abcdefghi_-')
  await settle()
  assert.deepEqual(tempo.webContents.sent.at(-1), ['youtube:video', { url: 'https://www.youtube.com/watch?v=abcdefghi_-', startSec: 12 }])
})

test('uses the link start time when the player cannot be read in time', async () => {
  const { youtube, created, tempo } = setup({ playerTime: () => new Promise(() => {}), timeoutMs: 10 })
  youtube.open()
  navigate(created[0], 'https://www.youtube.com/watch?v=M7lc1UVf-VE&t=1m5s')
  await new Promise((resolve) => setTimeout(resolve, 30))
  assert.deepEqual(tempo.webContents.sent, [['youtube:video', { url: 'https://www.youtube.com/watch?v=M7lc1UVf-VE', startSec: 65 }]])
})

test('sends nothing to an untrusted page or while the window is hidden', async () => {
  const untrusted = setup({ tempoUrl: 'file:///app/ui/start.html' })
  untrusted.youtube.open()
  navigate(untrusted.created[0], 'https://www.youtube.com/watch?v=M7lc1UVf-VE')
  await settle()
  assert.deepEqual(untrusted.tempo.webContents.sent, [])
  assert.equal(untrusted.created[0].webContents.scripts.length, 0)
  assert.ok(untrusted.created[0].isVisible())

  const hidden = setup()
  hidden.youtube.open()
  hidden.created[0].hide()
  navigate(hidden.created[0], 'https://www.youtube.com/watch?v=M7lc1UVf-VE')
  await settle()
  assert.deepEqual(hidden.tempo.webContents.sent, [])
})

test('closes the YouTube window with the Tempo window', () => {
  const { youtube, created } = setup()
  youtube.open()
  youtube.close()
  assert.ok(created[0].isDestroyed())
  youtube.close()
})
