const { isYouTubeWindowUrl, parseWebUrl, parseYouTubeVideo, youTubeNavigation } = require('./urls.cjs')

const YOUTUBE_HOME = 'https://www.youtube.com/'
const YOUTUBE_PARTITION = 'persist:youtube'
const YOUTUBE_SIZE = [1100, 760]
const SCRIPT_TIMEOUT_MS = 2500
// Video fullscreen and YouTube's copy-link button; no camera, microphone, location or notifications.
const ALLOWED_PERMISSIONS = new Set(['fullscreen', 'clipboard-sanitized-write'])

/** Electron's user agent without the Electron and app tokens, as desktop Chrome sends it. */
function chromeUserAgent(userAgent) {
  return userAgent
    .replace(/ Electron\/\S+/, '')
    .replace(/\(KHTML, like Gecko\) .*?Chrome\/(\d+)\S*/, '(KHTML, like Gecko) Chrome/$1.0.0.0')
}

/**
 * Runs in YouTube's page: waits briefly for the player to load the chosen video, reads its
 * position, pauses every video and keeps them paused until the rider reopens the window.
 */
function handOffScript(id) {
  return `(async (id) => {
  const players = () => [...document.querySelectorAll('#movie_player, #shorts-player')]
    .filter((player) => typeof player.getVideoData === 'function')
  const current = () => players().find((player) => player.getVideoData()?.video_id === id)
  for (let wait = 0; !current() && wait < 20; wait++) await new Promise((resolve) => setTimeout(resolve, 50))
  const player = current()
  const video = document.querySelector('video')
  const time = player ? Number(player.getCurrentTime?.()) : players().length === 0 ? Number(video?.currentTime ?? 0) : 0
  window.__tempoHandedOff = true
  if (!window.__tempoPauseGuard) {
    window.__tempoPauseGuard = true
    document.addEventListener('play', (event) => { if (window.__tempoHandedOff) event.target.pause?.() }, true)
  }
  for (const each of players()) each.pauseVideo?.()
  for (const each of document.querySelectorAll('video')) each.pause()
  return Number.isFinite(time) && time > 0 ? time : 0
})(${JSON.stringify(id)})`
}

const RELEASE_SCRIPT = 'window.__tempoHandedOff = false'

function withTimeout(promise, ms) {
  let timer
  return Promise.race([
    promise,
    new Promise((_resolve, reject) => { timer = setTimeout(() => reject(new Error('timeout')), ms) })
  ]).finally(() => clearTimeout(timer))
}

function configureSession(session) {
  session.setUserAgent(chromeUserAgent(session.getUserAgent()))
  session.setPermissionCheckHandler((_contents, permission) => ALLOWED_PERMISSIONS.has(permission))
  session.setPermissionRequestHandler((_contents, permission, callback) => {
    callback(ALLOWED_PERMISSIONS.has(permission))
  })
  session.setDevicePermissionHandler(() => false)
  session.on('will-download', (event) => event.preventDefault())
}

/**
 * One reusable window on the real youtube.com in its own persistent session. When the rider
 * opens a video there, it pauses YouTube, sends `{ url, startSec }` to the trusted Tempo page as
 * `youtube:video` and steps aside.
 */
function createYouTubeBrowser({ createWindow, getTempoWindow, isTrusted, openExternal, timeoutMs = SCRIPT_TIMEOUT_MS }) {
  let window
  let lastId = null
  let handOffs = 0

  function trustedTempo() {
    const tempo = getTempoWindow()
    return tempo && !tempo.isDestroyed() && isTrusted(tempo.webContents.getURL()) ? tempo : null
  }

  async function handOff(target, video) {
    const ticket = ++handOffs
    if (!trustedTempo()) return
    const contents = target.webContents
    const playerTime = await withTimeout(contents.executeJavaScript(handOffScript(video.id)), timeoutMs)
      .catch(() => 0)
    if (ticket !== handOffs || target.isDestroyed()) return
    contents.setAudioMuted(true)
    const tempo = trustedTempo()
    if (!tempo) return

    const startSec = Math.floor(playerTime > 0 ? playerTime : video.startSec)
    tempo.webContents.send('youtube:video', { url: video.url, startSec })
    target.hide()
    if (tempo.isMinimized()) tempo.restore()
    tempo.show()
    tempo.focus()
  }

  function wire(target) {
    const contents = target.webContents
    configureSession(contents.session)
    contents.setUserAgent(chromeUserAgent(contents.getUserAgent()))

    function guard(event) {
      const decision = youTubeNavigation(event.url, event.isMainFrame)
      if (decision === 'allow') return
      event.preventDefault()
      if (decision === 'external') openExternal(event.url)
    }
    contents.on('will-frame-navigate', guard)
    contents.on('will-redirect', guard)
    contents.on('will-attach-webview', (event) => event.preventDefault())
    contents.setWindowOpenHandler(({ url }) => {
      if (isYouTubeWindowUrl(url)) setImmediate(() => contents.loadURL(url).catch(() => {}))
      else if (parseWebUrl(url)) openExternal(url)
      return { action: 'deny' }
    })

    // YouTube is a single-page app: picking a video is often a same-document navigation.
    function onNavigate(url) {
      const video = parseYouTubeVideo(url)
      const id = video?.id ?? null
      if (id === lastId) return
      lastId = id
      if (video && target.isVisible()) handOff(target, video).catch(() => {})
    }
    contents.on('did-navigate', (_event, url) => onNavigate(url))
    contents.on('did-navigate-in-page', (_event, url, isMainFrame) => {
      if (isMainFrame) onNavigate(url)
    })
    target.on('closed', () => {
      if (window === target) window = undefined
    })
  }

  return {
    /** Opens the YouTube window, or brings back the one already open. */
    open() {
      if (!window || window.isDestroyed()) {
        window = createWindow()
        lastId = null
        wire(window)
        window.loadURL(YOUTUBE_HOME).catch(() => {})
      } else {
        window.webContents.setAudioMuted(false)
        window.webContents.executeJavaScript(RELEASE_SCRIPT).catch(() => {})
        if (window.isMinimized()) window.restore()
        window.show()
      }
      window.focus()
    },
    close() {
      if (window && !window.isDestroyed()) window.destroy()
      window = undefined
    }
  }
}

module.exports = {
  YOUTUBE_HOME,
  YOUTUBE_PARTITION,
  YOUTUBE_SIZE,
  chromeUserAgent,
  createYouTubeBrowser,
  handOffScript
}
