# Current status

Last verified locally on **2026-11-23**. Source code and tests are authoritative.
This is the current snapshot; ownership is in [WORK-INDEX.md](WORK-INDEX.md),
contracts in [ARCHITECTURE.md](../../ARCHITECTURE.md), and repeatable checks in
[VERIFICATION.md](../VERIFICATION.md).

## Verification

- Clickable control feedback (2026-11-23). `pnpm lint`, `pnpm typecheck`,
  `pnpm test` (540 passed, 17 database cases skipped), `pnpm test:ui`
  (2 passed), and `pnpm build` passed. The build used local
  `tempo_acceptance` with no pending migrations. Chromium on the local dev
  server verified pointer and hover colors in both themes using the seeded
  Athlete account. The spot checks covered buttons, tabs, cards, navigation at
  desktop and 390px, disclosures, a native select and file picker, and SDK
  dialog, menu and switch controls. Disabled Clear filters, Save changes and
  Restart workout kept their resting colors and showed the disabled cursor.
  RideClient's FTP links and disabled Skip icon, and the SettingsClient
  disclosure, were fixed after the merge. An automated pass on the merged code
  found every visible clickable on Home, Workouts, Settings, Activity and
  Calendar with the right cursor (pointer, or not-allowed when disabled).
  Headless Chromium reports `(hover: none)`, so Tailwind `hover:` styles never
  apply there; hover checks must unwrap `@media (hover: hover)` rules or run
  headed.

- Athlete Workouts tabs (2026-11-21). `pnpm typecheck`, `pnpm lint`, and
  `pnpm test` passed (538 passed, 17 database cases skipped). `pnpm test:db`
  passed all 590 tests against the disposable local database. `pnpm build`
  passed against local `tempo_dev` with no pending migrations. Chromium at 1440px
  and 390px covered both tab defaults, keyboard selection, browser Back,
  search and filter URLs, the legacy redirect, catalog detail and schedule,
  the Ride browse link, and Templates in the mobile drawer. Customize from the
  card and detail opened a prefilled draft. Closing it clean created no row,
  recovery restored local edits over the prefill, and Save created one owned
  workout. Test workouts were deleted. The coach route still redirects
  through the existing proxy, so the coach editor itself was outside browser
  coverage.

- UI simplicity pass P1–P17 (2026-11-21): one shared **Start workout** chooser
  (`components/WorkoutStartChooser.tsx`, options in `lib/workout-start.ts`)
  replaces every direct start on Home, session detail, Library detail, Ride home
  and the Live header; per-page simplifications moved secondary actions into ⋯,
  Filters, Connections, Advanced options and More details. `pnpm typecheck`,
  `pnpm lint`, `pnpm test` (532 passed, 17 skipped) and `pnpm build` passed on the
  integrated branch. Every changed screen was browser-checked as Mara at 1440 and
  390 by its implementer, and an integrated Chromium sweep loaded all athlete
  pages and routed the chooser's Follow along to Live. Not verified: physical
  Bluetooth pairing/ERG, desktop-app handoff on each OS (simulated), and live
  Strava connect/import (no local credentials).

- Demo login on 2026-11-21 passed against the existing local `tempo_dev`
  database after its PostgreSQL container was restarted. The advertised Mara
  credentials created an Athlete session through Auth.js and `/athlete`
  returned HTTP 200. No reseeding was needed.
- Production demo login on 2026-11-21 initially returned `CredentialsSignin`.
  The advertised account was missing. The live signup endpoint created it as a
  self-coached Athlete, and an HTTP check verified the Auth.js session and
  authenticated `/athlete` response. No deployment or database seeding was needed.
- `pnpm test:db`: **455 tests passed, zero skips**, using the disposable local
  PostgreSQL database. Tests use isolated schemas and synthetic records.
- `pnpm test:ui`: **2 Chromium component checks passed**, at 390px and 1440px.
  These cover SDK switch keyboard/disabled states, comparison selection, dialog
  focus containment/return, Escape, pending deletion, error retention and retry.
- `pnpm typecheck`, `pnpm check:deadcode` and `pnpm build` passed. The latest
  production build targeted the disposable `tempo_acceptance` database.
- `pnpm lint` passes with zero warnings. Signed-out share actions use router
  navigation to login/setup; a local production Chromium check confirmed the
  login handoff keeps the share `callbackUrl` without a document reload. The
  roleless `/setup` handoff was not browser-checked. Sign-out, sign-out-everywhere
  and account deletion intentionally reload through `loadSignedOutDocument` in
  `lib/client-recovery-cleanup.ts`. The Node DEP0205 warning remains.
