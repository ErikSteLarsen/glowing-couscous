const { isYouTubeWindowUrl, parseWebUrl, parseYouTubeVideo, youTubeNavigation } = require('./urls.cjs')

const YOUTUBE_HOME = 'https://www.youtube.com/'
const YOUTUBE_PARTITION = 'persist:youtube'
const YOUTUBE_SIZE = [1100, 760]
const SCRIPT_TIMEOUT_MS = 2500
/** How long the Tempo page has to confirm it took a video before the YouTube window stays put. */
const ACK_TIMEOUT_MS = 1500
// Video fullscreen and YouTube's copy-link button; no camera, microphone, location or notifications.
const ALLOWED_PERMISSIONS = new Set(['fullscreen', 'clipboard-sanitized-write'])
const YOUTUBE_ORIGINS = new Set([
  'https://www.youtube.com', 'https://youtube.com', 'https://m.youtube.com', 'https://music.youtube.com'
])

function isYouTubeOrigin(value) {
  try {
    return YOUTUBE_ORIGINS.has(new URL(String(value)).origin)
  } catch {
    return false
  }
}

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

/**
 * Only the YouTube window itself, on a YouTube origin, gets fullscreen and the copy-link button.
 * Everything else (other permissions, ads and other frames' origins, any other contents) is denied.
 */
function configureSession(session, isOwnContents) {
  const allow = (contents, permission, origin) =>
    isOwnContents(contents) && ALLOWED_PERMISSIONS.has(permission) && isYouTubeOrigin(origin)
  session.setUserAgent(chromeUserAgent(session.getUserAgent()))
  session.setPermissionCheckHandler((contents, permission, requestingOrigin) =>
    allow(contents, permission, requestingOrigin))
  session.setPermissionRequestHandler((contents, permission, callback, details) => {
    callback(allow(contents, permission, details?.requestingUrl))
  })
  session.setDevicePermissionHandler(() => false)
  session.on('will-download', (event) => event.preventDefault())
}

/**
 * One reusable window on the real youtube.com in its own persistent session. When the rider
 * opens a video there, it pauses YouTube and sends `{ url, startSec, id }` to the trusted Tempo
 * page as `youtube:video`. Once that page confirms with `youtube:video-ack` (`ack(id)`), YouTube is
 * muted and hidden and Tempo comes forward; without a confirmation the YouTube window stays as it
 * was. Only the latest pick may complete: any later navigation to another page or video cancels it.
 */
