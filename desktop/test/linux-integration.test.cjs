const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { desktopEntry, registerAppImage } = require('../linux-integration.cjs')

test('writes an unquoted Exec for simple paths and quotes others', () => {
  assert.match(desktopEntry('/home/a/Applications/Tempo-Ride.AppImage'), /^Exec=\/home\/a\/Applications\/Tempo-Ride\.AppImage %u$/m)
  assert.match(desktopEntry('/home/a/My Apps/Tempo.AppImage'), /^Exec="\/home\/a\/My Apps\/Tempo\.AppImage" %u$/m)
  assert.match(desktopEntry('/x'), /^MimeType=x-scheme-handler\/tempo-ride;$/m)
})

test('registers once per AppImage path and skips outside AppImages', async () => {
  const calls = []
  const runCommand = async (...args) => { calls.push(args) }
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'tempo-ride-home-'))
  assert.equal(await registerAppImage({ appImagePath: '', home, runCommand }), false)
  assert.equal(await registerAppImage({ appImagePath: '/opt/a/Tempo.AppImage', home, runCommand }), true)
  assert.equal(await registerAppImage({ appImagePath: '/opt/a/Tempo.AppImage', home, runCommand }), false)
  assert.equal(await registerAppImage({ appImagePath: '/opt/b/Tempo.AppImage', home, runCommand }), true)
  assert.deepEqual(calls.at(-1), ['xdg-mime', ['default', 'tempo-ride.desktop', 'x-scheme-handler/tempo-ride']])
  const written = fs.readFileSync(path.join(home, '.local/share/applications/tempo-ride.desktop'), 'utf8')
  assert.match(written, /Exec=\/opt\/b\/Tempo\.AppImage %u/)
})