- Local production HTTP acceptance passed credentials sign-in, roleless setup,
  same-role retry, JWT refresh and role boundaries after the Next/Auth.js update.
  Its temporary account was deleted. No production deployment or push occurred.
- Independent reviewers checked deleted-file callers, canonical persistence,
  datasource isolation and valid JSON client/response contracts. These checks
  do not certify the full authenticated browser journey or physical devices.

### Tempo Ride desktop shell

- On 2026-11-20, the standalone desktop install, all six Node tests, JavaScript
  syntax checks, and release workflow lint passed. An unpacked Linux build
  contained the shell, preload scripts, and bundled start and Bluetooth UI.
- Repo checks passed on the same branch. `pnpm test` passed 413 tests with seven
  database cases skipped. `pnpm lint`, `pnpm check:deadcode`, and `pnpm build`
  passed. The build used a disposable local PostgreSQL database.
- The Windows cross-build reached NSIS and stopped because Wine is unavailable
  on this host. Open acceptance includes the Windows and macOS installers, tag
  release, GUI, OS-level deep links, and the ride page with physical Bluetooth
  devices.

## Current implementation

- Tempo prioritizes self-directed personal training in the Athlete workspace.
  Coach pages redirect, while coach APIs retain their own authorization.
- WorkoutBuilder is the canonical authoring interface. Duplicate unmounted
  editors, their exclusive helpers and abandoned discovery UI were removed.
  Routed design previews and the active drag-and-drop dependencies remain.
- Canonical block persistence owns writes across athlete corrections and coach
  planner/library/training plans. Legacy integer targets round consistently;
  exact decimal strings, snapshots, repetitions and skipped state survive.
- Zod schemas validate unknown JSON at seven session/plan service entry points.
  Eleven routes no longer cast arbitrary objects to typed drafts. Malformed
  shapes return 400 before database access; semantic validation and ownership
  remain service-owned. Transport schemas do not coerce or invent defaults.
- UI SDK owns settings switches, session-removal alert dialogs, comparison
  selection and Strava inbox filters, retaining Tempo's tokens and explicit
  mutation controls. See [integration guidance](../UI-SDK.md).
- Personal sessions support completion, correction, rescheduling, removal,
  Skip and Plan again with ownership/status checks. Planner supports optional
  start times and warns about repeated placement of a source on selected dates.
- Personal Templates composes saved workouts into weekly routines. Routine JSON
  owns authoring; the schema still retains legacy columns/relations restored by
  a later migration. Public links publish workout definitions. An Athlete may
  explicitly save one into their library and a one-entry Monday routine.
- The mounted Import workspace accepts recorded FIT/TCX/GPX files up to 20 MB,
  previews before saving and persists normalized measurement series and optional
  laps for review. Raw uploads and GPS coordinates are not persisted. Older
  5 MB summary-only upload endpoints remain separate compatibility paths.
- Imported running workout interpretation is implemented: opt-in file analysis,
  measured segments/pooled pace, leased processing and correction. Model output
  is bounded by calculated evidence. Strava-derived records are excluded.
- Strava OAuth/inbox/webhook recovery is optional and owner-scoped; importing
  requires explicit review. Manual activities, event links, sanitized sharing,
  Profile targets, draft recovery and account deletion retain their owners.

## Maintenance tooling and dependencies

- Next.js/ESLint config 16.4.6, Auth.js 5.0.0-beta.32, Prisma pair 6.19.3,
  React/DOM 19.3.1, Tailwind pair 4.3.5 and compatible dependency updates passed
  the checks above. Removed unused bcryptjs type stubs and autoprefixer.
- Node >=24 and the pinned pnpm version are declared. Build/test/type commands
  generate Prisma explicitly; the unreliable schema-text cache was deleted.
- `test:db` validates the local disposable target and sets all child datasource
  variables to it. Seven runner safety tests include rejected targets, secret
  redaction and explicit/derived child-environment probes.
- Knip has explicit script/acceptance/UI-fixture entrypoints. The dead-code gate
  passes files, dependencies and import resolution. Full Knip also lists unused
  exports for case-by-case review; they were not blindly removed.
- `pnpm audit` reports **no known vulnerabilities** (down from 75). A scoped
  `pnpm-workspace.yaml` override moves `@prisma/config`'s deepmerge-ts from 7.1.5
  to 8.0.2 (GHSA-ggr8-5vv4-36mx), matching Prisma 7's own pin. Config loading,
  validation, generation and the DB suite were rechecked. Remove the override
  when upgrading to Prisma 7.

