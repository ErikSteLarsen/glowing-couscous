const { app, BrowserWindow, dialog, Menu, powerSaveBlocker, shell } = require('electron')
const { registerAppImage } = require('./linux-integration.cjs')
const { readFileSync, renameSync, writeFileSync } = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { wireBluetooth } = require('./bluetooth.cjs')
const { openDesktopDialog } = require('./dialog.cjs')
const { launchTarget, parseSettings, rememberSite, startPageSite } = require('./launch.cjs')
const { createRecordingStore } = require('./recordings.cjs')
const { SCHEME, isTrustedWebUrl, isYouTubeEmbedUrl, parseRideLink, parseVideoLink, parseWebUrl } = require('./urls.cjs')
const { createVideoHandOff } = require('./video-hand-off.cjs')

const START_FILE = path.join(__dirname, 'ui', 'start.html')
const START_URL = pathToFileURL(START_FILE).href
const LINK_PREFIX = `${SCHEME}:`
const isLinux = process.platform === 'linux'
const RIDE_SIZE = [1200, 800]
const START_SIZE = [500, 390]
// Chromium's ERR_ABORTED: a navigation replaced by another one, not a failure.
const ABORTED = -3
const environmentOrigin = parseWebUrl(process.env.WATTONAUT_URL)?.origin
const trustedOrigins = new Set(environmentOrigin ? [environmentOrigin] : [])

let mainWindow
let settingsPath
let settings
let recordings
let pendingLink = Promise.resolve()
let loadError = ''

function openExternal(value) {
  const url = parseWebUrl(value)
  if (url) shell.openExternal(url.href).catch(() => {})
}

const videoHandOff = createVideoHandOff({ getAppWindow: () => mainWindow, isTrusted })

function readSettings() {
  try {
    return parseSettings(JSON.parse(readFileSync(settingsPath, 'utf8')))
  } catch (error) {
    if (error.code === 'ENOENT') return parseSettings(undefined)
    throw error
  }
}

function saveSettings(nextSettings) {
  const temporary = settingsPath + '.tmp'
  writeFileSync(temporary, JSON.stringify(nextSettings), { mode: 0o600, flush: true })
  renameSync(temporary, settingsPath)
  settings = nextSettings
}

function isTrusted(url) {
  return isTrustedWebUrl(url, trustedOrigins)
}

function openSite(window, url) {
  if (!isTrusted(url.href) || window.isDestroyed()) return
  if (window.webContents.getURL() === START_URL || window.webContents.getURL() === '') {
    window.setSize(...RIDE_SIZE)
    window.center()
  }
  window.loadURL(url.href).catch(() => {})
}

/** Opens a site the user chose and remembers it as the last used site. */
function openChosenSite(window, url) {
  trustedOrigins.add(url.origin)
  saveSettings(rememberSite(settings, url.origin))
  openSite(window, url)
}

function showStartPage(window, error = '') {
  loadError = error
  window.setSize(...START_SIZE)
  window.center()
  window.loadFile(START_FILE).catch(() => {})
}

function buildMenu() {
  const changeSite = {
    label: 'Change Wattonaut site…',
    click: () => showStartPage(showMainWindow())
  }
  const isMac = process.platform === 'darwin'
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { label: 'File', submenu: [changeSite, { type: 'separator' }, isMac ? { role: 'close' } : { role: 'quit' }] },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' }
  ]))
}

function wireNavigation(window) {
  const contents = window.webContents
  function openTarget(value) {
    const webUrl = parseWebUrl(value)
    if (webUrl && !trustedOrigins.has(webUrl.origin)) {
      openExternal(webUrl.href)
      return
    }

    const target = webUrl ?? (isTrusted(contents.getURL()) ? parseRideLink(value) : null)
    if (target) setImmediate(() => openSite(window, target))
  }

  // The ride's YouTube view frames the privacy-enhanced player directly inside the trusted page.
  function isEmbeddedPlayer(event) {
    const parent = event.frame?.parent
    return !event.isMainFrame && parent != null &&
      parent.frameTreeNodeId === contents.mainFrame.frameTreeNodeId &&
      isTrusted(contents.getURL()) && isYouTubeEmbedUrl(event.url)
  }

  function guard(event) {
    if (isTrusted(event.url) || isEmbeddedPlayer(event)) return
    event.preventDefault()
    if (event.isMainFrame) openTarget(event.url)
  }

  contents.on('will-frame-navigate', guard)
  contents.on('will-redirect', guard)
  contents.on('will-attach-webview', (event) => event.preventDefault())
  contents.setWindowOpenHandler(({ url }) => {
    openTarget(url)
    return { action: 'deny' }
  })
}

