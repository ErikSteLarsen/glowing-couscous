const { app, BrowserWindow, dialog, powerSaveBlocker, shell } = require('electron')
const { readFileSync, renameSync, writeFileSync } = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const { wireBluetooth } = require('./bluetooth.cjs')
const { createRecordingStore } = require('./recordings.cjs')
const { SCHEME, isTrustedWebUrl, parseRideLink, parseWebUrl } = require('./urls.cjs')

const START_FILE = path.join(__dirname, 'ui', 'start.html')
const START_URL = pathToFileURL(START_FILE).href
const LINK_PREFIX = `${SCHEME}:`
const RIDE_SIZE = [1200, 800]
const environmentOrigin = parseWebUrl(process.env.TEMPO_URL)?.origin
const trustedOrigins = new Set(environmentOrigin ? [environmentOrigin] : [])

let mainWindow
let settingsPath
let settings
let recordings
let pendingLink = Promise.resolve()

function readSettings() {
  try {
    const saved = JSON.parse(readFileSync(settingsPath, 'utf8'))
    return {
      site: parseWebUrl(saved?.site)?.origin,
      origins: Array.isArray(saved?.origins)
        ? saved.origins.flatMap((value) => {
            const url = parseWebUrl(value)
            return url ? [url.origin] : []
          })
        : []
    }
  } catch (error) {
    if (error.code === 'ENOENT') return { origins: [] }
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

function wireNavigation(window) {
  const contents = window.webContents
  function openTarget(value) {
    const webUrl = parseWebUrl(value)
    if (webUrl && !trustedOrigins.has(webUrl.origin)) {
      shell.openExternal(webUrl.href).catch(() => {})
      return
    }

    const target = webUrl ?? (isTrusted(contents.getURL()) ? parseRideLink(value) : null)
    if (target) setImmediate(() => openSite(window, target))
  }

  function guard(event) {
    if (isTrusted(event.url)) return
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
  function allowBluetooth(sender, permission, url, isMainFrame) {
    return sender === contents && permission === 'bluetooth' && isMainFrame &&
      isTrusted(url) && isTrusted(contents.getURL())
  }

  contents.session.setPermissionCheckHandler((sender, permission, origin, details) =>
    allowBluetooth(sender, permission, origin, details.isMainFrame))
  contents.session.setPermissionRequestHandler((sender, permission, callback, details) => {
    callback(allowBluetooth(sender, permission, details.requestingUrl, details.isMainFrame))
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
      throw new Error('Tempo Ride denied access to this page.')
    }
  }

  const isStart = (url) => url === START_URL
  ipc.handle('setup:get-site', (event) => {
    assertMainPage(event, isStart)
    return settings.site ?? environmentOrigin ?? ''
  })
  ipc.handle('setup:open-site', (event, value) => {
    assertMainPage(event, isStart)
    const url = parseWebUrl(value)
    if (!url) throw new Error('Enter a full Tempo site URL starting with https:// or http://.')

    saveSettings({ ...settings, site: url.origin })
    trustedOrigins.add(url.origin)
    openSite(window, new URL(url.origin))
  })
  ipc.handle('recording:save', (event, key, json) => {
    assertMainPage(event, isTrusted)
    return recordings.save(key, json)
  })
  ipc.handle('recording:list', (event) => {
    assertMainPage(event, isTrusted)
    return recordings.list()
  })
  ipc.handle('recording:delete', (event, key) => {
    assertMainPage(event, isTrusted)
    return recordings.delete(key)
  })
}

function showMainWindow() {
  if (!mainWindow) {
    const window = new BrowserWindow({
      title: 'Tempo Ride',
      width: 490,
      height: 330,
      minWidth: 400,
      minHeight: 300,
      autoHideMenuBar: true,
      backgroundColor: '#0B0F15',
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
    window.loadFile(START_FILE).catch(() => {})
  }

  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
  return mainWindow
}

async function openLink(value) {
  const window = showMainWindow()
  const url = parseRideLink(value)
  if (!url) {
    await dialog.showMessageBox(window, {
      type: 'warning',
      message: 'Tempo Ride could not open this link.',
      detail: 'Open the ride again from the Tempo website.'
    })
    return
  }

  if (!isTrusted(url.href)) {
    const { response } = await dialog.showMessageBox(window, {
      type: 'question',
      message: `Trust ${url.origin}?`,
      detail: 'This site can ask to connect to Bluetooth devices and can access your local ride backups.',
      buttons: ['Cancel', 'Trust and open'],
      defaultId: 0,
      cancelId: 0,
      noLink: true
    })
    if (response !== 1 || window.isDestroyed()) return
    saveSettings({ ...settings, origins: [...settings.origins, url.origin] })
    trustedOrigins.add(url.origin)
  }

  openSite(window, url)
}

function findLink(argv) {
  return argv.find((argument) => argument.toLowerCase().startsWith(LINK_PREFIX))
}

function start() {
  let startupLink = findLink(process.argv)

  function enqueueLink(link) {
    pendingLink = pendingLink.then(() => openLink(link)).catch((error) => {
      dialog.showErrorBox('Tempo Ride', error.message)
    })
  }

  app.on('open-url', (event, url) => {
    event.preventDefault()
    if (!settings) startupLink = url
    else enqueueLink(url)
  })
  app.on('second-instance', (_event, argv) => {
    const link = findLink(argv)
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

  if (process.defaultApp) {
    app.setAsDefaultProtocolClient(SCHEME, process.execPath, [app.getAppPath()])
  } else {
    app.setAsDefaultProtocolClient(SCHEME)
  }

  app.whenReady().then(() => {
    const userData = app.getPath('userData')
    settingsPath = path.join(userData, 'settings.json')
    settings = readSettings()
    if (settings.site) trustedOrigins.add(settings.site)
    for (const origin of settings.origins) trustedOrigins.add(origin)
    recordings = createRecordingStore(path.join(userData, 'recordings'))
    if (startupLink) enqueueLink(startupLink)
    else showMainWindow()
  }).catch((error) => {
    dialog.showErrorBox('Tempo Ride', error.message)
    app.quit()
  })
}

app.setName('Tempo Ride')
if (app.requestSingleInstanceLock()) start()
else app.quit()