- Indoor bike rides (`RIDE-001`, 2026-11-20): BLE regressions cover standard
  and legacy FTMS packets, control acknowledgements and reconnect, zero-watt
  coasting, cadence decay, and CSC wheel event rollover. The recorder uses
  Bluetooth notifications and elapsed deltas for 1 Hz samples, preserves
  fractional active time through pauses, and records gaps when the renderer
  receives no telemetry. Checkpoint tests cover v1 recovery, desktop keys,
  session matching, and three hours of recording through upload conversion.
  Uploads retain the device copy until the server confirms the planned session.
- Ride reliability verification on the shared checkout: `pnpm test` passed
  465 tests with seven database cases skipped. `pnpm test:db` passed 507 tests
  with zero skips. `pnpm lint`, `pnpm typecheck`, and `pnpm build` passed.
  The build used local disposable PostgreSQL `tempo_acceptance`.
  `pnpm --dir desktop test` passed all eight Node tests.

- Public library (`LIB-CATALOG-001`) is the read-only tab on Athlete Workouts.
  The 91 built-in bike workouts retain URL-synced filters, %FTP metrics, detailed
  profiles, Ride now, and Schedule. Customize starts an unsaved draft in the
  owned workout editor. The old library index redirects with its filters, and
  the chrome-less Ride home links to the new tab.

- Planned cycling load (2026-11-20) uses one power calculation for catalog and
  session TSS. All 91 catalog workouts match their converted session blocks.
  PostgreSQL acceptance verifies both Schedule and Ride now through session,
  planner, calendar, Ride hub, Home totals, and projected training load.
  `pnpm test` passed 473 tests with eight database cases skipped.
  `pnpm test:db` passed 516 tests with zero skips. `pnpm lint`,
  `pnpm typecheck`, and `pnpm build` passed. The build used the local
  disposable `tempo_acceptance` database.

## Shipped log (2026-11-21)

- Tempo Ride 0.2.2: remembered site, direct launch, per-origin backups (see below).
- Ride save: the finish screen and the saved Activity share one power-load
  calculation (`lib/measured-power-load.ts`), so a powered ride without heart
  rate no longer saves 0 TSS. Imports with neither power nor heart rate save
  `tss: null` (unknown, not zero). Rides upload their real finish time, and
  `completedAt` is the finish (or start + duration), so a ride across midnight
  counts on its finishing day. `pnpm test` 485 passed, 8 skipped;
  `pnpm test:db` 528 passed; lint and typecheck passed. No live ride was
  recorded against a trainer.
- Recorded outcomes keep their data: on a completed session whose outcome
  came from a recording or import (any source other than `manual-actual` or
  `manual-planned`), the completion service only updates the note. Rebuilding
  from edited blocks and "Mark planned again" return 409, and the page points to
  Import for deletion. A database regression test covers a 25-minute ride on a
  60-minute plan, and it was checked in a local browser before and after.
  `pnpm test` 486 passed; `pnpm test:db` 530 passed.
- Ride checkpoints are per user (`tempo-ride-v2-<userId>-<sessionId>`), so
  another account on the same browser or desktop app no longer sees them. Old
  v1 checkpoints appear only after `GET /api/athlete/ride-checkpoints` confirms
  that the session is the rider's own. Rides whose session was deleted, skipped
  or completed show Download backup and Discard on Ride home and on the
  "Ride unavailable" page. These orphaned rides can also be saved with **Save
  as activity**. That uploads the normal ride payload without `plannedSessionId`
  through the existing import path, which creates a completed `activity-import`
  session. The import fingerprint makes retries and double clicks return the
  same activity. Checked in a local browser: a 20-minute ride at 220 W saved
  26 TSS with its real finish time. `pnpm test` 499 passed; `pnpm test:db` 551
  passed.
- Write races: a planned edit (session adjustment and planner edit) claims the
  validated row (status, `updatedAt`, no Activity) inside its transaction and
  returns 409 if a ride or completion committed first. Ride now is serialized
  per athlete + workout + day with `pg_advisory_xact_lock`. Library Schedule
  requires a client `requestKey` stored in `PlacementRequest`, and retries
  replay the original result. No migration. Completion, actual correction and
  "Mark planned again" use the same claim, which also checks the outcome
  source. A ride attaching to a planned session claims it too.
  `tests/athlete-completion-race.test.ts` runs five DB races; four failed before
  the fix. `pnpm test` 494 passed; `pnpm test:db` 546 passed.
- Planner reads only the activity summary fields and skips the unused week
  query. Riders without FTP see the %FTP target (for example "40–50 % FTP")
  instead of "Free ride", with a link to `/profile#training-metrics`.
