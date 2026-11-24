const SCHEME = 'tempo-ride'

function parseWebUrl(value) {
  if (typeof value !== 'string' || !/^https?:\/\//i.test(value)) return null

  const url = URL.parse(value)
  if (!url || !['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    return null
  }
  return url
}

function parseRideLink(value) {
  if (typeof value !== 'string') return null

  const link = URL.parse(value)
  if (!link || link.protocol !== `${SCHEME}:` || link.host !== 'open' ||
      link.pathname || link.username || link.password || link.hash ||
      link.searchParams.size !== 1) {
    return null
  }

  const ride = parseWebUrl(link.searchParams.get('url'))
  return ride && /^\/athlete\/ride(\/[^/]+)?\/?$/.test(ride.pathname) ? ride : null
}

const YOUTUBE_EMBED_ORIGIN = 'https://www.youtube-nocookie.com'

/** The privacy-enhanced YouTube player for one video, the only foreign page a ride may frame. */
function isYouTubeEmbedUrl(value) {
  const url = parseWebUrl(value)
  return url !== null && url.origin === YOUTUBE_EMBED_ORIGIN && /^\/embed\/[A-Za-z0-9_-]{11}$/.test(url.pathname)
}

function isTrustedWebUrl(value, origins) {
  const url = parseWebUrl(value)
  return url !== null && origins.has(url.origin)
}

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/
const YOUTUBE_HOSTS = new Set(['www.youtube.com', 'youtube.com', 'm.youtube.com', 'music.youtube.com'])
// Google sign-in hops through these before landing back on YouTube.
const SIGN_IN_HOSTS = new Set([
  'youtu.be', 'accounts.google.com', 'accounts.youtube.com', 'consent.youtube.com', 'consent.google.com'
])
// Sign-in can set cookies on a country domain such as accounts.google.no.
const COUNTRY_ACCOUNTS_HOST = /^accounts\.google\.(?:com?\.)?[a-z]{2}$/
const GOOGLE_SIGN_IN_PATH = /^\/(?:accounts|signin|sorry|recaptcha)(?:\/|$)/

function httpsUrl(value) {
  const url = parseWebUrl(value)
  return url && url.protocol === 'https:' && url.port === '' ? url : null
}

/** A page the YouTube window may show itself: YouTube and the Google sign-in it needs. */
function isYouTubeWindowUrl(value) {
  const url = httpsUrl(value)
  if (!url) return false
  const host = url.hostname
  return YOUTUBE_HOSTS.has(host) || SIGN_IN_HOSTS.has(host) || COUNTRY_ACCOUNTS_HOST.test(host) ||
    (host === 'www.google.com' && GOOGLE_SIGN_IN_PATH.test(url.pathname))
}

/**
 * What the YouTube window does with a navigation: 'allow' it, open it in the system browser
 * ('external'), or 'deny' it. Subframes (players, ads, sign-in helpers) may load any HTTPS page
 * inside the sandboxed window; the top-level page stays on YouTube and Google sign-in.
 */
function youTubeNavigation(value, isMainFrame) {
  if (!isMainFrame) {
    return httpsUrl(value) || /^(?:about|blob|data):/i.test(String(value)) ? 'allow' : 'deny'
  }
  if (isYouTubeWindowUrl(value)) return 'allow'
  return parseWebUrl(value) ? 'external' : 'deny'
}

/** Seconds from a `t` or `start` parameter such as 90, 90s or 1h2m3s. */
function parseStartTime(value) {
  if (typeof value !== 'string') return 0
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(value)
  if (!match || value === '') return 0
  const [, hours = 0, minutes = 0, seconds = 0] = match
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)
}

/**
 * The video a YouTube page shows, from /watch?v=, /shorts/, /live/ or a youtu.be link, as its
 * ID, a canonical watch URL and the start time the link asks for. Null for any other page.
 */
function parseYouTubeVideo(value) {
  const url = httpsUrl(value)
  if (!url) return null

  let id = null
  if (url.hostname === 'youtu.be') {
    id = /^\/([^/]+)\/?$/.exec(url.pathname)?.[1]
  } else if (YOUTUBE_HOSTS.has(url.hostname)) {
    if (/^\/watch\/?$/.test(url.pathname)) id = url.searchParams.get('v')
    else id = /^\/(?:shorts|live)\/([^/]+)\/?$/.exec(url.pathname)?.[1]
  }
  if (!id || !VIDEO_ID.test(id)) return null

  return {
    id,
    url: `https://www.youtube.com/watch?v=${id}`,
    startSec: parseStartTime(url.searchParams.get('t') ?? url.searchParams.get('start'))
  }
}

module.exports = {
  SCHEME,
  parseWebUrl,
  parseRideLink,
  isTrustedWebUrl,
  isYouTubeEmbedUrl,
  isYouTubeWindowUrl,
  youTubeNavigation,
  parseYouTubeVideo
}
