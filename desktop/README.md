# Tempo Ride

Tempo Ride opens the Tempo indoor ride page in Electron. The website runs the
workout and talks to your trainer, heart-rate strap, and cadence sensor through
Web Bluetooth.

## Install and open a ride

1. Download the installer from the repository's GitHub Releases. On Windows,
   run `Tempo-Ride-Windows-Setup.exe` (x64). On macOS, open
   `Tempo-Ride-macOS-arm64.dmg` for Apple silicon or `Tempo-Ride-macOS-x64.dmg`
   for Intel, then drag Tempo Ride to Applications. On Linux (x64), install
   `Tempo-Ride-Linux.deb` using your package manager or use the AppImage
   instructions below.
2. Open Tempo Ride. Enter your Tempo site URL, then select **Open Tempo** to
   remember that site and open it in the app.
3. On the Tempo website, open a scheduled indoor ride and choose the desktop
   launch link. Approve the browser prompt to open Tempo Ride. If Tempo Ride
   asks **Trust <origin>?**, check that it shows your Tempo site before accepting.
4. Use the controls on the ride page to connect your trainer and sensors. Pick
   each device in the Bluetooth dialog and follow any pairing prompts.

The Windows installer is unsigned. If SmartScreen appears for an installer you
trust, select **More info** and **Run anyway** when available. The macOS build
uses an ad hoc signature and has no Apple notarization. If Gatekeeper stops an
app you trust, right-click **Tempo Ride** in Finder and choose **Open** on macOS
versions that offer the override there. On current macOS versions, attempt to
open it, then choose **Open Anyway** in **System Settings → Privacy & Security**.
See [Apple's Gatekeeper instructions](https://support.apple.com/en-us/102445).

### Linux AppImage

From a repository checkout, run the install script with the downloaded file.
The script also accepts a local build at `desktop/dist/Tempo-Ride-Linux.AppImage`
when you omit the argument.

```sh
desktop/scripts/install-linux.sh ~/Downloads/Tempo-Ride-Linux.AppImage
xdg-mime query default x-scheme-handler/tempo-ride
```

The installer copies the executable to `~/Applications/Tempo-Ride.AppImage`,
adds the icon and launcher under `${XDG_DATA_HOME:-$HOME/.local/share}`, and
registers `tempo-ride.desktop` for ride links. Linux Bluetooth requires BlueZ
running with an enabled Bluetooth adapter. Tempo Ride enables Chromium's Web
Bluetooth feature on Linux. The picker suggests device types from their names.

## Run from source

Use Node.js 24 or later and pnpm 10.26.0. Run commands from `desktop/` so pnpm
uses the desktop lockfile.

```sh
pnpm install --frozen-lockfile
TEMPO_URL=https://tempo.example pnpm dev
```

In PowerShell, set `$env:TEMPO_URL = 'https://tempo.example'`, then run
`pnpm dev`. `TEMPO_URL` trusts the given origin for that app process and
prefills the start page unless a site is already saved. Launching without a ride
link opens the start page with the last saved address. For a local Tempo
instance, select **Use http://localhost:3000**, then **Open Tempo**. Chromium
requires HTTPS or a trustworthy local development origin such as localhost for
Web Bluetooth.

For a command-line deep-link check, run `pnpm dev 'tempo-ride://open?url=…'`
with the encoded URL. macOS needs a packaged app for the OS-level protocol
handoff. On Linux, the installed launcher passes ride links on the command
line. An already running copy receives the link through Electron's
single-instance handoff.

## Build installers

Run `pnpm test` from `desktop/`. On Windows, run `pnpm dist:win` for the
NSIS installer. On macOS, run `pnpm dist:mac` for both DMGs. On Linux x64, run
`pnpm dist:linux` for the AppImage and Debian package. Debian packaging needs
`dpkg-deb` and the builder's bundled Ruby needs `libcrypt.so.1`. Find the
installers in `desktop/dist/`. The icon source is `build/icon.svg`. The
1024 px PNG feeds the Windows and macOS builders, and `build/icons/` provides
the Linux sizes.

To release a build, set the version in `desktop/package.json` and push a matching
tag such as `desktop-v0.1.0`. The workflow tests all three platforms and
publishes all five installers to a stable GitHub Release marked as latest.

## Launch from the website

Use a user-initiated link. Build the ride URL on the same origin as the site
and encode the whole URL once.

```js
const ride = new URL(`/athlete/ride/${encodeURIComponent(sessionId)}`, location.origin)
launchLink.href = `tempo-ride://open?url=${encodeURIComponent(ride.href)}`
```

The app remembers trusted origins in `settings.json` in Electron's user data
folder. It sends links to other HTTP(S) origins to the system browser. The ride
page can detect the shell with `window.tempoDesktop?.isDesktop` and read its
`version`. Use `saveRecording(key, json)`, `listRecordings()`, and
`deleteRecording(key)` for crash recovery. Each save takes up to 20 MiB of
UTF-8 JSON. The ride page uses `tempo:ride:v1:<sessionId>` as its checkpoint key.
The store also accepts 1–120 character keys made of letters, digits,
underscores and hyphens. Backups stay in the app's `recordings/` folder.
Trusted Tempo origins share access to that folder.