- Combined verification: `pnpm test` 494 passed; `pnpm test:db` 541 passed;
  lint and typecheck passed. A local browser smoke test passed: Ride now twice
  reused one session, the targets-only ride showed %FTP, the checkpoint was
  saved under the v2 key and listed on Ride home, and library Schedule returned
  201.
- Deployed and confirmed live on Vercel: e3dfe88 (ride save), 31b0120
  (recorded outcomes), 265b48c (per-user checkpoints, write races, planner,
  %FTP). The production checkpoint endpoint returns 401 when signed out. The
  demo test session made during deep-link verification was removed.
- Back navigation is unified (DESIGN.md "Back navigation"): top-level pages
  have none. Every detail page has one `BackLink`, top-left above the title,
  showing "← <Destination>". It resolves through `resolveBackTarget` in
  `lib/app-navigation.ts`, which uses an allowlisted `from=` origin or else the
  page's parent and never `router.back()`. The ride page uses the compact form.
  Checked in a local browser at 390 and 1440 px across origins and deep links.
  The coach athlete page has unit tests only, because coach routes redirect.
  `pnpm test` 505 passed.
- Calendar and Planner are one page at `/athlete/calendar`. The default shows
  the week or month with prev/Today/next, **Add workout** and a ⋯ More menu
  (Week/Month, Show load totals (off by default, cookie), Apply a routine,
  Events, Import an activity). Each session card has a ⋯ menu with Open, Move
  to… and Remove…. Add workout opens the existing placement desk
  (`?place=workout|template`) with "← Calendar" and Done. Start time is under
  Advanced. `/athlete/planner?date&source` redirects to the same state, the
  Planner nav entries are gone, and `from=planner` returns to Calendar. Routine
  apply now treats day-cadence routines as one week; before, this was rejected
  by the server on both old pages. There is still no whole-month routine
  option. Checked in a local browser at 390 and 1440 px: add, start time,
  routine, move, remove and the redirect. Drag-and-drop with mouse or touch and
  a real 409 double submit were not exercised. `pnpm test` 509 passed;
  `pnpm test:db` 561 passed.
