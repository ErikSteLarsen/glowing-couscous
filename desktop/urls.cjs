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

module.exports = { SCHEME, parseWebUrl, parseRideLink, isTrustedWebUrl, isYouTubeEmbedUrl }
