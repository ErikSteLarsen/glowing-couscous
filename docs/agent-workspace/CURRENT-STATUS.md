# Current status

Last verified locally on **2026-11-21**. Source code and tests are authoritative.
This is the current snapshot; ownership is in [WORK-INDEX.md](WORK-INDEX.md),
contracts in [ARCHITECTURE.md](../../ARCHITECTURE.md), and repeatable checks in
[VERIFICATION.md](../VERIFICATION.md).

## Verification

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

- Built-in workout library (`LIB-CATALOG-001`, 2026-11-20): code-shipped %FTP
  catalog with derived NP/IF/TSS/time-in-zone, URL-synced filters, detail pages
  and the chrome-less `/athlete/ride` home. Catalog actions copy into the
  planner (Ride now, Schedule) or the Workouts library through their existing
  owners; Ride now reuses an unridden same-day copy. A schema-contract test runs
  over the real catalog. `pnpm test` passed 465 tests with seven database cases
  skipped; `pnpm lint` and `pnpm typecheck` passed; `pnpm build` was not run.
  Local Chromium on a fresh account checked the library, filters/URL state,
  detail page, Add to my workouts, Schedule, Ride now into the ride page and
  Ride home at 390, 1440 and 1920 px.

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
  "Ride unavailable" page. Saving an orphaned ride as a standalone activity is
  not built.
- Write races: a planned edit (session adjustment and planner edit) claims the
  validated row (status, `updatedAt`, no Activity) inside its transaction and
  returns 409 if a ride or completion committed first. Ride now is serialized
  per athlete + workout + day with `pg_advisory_xact_lock`. Library Schedule
  requires a client `requestKey` stored in `PlacementRequest`, and retries
  replay the original result. No migration. Still read-then-write:
  `saveActualForSession` and `reopenSession` in the completion service.
- Planner reads only the activity summary fields and skips the unused week
  query. Riders without FTP see the %FTP target (for example "40–50 % FTP")
  instead of "Free ride", with a link to `/profile#training-metrics`.
- Combined verification: `pnpm test` 494 passed; `pnpm test:db` 541 passed;
  lint and typecheck passed. A local browser smoke test passed: Ride now twice
  reused one session, the targets-only ride showed %FTP, the checkpoint was
  saved under the v2 key and listed on Ride home, and library Schedule returned
  201.

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