- Add workout and Apply a routine use a short single-column flow
  (`CalendarPlacement.tsx`, rules in `lib/calendar-placement.ts`). Pick the
  workout or routine; pick when (date chip plus "Add more dates", or for
  routines One week / Whole month, the only ranges the server accepts); start
  time under Advanced; one confirm button ("Add to Tue 24 Nov", "Apply to
  December"). The athlete flow no longer uses PlannerDesk; coach still does.
  The repeated-placement warning covers the starting month and the next one.
- The desktop sidebar has only the top-right Hide menu control. The icon-rail
  collapse mode, its bottom button, the stored mode and the pre-paint script
  were removed.
- `next-env.d.ts` is untracked and gitignored, because `next dev` rewrites it;
  `pnpm typecheck` and `next build` regenerate it. A persistent local preview
  runs from the main checkout at http://localhost:3100 against `tempo_dev`
  (log in `.preview/dev.log`).
- Home is a compact overview (DESIGN.md "Home overview"). At 1440×900 the
  whole page fits without scrolling: a compact Today card with Start workout
  and Details, Coming up (next 3), This week, and three summary tiles
  (Training trends, Weekly volume, Last activity) with sparklines. Each tile
  opens `HomeSummaryDialog` with the full chart and details. The missed
  workouts row and its unused overdue query are removed. `pnpm test:db` 590
  passed.
- Workouts' two tabs share one `WorkoutCard` grid and `CollectionToolbar`;
  Activity uses the same compact cards in a responsive grid. Workout drafts
  show as an "N unsaved draft(s)" chip with a popover on the tabs row, plus an
  inline restore prompt in the editor. Drafts identical to the saved workout
  are dropped on load. Profile keeps its inline draft notice. On phones the
  drafts chip wraps below the tabs. The coach Workouts page also renders the
  new cards and was not browser-checked.
- The light theme is light: `:root[data-workspace-theme="light"]` in
  `app/globals.css` overrides every night-palette token. Checked in a local
  browser across Home (with dialog), Calendar, Workouts, Activity, Library,
  session, Templates, Events, Import, Profile, Settings and phone Home. Dark
  mode is unchanged; Ride stays dark by design.
- Tempo Ride downloads (2026-11-23): a public `/download` page detects the OS
  and recommends its installers, with install steps and the other systems below.
  It is linked from the Start workout chooser (under Open in Tempo Ride), the
  ride page's no-Bluetooth notice, the install fallback, Settings, and a
  Desktop app link in the sign-in header (hidden inside Tempo Ride, where the
  page says the app is already in use). Mid-workout links open a new tab. On a Mac,
  Chromium's `userAgentData` chip hint narrows the choice to one `.dmg`; Safari
  and Firefox show both, Apple silicon first, with a how-to-check note. Links
  are pinned to `desktop-v<RIDE_DESKTOP_VERSION>` instead of `releases/latest`,
  and a test keeps that constant equal to `desktop/package.json`. Checked in a
  local browser on Linux, simulated Intel Chrome Mac, Safari Mac, Android and
  390px phone width, plus the Settings card. The repository is private, so
  signed-out visitors still get 404 from GitHub until it is made public or
  `NEXT_PUBLIC_TEMPO_RIDE_DOWNLOAD_URL` points at public hosting.

## Remaining risks and acceptance gates

- Live Strava OAuth/delivery, retry, update/privacy/delete/deauthorization and
  provider-side account deletion need acceptance against the live provider.
- Resend password-reset email and optional Google OAuth need configured live
  acceptance. Auth.js provider-discovery outages previously redirected to its
  error page; that failure mode was not reverified after the update.
- Imported interpretation needs scheduler/live-model and full authenticated
  browser acceptance. The worker secret/schedule remains an operational gate;
  opportunistic after-response work is not guaranteed delivery.
- Before broad signup: public privacy/support information, server-side signup
  abuse controls and live-provider deletion acceptance remain open. Backup
  erasure and cross-device draft deletion are not implied by account deletion.
- Shared workout-to-routine intake uses two service saves. A failed routine save
  can leave its recipient-owned library copy; this flow is not atomic.
- "Today" and week bounds follow the browser time zone (`tempo-tz` cookie,
  `lib/user-time.ts`) on Home, Calendar, Ride home, session detail, planners,
  events and activity logging. Coach-only services and the training-load
  completion day for activities without a source offset still use the server
  zone. A first visit renders once in UTC before the cookie refresh.
- Live countdown/progress is browser-local guidance, restores paused, does not
  sync across devices and does not record sensor telemetry or auto-completion.
- Linux deep links (2026-11-20): the AppImage registers `tempo-ride://` on first
  launch and `xdg-open` launched it with a link on Hyprland; the .deb rewrites
  its desktop Exec to `/usr/bin/tempo-ride` because xdg-open cannot parse the
  quoted `/opt/Tempo Ride` path. Windows/macOS link handoff and an in-browser
  click into the installed app remain unverified.
- Ride sign-in return (2026-11-21): logged-out visits to `/athlete/ride` and
  `/athlete/ride/<id>` now go to `/login?callbackUrl=…`, and login, signup and
  setup return there, so a deep link into a signed-out desktop app still opens
  its workout. Deployed in 85fdee6 and verified on 2026-11-21 with the
  released 0.2.1 AppImage against production on Hyprland. Cold start with a
  ride link showed the trust prompt, then signed-out login with the ride
  callback, then the ride. A link sent with `xdg-open` to the already running
  app navigated to it and focused the window.
- Tempo Ride 0.2.2 (2026-11-21): the app remembers the last opened site (start
  page, or an accepted ride link). A plain launch opens its ride home directly,
  and the File menu has **Change Tempo site…**. Packaged builds prefill the
  production site and hide the localhost option. A site that fails to load
  returns to the start page with an error. Desktop ride backups are scoped per
  origin, so a localhost backup no longer appears on production. Older loose
  backups move to the saved site's folder, or to `recordings/legacy/` when no
  site is saved. A packaged AppImage was checked against production for fresh
  prefill, Open Tempo, a relaunch straight to ride home with the sign-in kept,
  the trust prompt for a new site through the running app, and the offline
  fallback. Desktop tests passed (19). The menu was not clicked by hand, and
  macOS and Windows were not run.
- Tempo Ride still needs browser and physical-device acceptance for reconnect,
  FTMS Free Ride support, wake lock, and desktop picker/deep-link behavior.
  A fully suspended renderer can recover elapsed time and sample slots, with gaps
  for telemetry that never arrived. Browser backups are keyed by session within
  an origin. Desktop backups are scoped per origin.
- Physical iOS/Android, assistive technology, complete authenticated editing
  journeys and session-correction layout at 1440px remain distinct gates.
  Component fixture viewports do not establish route layout acceptance.
- Webpack is the verified production bundler. Previous Turbopack stalls were not
  investigated in this maintenance run. The production check above covers demo
  sign-in and Athlete Home.
- The separate [account/recovery task](tasks/2026-09-30-account-recovery-home.md)
  retains its rollout/trust gates. Downloads and email verification are deferred.