function wirePermissions(contents) {
  // Bluetooth for trainers and fullscreen for the ride screen, only for the trusted page itself.
  function allowMainFrame(sender, permission, url, isMainFrame) {
    return sender === contents && (permission === 'bluetooth' || permission === 'fullscreen') && isMainFrame &&
      isTrusted(url) && isTrusted(contents.getURL())
  }

  contents.session.setPermissionCheckHandler((sender, permission, origin, details) =>
    allowMainFrame(sender, permission, origin, details.isMainFrame))
  contents.session.setPermissionRequestHandler((sender, permission, callback, details) => {
    callback(allowMainFrame(sender, permission, details.requestingUrl, details.isMainFrame))
  })
  // Electron currently routes Web Bluetooth through the chooser and pairing handler.
  contents.session.setDevicePermissionHandler(({ deviceType, origin }) =>
    deviceType === 'bluetooth' && isTrusted(origin))
}

function wireIpc(window) {
  const contents = window.webContents
  const ipc = contents.ipc

  function assertMainPage(event, isAllowed) {
    const frame = event.senderFrame
    if (!frame || frame !== contents.mainFrame || !isAllowed(frame.url)) {
      throw new Error('Wattonaut Ride denied access to this page.')
    }
  }

  // Backups are scoped to the page's origin so one Wattonaut server never sees another's rides.
  const senderOrigin = (event) => new URL(event.senderFrame.url).origin
  const isStart = (url) => url === START_URL
  ipc.handle('setup:get', (event) => {
    assertMainPage(event, isStart)
    const error = loadError
    loadError = ''
    return { site: startPageSite({ settings, environmentOrigin }), offerLocalhost: !app.isPackaged, error }
  })
  ipc.handle('setup:open-site', (event, value) => {
    assertMainPage(event, isStart)
    const url = parseWebUrl(value)
    if (!url) throw new Error('Enter a full Wattonaut site URL starting with https:// or http://.')

    openChosenSite(window, new URL('/athlete/ride', url.origin))
  })
  ipc.handle('recording:save', (event, key, json) => {
    assertMainPage(event, isTrusted)
    return recordings.save(senderOrigin(event), key, json)
  })
  ipc.handle('recording:list', (event) => {
    assertMainPage(event, isTrusted)
    return recordings.list(senderOrigin(event))
  })
  ipc.handle('recording:delete', (event, key) => {
    assertMainPage(event, isTrusted)
    return recordings.delete(senderOrigin(event), key)
  })
  // The Send to Wattonaut bookmark is set up in the rider's own browser, where YouTube is signed in.
  ipc.handle('youtube:open-bookmark-page', (event) => {
    assertMainPage(event, isTrusted)
    openExternal(new URL('/athlete/ride/send', senderOrigin(event)).href)
  })
  // The ride page took the video of hand-off `id`.
  ipc.on('youtube:video-ack', (event, id) => {
    try {
      assertMainPage(event, isTrusted)
    } catch {
      return
    }
    if (Number.isSafeInteger(id)) videoHandOff.ack(id)
  })
}

function showMainWindow() {
  if (!mainWindow) {
    const home = launchTarget(settings)
    const [width, height] = home ? RIDE_SIZE : START_SIZE
    const window = new BrowserWindow({
      title: 'Wattonaut Ride',
      width,
      height,
      minWidth: 400,
      minHeight: 300,
      autoHideMenuBar: true,
      backgroundColor: '#0e1010',
      ...(isLinux ? { icon: path.join(__dirname, 'build', 'icon.png') } : {}),
      webPreferences: {
        partition: 'persist:tempo-ride',
        preload: path.join(__dirname, 'preload.cjs'),
        additionalArguments: [`--tempo-desktop-version=${app.getVersion()}`],
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
        devTools: !app.isPackaged
      }
    })
    mainWindow = window
    wireNavigation(window)
    wirePermissions(window.webContents)
    wireBluetooth(window, isTrusted)
    wireIpc(window)

    const blocker = powerSaveBlocker.start('prevent-display-sleep')
    window.on('closed', () => {
      powerSaveBlocker.stop(blocker)
      mainWindow = undefined
    })
    // A site that cannot load (offline, server down) returns to the start page instead of a blank window.
    window.webContents.on('did-fail-load', (_event, code, _description, url, isMainFrame) => {
      const origin = parseWebUrl(url)?.origin
      if (!isMainFrame || code === ABORTED || !origin) return
      showStartPage(window, `Wattonaut Ride could not reach ${origin}. Check your connection and try again.`)
    })
    if (home) window.loadURL(home.href).catch(() => {})
    else window.loadFile(START_FILE).catch(() => {})
  }

  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
  return mainWindow
}