function createYouTubeBrowser({
  createWindow,
  getTempoWindow,
  isTrusted,
  openExternal,
  timeoutMs = SCRIPT_TIMEOUT_MS,
  ackTimeoutMs = ACK_TIMEOUT_MS
}) {
  let window
  let lastId = null
  let handOffs = 0
  /** The ticket of the hand-off in progress, if any. */
  let busy = null
  /** The hand-off waiting for the Tempo page's ack: its ticket and how to settle it. */
  let pendingAck = null

  function trustedTempo() {
    const tempo = getTempoWindow()
    return tempo && !tempo.isDestroyed() && isTrusted(tempo.webContents.getURL()) ? tempo : null
  }

  function cancelPending() {
    handOffs++
    if (pendingAck) pendingAck.settle(false)
  }

  function waitForAck(ticket) {
    return new Promise((resolve) => {
      const timer = setTimeout(() => settle(false), ackTimeoutMs)
      function settle(acked) {
        clearTimeout(timer)
        if (pendingAck?.ticket === ticket) pendingAck = null
        resolve(acked)
      }
      pendingAck = { ticket, settle }
    })
  }

  /**
   * Pauses YouTube, offers the video to the Tempo page and steps aside once the page took it.
   * A newer pick, a move to another page, reopening or closing the window supersedes it. A newer
   * pick owns the pause from then on; otherwise the superseded hand-off lifts it again (its page
   * script may still finish after the move).
   */
  async function handOff(target, video, ticket) {
    if (!trustedTempo()) return
    busy = ticket
    const contents = target.webContents
    const current = () => ticket === handOffs && !target.isDestroyed()
    const release = () => { if (!target.isDestroyed()) contents.executeJavaScript(RELEASE_SCRIPT).catch(() => {}) }
    const superseded = () => { if (busy === ticket) release() }
    try {
      const playerTime = await withTimeout(contents.executeJavaScript(handOffScript(video.id)), timeoutMs)
        .catch(() => 0)
      if (!current()) return superseded()
      const tempo = trustedTempo()
      if (!tempo) return release()

      const startSec = Math.floor(playerTime > 0 ? playerTime : video.startSec)
      const acked = waitForAck(ticket)
      tempo.webContents.send('youtube:video', { url: video.url, startSec, id: ticket })
      const took = await acked
      if (!current()) return superseded()
      // Nothing took the video (no ride open, an older Tempo page): YouTube stays as it is.
      const shown = took && trustedTempo()
      if (!shown) return release()
      contents.setAudioMuted(true)
      target.hide()
      if (shown.isMinimized()) shown.restore()
      shown.show()
      shown.focus()
    } finally {
      if (busy === ticket) busy = null
    }
  }

  function wire(target) {
    const contents = target.webContents
    configureSession(contents.session, (other) => Boolean(other) && !target.isDestroyed() && other === contents)
    contents.setUserAgent(chromeUserAgent(contents.getUserAgent()))

    /** The navigation or pop-up came from YouTube's own top-level page, not an ad or other frame. */
    const fromMainFrame = (initiator) => initiator == null || initiator === contents.mainFrame

    function guard(event) {
      const decision = youTubeNavigation(event.url, event.isMainFrame)
      if (decision === 'allow') return
      event.preventDefault()
      if (decision === 'external' && fromMainFrame(event.initiator)) openExternal(event.url)
    }
    contents.on('will-frame-navigate', guard)
    contents.on('will-redirect', guard)
    contents.on('will-attach-webview', (event) => event.preventDefault())
    // Electron does not say which frame opened a pop-up; the referrer does, unless the opener hid it.
    // Pop-ups from anything but a YouTube page (ads, embeds, no referrer) are dropped.
    contents.setWindowOpenHandler(({ url, referrer }) => {
      if (isYouTubeOrigin(referrer?.url) && isYouTubeOrigin(contents.mainFrame?.url ?? contents.getURL())) {
        if (isYouTubeWindowUrl(url)) setImmediate(() => contents.loadURL(url).catch(() => {}))
        else if (parseWebUrl(url)) openExternal(url)
      }
      return { action: 'deny' }
    })

    // YouTube is a single-page app: picking a video is often a same-document navigation. Moving
    // to another page or video cancels a hand-off still in progress.
    function onNavigate(url) {
      const video = parseYouTubeVideo(url)
      const id = video?.id ?? null
      if (id === lastId) return
      lastId = id
      const interrupted = busy !== null
      cancelPending()
      if (video && target.isVisible()) handOff(target, video, handOffs).catch(() => {})
      else if (interrupted) contents.executeJavaScript(RELEASE_SCRIPT).catch(() => {})
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
        cancelPending()
        window.webContents.setAudioMuted(false)
        window.webContents.executeJavaScript(RELEASE_SCRIPT).catch(() => {})
        if (window.isMinimized()) window.restore()
        window.show()
      }
      window.focus()
    },
    /** The Tempo page took the video of hand-off `id`. */
    ack(id) {
      if (pendingAck && pendingAck.ticket === id) pendingAck.settle(true)
    },
    close() {
      cancelPending()
      if (window && !window.isDestroyed()) window.destroy()
      window = undefined
    }
  }
}

module.exports = {
  ACK_TIMEOUT_MS,
  YOUTUBE_HOME,
  YOUTUBE_PARTITION,
  YOUTUBE_SIZE,
  chromeUserAgent,
  createYouTubeBrowser,
  handOffScript
}
