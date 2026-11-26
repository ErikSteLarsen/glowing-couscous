# Wattonaut Ride

Wattonaut Ride opens the Wattonaut indoor ride page in Electron. The website runs the
workout and talks to your trainer, heart-rate strap, and cadence sensor through
Web Bluetooth.

## Install and open a ride

1. Download the installer from the repository's GitHub Releases. On Windows,
   run `Tempo-Ride-Windows-Setup.exe` (x64). On macOS, open
   `Tempo-Ride-macOS-arm64.dmg` for Apple silicon or `Tempo-Ride-macOS-x64.dmg`
   for Intel, then drag Wattonaut Ride to Applications. On Linux (x64), install
   `Tempo-Ride-Linux.deb` using your package manager or use the AppImage
   instructions below.
2. Open Wattonaut Ride. Enter your Wattonaut site URL, then select **Open Wattonaut** to
   remember that site and open it in the app.
3. On the Wattonaut website, open a scheduled indoor ride and choose the desktop
   launch link. Approve the browser prompt to open Wattonaut Ride. If Wattonaut Ride
   asks **Trust <origin>?**, check that it shows your Wattonaut site before accepting.
4. Use the controls on the ride page to connect your trainer and sensors. Pick
   each device in the Bluetooth dialog and follow any pairing prompts.

The Windows installer is unsigned. If SmartScreen appears for an installer you
trust, select **More info** and **Run anyway** when available. The macOS build
uses an ad hoc signature and has no Apple notarization. If Gatekeeper stops an
app you trust, right-click **Wattonaut Ride** in Finder and choose **Open** on macOS
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
running with an enabled Bluetooth adapter. Wattonaut Ride enables Chromium's Web
Bluetooth feature on Linux. The picker suggests device types from their names.

## Run from source

Use Node.js 24 or later and pnpm 10.26.0. Run commands from `desktop/` so pnpm
uses the desktop lockfile.

```sh
pnpm install --frozen-lockfile
WATTONAUT_URL=https://wattonaut.example pnpm dev
```

In PowerShell, set `$env:WATTONAUT_URL = 'https://wattonaut.example'`, then run
`pnpm dev`. `WATTONAUT_URL` trusts the given origin for that app process and
prefills the start page unless a site is already saved. With neither, the start
page is prefilled with the production site from `wattonautDefaultSite` in
`package.json`; that site is only trusted once you choose **Open Wattonaut**.

The last site you opened, from the start page or a ride link, is saved as the
current site. Launching without a ride link then goes straight to that site's
ride home; the start page appears only on first run. To switch sites, choose
**File → Change Wattonaut site…** (press Alt to show the hidden menu on Linux and
Windows). For a local Wattonaut instance in a source build, select
**Use http://localhost:3000**, then **Open Wattonaut**; packaged builds hide that
option. Chromium
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
`pnpm dist:linux` for the AppImage and Debian package. The bundled fpm needs
`libcrypt.so.1`; if your distro lacks it (Arch), run
`gem install --user-install fpm erb` and the build script uses that fpm instead. Find the
installers in `desktop/dist/`. The icon source is `build/icon.svg`. The
1024 px PNG feeds the Windows and macOS builders, and `build/icons/` provides
the Linux sizes.

To release a build, set the version in `desktop/package.json` and the matching
`RIDE_DESKTOP_VERSION` in `lib/ride/launch.ts` (a test fails when they differ),
commit, and push only the tag first, such as `desktop-v0.1.0`. The workflow
tests all three platforms and publishes all five installers to a stable GitHub
Release marked as latest. Push `main` after the release finishes: the website
links to that exact tag, so deploying earlier gives 404 downloads meanwhile.

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
underscores and hyphens.

Backups are scoped to the page's origin: they live in
`recordings/origins/<hex of origin>/`, and a page only lists, saves and deletes
its own origin's backups. A ride started against a local server never appears
on production, and the reverse. Backups written by 0.2.1 and earlier sit
directly in `recordings/` and record no origin. On first start, the app moves
them to the folder of the site saved in `settings.json` at that moment, which
is where they were most likely written. If no site is saved, or a file with the
same name already exists there, it moves them to `recordings/legacy/`, which no
origin lists. Recover those by hand. The app never deletes backup files during
this move.

## Bring in a YouTube video

Riders browse YouTube in their own browser, signed in there. The ride page's
**Open YouTube** button opens it, and `youtube.openBookmarkPage()` opens
`/athlete/ride/send` on the page's own origin in the system browser, where the
rider adds the **Send to Wattonaut** bookmark. When no ride tab in that browser
takes a sent video, the send window offers **Send to the Wattonaut Ride app**,
which opens `tempo-ride://video?v=<id>&t=<seconds>`. The app checks the link and
calls each `youtube.onVideo(callback)` listener on a trusted page with
`{ url, startSec }`. Once a callback returns, the preload confirms it
(`youtube:video-ack`); without that within 1.5 s the app says no ride is open.
Dropping or pasting a link on the ride screen also works.

The app has no YouTube window of its own: Google can refuse sign-in inside
embedded browsers. The only foreign page a ride may frame is the
youtube-nocookie player, and in the app the ride page loads no
YouTube script, so the rider uses the player's own controls. Versions
without `window.tempoDesktop.youtube` (0.2.2 and earlier) block that frame, so
the page offers **Open on YouTube** there instead.