async function openLink(value) {
  const window = showMainWindow()
  const video = parseVideoLink(value)
  if (video) {
    // The message is not awaited, so it never holds up later links.
    if (!await videoHandOff.send(video) && !window.isDestroyed()) {
      dialog.showMessageBox(window, {
        type: 'info',
        message: 'No ride is open.',
        detail: 'Start your ride in Wattonaut Ride, then send the video again.'
      }).catch(() => {})
    }
    return
  }

  const url = parseRideLink(value)
  if (!url) {
    await dialog.showMessageBox(window, {
      type: 'warning',
      message: 'Wattonaut Ride could not open this link.',
      detail: 'Open the ride again from the Wattonaut website.'
    })
    return
  }

  if (!isTrusted(url.href)) {
    const response = await new Promise((resolve) => {
      openDesktopDialog(window, { mode: 'trust', origin: url.origin }, resolve)
    })
    if (response !== 'confirm' || window.isDestroyed()) return
  }

  openChosenSite(window, url)
}

function findLink(argv) {
  return argv.find((argument) => argument.toLowerCase().startsWith(LINK_PREFIX))
}

function start(startupLink) {
  function enqueueLink(link) {
    pendingLink = pendingLink.then(() => openLink(link)).catch((error) => {
      dialog.showErrorBox('Wattonaut Ride', error.message)
    })
  }

  app.on('open-url', (event, url) => {
    event.preventDefault()
    if (!settings) startupLink = url
    else enqueueLink(url)
  })
  app.on('second-instance', (_event, argv, _cwd, data) => {
    const link = data?.link ?? findLink(argv)
    if (!settings) startupLink = link ?? startupLink
    else if (link) enqueueLink(link)
    else showMainWindow()
  })
  app.on('activate', () => {
    if (settings) showMainWindow()
  })
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })

  if (process.defaultApp && !isLinux) {
    app.setAsDefaultProtocolClient(SCHEME, process.execPath, [app.getAppPath()])
  } else if (!isLinux) {
    app.setAsDefaultProtocolClient(SCHEME)
  }

  app.whenReady().then(() => {
    const userData = app.getPath('userData')
    settingsPath = path.join(userData, 'settings.json')
    settings = readSettings()
    if (settings.site) trustedOrigins.add(settings.site)
    for (const origin of settings.origins) trustedOrigins.add(origin)
    recordings = createRecordingStore(path.join(userData, 'recordings'))
    // Backups written before origin scoping have no known origin; see README.
    recordings.migrateLegacy(settings.site).catch(() => {})
    buildMenu()
    if (isLinux) {
      registerAppImage({ iconPath: path.join(__dirname, 'build', 'icon.png') }).catch(() => {})
    }
    if (startupLink) enqueueLink(startupLink)
    else showMainWindow()
  }).catch((error) => {
    dialog.showErrorBox('Wattonaut Ride', error.message)
    app.quit()
  })
}

app.setName('Wattonaut Ride')
// Versions up to 0.3.0 were called Tempo Ride. Keep their folder so settings, sign-ins and ride backups carry over.
app.setPath('userData', path.join(app.getPath('appData'), 'Tempo Ride'))
if (isLinux) {
  const features = app.commandLine.getSwitchValue('enable-features')
  app.commandLine.appendSwitch('enable-features', [features, 'WebBluetooth'].filter(Boolean).join(','))
}

const link = findLink(process.argv)
if (app.requestSingleInstanceLock({ link: link ?? null })) start(link)
else app.quit()
