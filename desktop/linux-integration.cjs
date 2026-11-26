const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { execFile } = require('node:child_process')

const MIME_TYPE = 'x-scheme-handler/tempo-ride'
const DESKTOP_NAME = 'tempo-ride.desktop'

/** Desktop entry for an AppImage; Exec stays unquoted when safe because xdg-open's generic handler cannot parse quoted paths. */
function desktopEntry(appImagePath) {
  const exec = /^[A-Za-z0-9/._+-]+$/.test(appImagePath)
    ? appImagePath
    : `"${appImagePath.replace(/[\\"`$]/g, '\\$&').replace(/%/g, '%%')}"`
  return [
    '[Desktop Entry]',
    'Type=Application',
    'Name=TempoBuilder Ride',
    'Comment=Desktop companion for TempoBuilder indoor bike workouts',
    `Exec=${exec} %u`,
    'Icon=tempo-ride',
    'Terminal=false',
    'StartupWMClass=tempo-ride',
    'Categories=Science;Sports;',
    `MimeType=${MIME_TYPE};`,
    ''
  ].join('\n')
}

function run(command, args) {
  return new Promise((resolve) => execFile(command, args, { timeout: 10000 }, () => resolve()))
}

/** When running as an AppImage, register (or re-point) the tempo-ride:// handler for this user. */
async function registerAppImage({ appImagePath = process.env.APPIMAGE, iconPath, home = os.homedir(), runCommand = run } = {}) {
  if (!appImagePath) return false
  const applications = path.join(home, '.local', 'share', 'applications')
  const desktopFile = path.join(applications, DESKTOP_NAME)
  const entry = desktopEntry(appImagePath)
  let current = null
  try { current = fs.readFileSync(desktopFile, 'utf8') } catch {}
  if (current === entry) return false

  fs.mkdirSync(applications, { recursive: true })
  fs.writeFileSync(`${desktopFile}.tmp`, entry)
  fs.renameSync(`${desktopFile}.tmp`, desktopFile)
  if (iconPath && fs.existsSync(iconPath)) {
    const icons = path.join(home, '.local', 'share', 'icons', 'hicolor', '512x512', 'apps')
    fs.mkdirSync(icons, { recursive: true })
    fs.copyFileSync(iconPath, path.join(icons, 'tempo-ride.png'))
  }
  await runCommand('update-desktop-database', [applications])
  await runCommand('xdg-mime', ['default', DESKTOP_NAME, MIME_TYPE])
  return true
}

module.exports = { desktopEntry, registerAppImage }
