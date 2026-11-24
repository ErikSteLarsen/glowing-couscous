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
prefills the start page unless a site is already saved. With neither, the start
page is prefilled with the production site from `tempoDefaultSite` in
`package.json`; that site is only trusted once you choose **Open Tempo**.

The last site you opened, from the start page or a ride link, is saved as the
current site. Launching without a ride link then goes straight to that site's
ride home; the start page appears only on first run. To switch sites, choose
**File → Change Tempo site…** (press Alt to show the hidden menu on Linux and
Windows). For a local Tempo instance in a source build, select
**Use http://localhost:3000**, then **Open Tempo**; packaged builds hide that
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

## Pick a video on YouTube

The ride page can open a separate **YouTube** window on the real
https://www.youtube.com with `window.tempoDesktop.youtube.open()`, so the rider
browses their own home feed, subscriptions and search. Calling it again brings
back the same window. When the rider opens a video there (a `/watch?v=`,
`/shorts/` or `/live/` page, including YouTube's in-page navigation), Tempo
Ride reads the player position, pauses YouTube and calls each
`youtube.onVideo(callback)` listener once with `{ url, startSec }`. The `url`
is always the canonical `https://www.youtube.com/watch?v=<id>`, whatever page
it came from, and `startSec` is whole seconds (the player position, else the
link's `t`, else 0). `onVideo` returns a function that removes the listener.
Once a callback has returned, the preload confirms it to the app
(`youtube:video-ack`, accepted only from the trusted Tempo page's main frame);
only then does the app mute and hide the YouTube window and focus the ride
window. Without that confirmation within 1.5 s (no ride open, no listener, a
callback that throws) the YouTube window stays as it is, its video may play
again, and Tempo does not take focus. Only the latest pick can complete:
moving to another page or video, reopening or closing the window cancels a
hand-off still in progress. Opening the window again unmutes it and lets its
video play. Only a trusted Tempo page can open the window or receive videos.

The window stays on YouTube and Google sign-in (`accounts.google.com`,
`accounts.youtube.com`, the consent pages and country `accounts.google.*`
hosts). Other links and pop-ups open in the system browser, but only when
YouTube's own top-level page started them: navigations from other frames (ads)
and pop-ups whose referrer is not a YouTube page are dropped. The window has
no access to Tempo Ride: it runs sandboxed without the app bridge, grants only
fullscreen and YouTube's copy-link clipboard write, and only to its own page on
a YouTube origin, denies everything else (camera, microphone, location,
notifications, devices, downloads), and sends a desktop Chrome user agent
without the Electron token.

Signing in may not work. Google can refuse sign-in in embedded browsers and
show its "This browser or app may not be secure" page
(`accounts.google.com/v3/signin/rejected`, older `…/signin/rejected`). The app
does nothing special there; the window stays open and YouTube keeps working
signed out. In the app, the ride's YouTube panel says so: "Can't sign in
here? Use Open YouTube in your browser and paste the link." A link copied
from YouTube in any browser can be pasted on the ride screen.

Privacy: YouTube runs in its own persistent session (`persist:youtube` in
Electron's user data folder), separate from the Tempo session. You stay signed
in between launches. Tempo never reads the YouTube account, cookies or
history; it only sees the video you open. To sign out, use YouTube's own
account menu → **Sign out** in that window.
