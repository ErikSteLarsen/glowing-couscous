const { parseWebUrl } = require('./urls.cjs')
const { tempoDefaultSite } = require('./package.json')

const RIDE_PATH = '/athlete/ride'
const DEFAULT_SITE = parseWebUrl(tempoDefaultSite)?.origin

const toOrigin = (value) => parseWebUrl(value)?.origin

/** Normalizes saved settings: `site` is the last opened origin, `origins` the trusted extras. */
function parseSettings(saved) {
  const site = toOrigin(saved?.site)
  return {
    ...(site ? { site } : {}),
    origins: Array.isArray(saved?.origins) ? [...new Set(saved.origins.flatMap((value) => {
      const origin = toOrigin(value)
      return origin ? [origin] : []
    }))] : []
  }
}

/** Settings after a site opened: it becomes the last used site and stays trusted. */
function rememberSite(settings, origin) {
  const origins = settings.origins.includes(origin) || settings.site === origin
    ? settings.origins
    : [...settings.origins, origin]
  return { ...settings, site: origin, origins }
}

/** Where a launch without a link goes: the saved site's ride home, or null for the start page. */
function launchTarget(settings) {
  return settings.site ? new URL(RIDE_PATH, settings.site) : null
}

/** The value the start page is prefilled with. */
function startPageSite({ settings, environmentOrigin, defaultSite = DEFAULT_SITE }) {
  return settings.site ?? environmentOrigin ?? defaultSite ?? ''
}

module.exports = { DEFAULT_SITE, RIDE_PATH, launchTarget, parseSettings, rememberSite, startPageSite }
