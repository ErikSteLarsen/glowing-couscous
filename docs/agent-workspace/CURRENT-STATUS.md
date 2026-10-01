# Current status

Updated 2026-10-01. Current evidence snapshot, not implementation history.
Latest checks cover saved-workout routines, shared UI polish, calendar refinement and service regressions.
Older browser/provider/device results
retain their recorded scope.

## Saved-workout training routines, 2026-10-01

- Templates has one model: Monday–Sunday routines composed solely from saved,
  owner-scoped workouts, with name/purpose, multi-weekday additions, ordered
  sessions and removal. Week/month application previews actual dated sessions;
  empty weekdays leave the calendar untouched. Relative references, decimal
  targets, repetition and skip state survive independent copies and replay.
- Removed old block-template storage, sport/cadence fields, block-template
  adapters, coach template page/APIs/assignment, workout-editor template loading,
  public template sharing/intake and obsolete planner preview routes/components.
  Sharing individual workouts and coach workout/training-plan assignment remain.
  Demo seeding creates saved workouts and an actual weekly routine.
- Routine saves capture server-owned workout snapshots. Library changes/deletion
  do not alter routines or scheduled copies. Saving again captures current
  library versions; unavailable workouts require replacements. Deleting a routine
  preserves scheduled sessions. Multi-week progression and curated/public routine
  distribution remain future capabilities; relative references provide the
  basis for each recipient's Profile targets without copying profile values.
- `pnpm test`: 311/311 pass; `pnpm lint`: pass. `pnpm build --webpack`: pass,
  all ten migrations current on disposable PostgreSQL, production TypeScript
  and route compilation complete. A first build overlapped tests loading Prisma
  and hit a Windows DLL lock; generation and build passed after tests ended.
  Existing Next.js middleware deprecation remains.
- Disposable PostgreSQL migration acceptance passed: old definitions/blocks and
  both attached/detached template shares removed, valid routine retained,
  completed calendar session/blocks and Activity content preserved. Routine
  acceptance passed for ownership, snapshots, duplication, source deletion,
  week/month expansion, replay, partial-range refusal, rollback and deletion.
  Six account-deletion integration checks passed after the share schema change;
  updated demo seed passed on the disposable DB only.
- Authenticated HTTP acceptance passed against the local production build:
  credentials sign-in, workout/routine POSTs, Templates/Calendar reload,
  five-session placement and replay, old-format/input/public/coach route refusal,
  and template deletion retaining scheduled copies. This verifies authenticated
  routes and rendered page data, not browser interactions or physical phones.
- Both new migrations were successfully deployed to the configured Neon
  `neondb` database. Old template definitions and their share links are deleted;
  no demo seed or synthetic acceptance ran there. Application code is updated in
  this worktree; no Git push or hosted application deployment was performed.
- Earlier actual-component browser evidence: 1440px light library/editor,
  390px dark editing/light month preview and 320px dark editing; weekday additions,
  reordering, preview and failed-save draft retention inspected with no narrow
  horizontal overflow. Remaining gates: authenticated browser interactions and
  physical phones, curated distribution and successive-week progression.
  Local test server and disposable PostgreSQL container removed after checks.
  Existing unrelated worktree changes preserved.

## Shared controls and personal surface polish, 2026-10-01

- Preferences now uses the shared Surface and section heading with open,
  separated rows. Toggle thumbs use theme-aware contrasting ink and retain
  their width beside wrapping descriptions. History uses shared rounded icon
  buttons; shared segmented choices have 44px mobile targets. Mobile library
  tabs use sentence case, hover feedback and explicit keyboard focus.
- Actual component previews reviewed Home, empty Workouts/Templates, populated
  History, empty Import, Profile and Preferences at desktop/mobile sizes.
  Changed Preferences and History were confirmed in light/dark previews;
  320px History and 390px Preferences had no horizontal overflow. Preferences
  also passed the 768px overflow check. History previous/next, empty-period
  recovery and sport filtering worked; library keyboard focus was visible.
  Screenshots and detector output are in the chat's local visualization folder.
- These are synthetic component checks, not authenticated route, persistence,
  full-state, physical-device or production acceptance. Initial local sign-in
  could not reach the database; a subsequent sign-in was stopped by automatic
  approval review pending explicit test-account authorization. No account data
  or saved preferences were changed. Temporary preview source/process removed.
- Tests passed 314/314; lint passed. Migration-bearing build generated Prisma,
  then failed against an intentionally unavailable localhost review database;
  the configured database was not migrated. Bundle-only webpack build passed,
  including TypeScript and all 80 pages. The first bundle attempt found stale dev
  types for the removed fixture; those generated types were cleaned.
  Detector findings were advisory incumbent type-scale drift. No global
  design-system drift repair or unrelated Calendar edit was made. Final
  git diff --check passed. Middleware deprecation remains.

## Calendar spacing, compact month and day selection, 2026-10-01

- Personal Calendar uses stable cell padding and subtle selected borders.
  Today has a small text label and neutral plane, with no full-cell outline.
  Month cells preview one session plus an additional count; wide browsing
  puts month totals and the selected-day agenda in a 280px right rail.
  Narrow calendars retain counts and details below the date grid.
- Select days exposes multi-date selection before opening scheduling, with
  selected count, clear/cancel and a batch Add action. Selected dates carry
  into the existing composer. Template choice retains exact cadence ranges.
  Source-copy ownership, request identities and scheduling services are unchanged.
- Actual TrainingCalendar/PageShell synthetic fixture: 1440px week/month in
  both themes, 390px light month/composer/week and 320px dark month inspected.
  No horizontal overflow at 390/320px. Three-date handoff, mocked save failure
  retaining all dates, same-key successful retry, keyboard day selection,
  seven-day template range, Escape and close focus return passed. Fixture
  and preview process removed. This is component evidence; authenticated
  placement/reload, live navigation and physical-device acceptance remain open.
- Final tests: 314/314; lint: pass. Migration-bearing build generated Prisma,
  then failed against the intentionally unavailable localhost review database;
  the configured database was not migrated. Bundle-only webpack build passed,
  including TypeScript and all 80 pages; middleware deprecation remains.
  The initial bundle attempt compiled but
  found leftover generated types for the removed fixture; those were cleaned.
  Detector reported advisory design-scale drift, including incumbent styles;
  unrelated global design rules were preserved. Final git diff --check passed.

## Planner and persistence architecture cleanup, 2026-09-30

- Pre-existing Calendar, training setup and deletion work was committed as
  `3e634da` and pushed to `origin/main` before cleanup. Push success is recorded;
  this round did not verify production deployment.
- Planner source/session/day contracts now belong to `lib/planner-view.ts`.
  Personal Calendar sources are restricted to workouts/templates and no longer
  import their contract from coach UI. Both planner services use the shared
  persisted-block metric adapter. Personal session and workout-library writes
  share canonical block data shaping, preserving decimal precision and omitting
  source block IDs. Account deletion exposes preparation and erasure phases;
  retention/detachment remain inside the final serializable transaction.
- `pnpm test`: 314/314; `pnpm lint`: pass; direct TypeScript: pass;
  `pnpm build --webpack`: pass, including Prisma generation, all eight migrations,
  TypeScript and 80 pages. Migrations and seven PostgreSQL acceptance tests ran
  only against a new disposable local `tempo_acceptance` database. Deletion
  rollback/concurrency, identity/throttle checks, anonymized shares, recipient
  history and recovery conflicts passed. The configured database was not used.
- The first full test run overlapped Prisma regeneration and hit a transient
  missing PrismaClient export; after generation finished all 314 passed.
  Default `pnpm build` successfully generated/migrated, then remained at Turbopack
  compilation without further output and was interrupted. The migration-bearing
  webpack build passed. Middleware deprecation remains. No browser, physical
  device or live-provider acceptance was performed for this refactor.

## Guided training targets on Home, 2026-09-30

- Home shows a restrained outlined setup section above Today when training
  targets are incomplete. Inline steps choose sports, HRmax, then the selected
  running/cycling/swimming targets. Running supports race-derived previews and
  manual bounds; cycling uses FTP and swimming uses m:ss CSS. Sport threshold
  HR is optional. Completed selected targets hide the section; blank values
  retain a reminder and resume at the first missing step. Existing complete
  three-sport profiles do not require setup.
- Each step uses the Profile API/account service with revision protection,
  preserving existing metrics and unrelated preferences. Sport selection is
  stored separately in preferences. Validation now rejects malformed sport
  metrics and reversed/out-of-range manual pace bounds instead of silently
  normalizing them away. Failures retain entries; unsaved changes are explicit,
  with navigation/close safeguards. Colon-formatted fields use a text keyboard.
- Actual component fixture at 1440px dark/light, 390px dark/light and 320px
  light: runner and all-sport progression/completion, save failure/retry,
  completed-runner hiding, HR/race previews, manual-only completion and
  incomplete manual-bound validation passed. No horizontal overflow at 390/320px.
  Screenshots: `.impeccable/review/home-training-setup/`. Temporary fixture and
  development process were removed. These are mocked-save component checks,
  not authenticated database persistence or physical-device acceptance.
- Independent design review found one mobile keyboard mismatch; the source
  correction was scored resolved with scoped ship disposition. Detector ran
  once: advisory typography/global design-scale drift was retained, matching
  incumbent shared styling; no new design tokens were introduced. Existing
  sidecar drift was preserved. Unrelated worktree changes were preserved.
- Final `pnpm test`: 310/310; `pnpm lint`: pass; direct webpack bundle build:
  pass, TypeScript and 80 pages; `git diff --check`: pass. Standard `pnpm build`
  initially hit the preview's Prisma DLL lock; after stopping that process,
  generation passed and migration deployment stopped against an intentionally
  unavailable localhost review database. No configured database was migrated.
  Generated fixture types were removed before the successful bundle build.
  Authenticated save/reload, actual revision conflict UI and physical phone
  keyboard entry remain open; middleware deprecation persists.

## Unified personal Calendar, 2026-09-30

- Calendar now owns week/month browsing and inline scheduling. Date-specific
  Add session seeds the composer; saved workouts support multiple dates and
  templates show full day/week/month ranges before scheduling. Existing
  service-owned copies, cadence validation and retry identities remain in use.
  Unfinished sessions can be removed with confirmation; completed rows stay
  review links. Today remains distinct from selected scheduling dates.
- Desktop uses a contextual right rail; narrow layouts retain the date grid
  above the composer and a selected-day agenda. Navigation exposes one Calendar
  destination. Legacy `/athlete/planner` redirects with its date; obsolete
  personal Planner and week-scroller components were removed. Coach Planner
  and API ownership boundaries remain unchanged.
- Synthetic AppShell/PageShell fixture checked 1440px dark week/composer and
  light month, 390px dark composer/light month, and 320px light month. Multi-date
  selection, seven-day template highlighting, cross-week reference-field sync,
  failure selection retention, same-key successful retry, Escape dismissal and
  close focus return passed. No horizontal overflow at 390/320px. Independent
  review scored all three fixes resolved: count/date separation, reference date
  synchronization and persistent Today styling. Screenshots are under
  `.impeccable/review/unified-calendar/`; fixture and preview processes removed.
- Final `pnpm test`: 305/305; `pnpm lint`: pass; direct `next build --webpack`:
  pass, including TypeScript and 80 pages. Detector on the calendar client and
  `git diff --check`: pass. Standard `pnpm build` generated Prisma, then stopped
  at migrations against an intentionally unavailable localhost review database.
  No configured database was migrated. Temporary fixture type artifacts were
  removed before the successful bundle build. Middleware deprecation persists.
- Authenticated placement/removal and reload, actual week/month/history
  navigation, imported timeline coverage and physical-device acceptance remain
  open; mocked browser success does not establish database persistence. Existing
  `.impeccable/design.json` identity/token drift was reported and preserved.
  The unrelated account/recovery worktree changes were preserved.

## Shared spacing review, 2026-09-30

- Shared page gutters now match top padding; desktop headers use a 64px minimum,
  mobile headers size to content, and page groups use 24px separation. Library
  cards use 16px padding. Back controls retain inline placement with 44px mobile
  targets; centered headers reserve symmetric space around the title.
- Desktop menu controls are icon-only. Mobile removes the sticky top menu row
  and adds menu access to the existing bottom bar. Deliberate horizontal swipes
  open from the interior left-edge band and close inside the drawer; native outer
  edge, vertical scrolling, form fields and dialogs are excluded.
- Strava feedback uses one compact, content-sized frame centered in the available
  content column, with icon dismissal and consistent safe-area offsets. Sync
  errors do not stack over notices. Profile save-bar offset now matches bottom
  navigation height and releases the sidebar offset when desktop menu is hidden;
  feedback clears those actions. Profile geometry was source-reviewed only.
- Rendered shared-component fixture: desktop 1440px light/dark, mobile 390px dark
  and 320px light; no horizontal overflow. Desktop hide/show and mobile menu
  opening, Escape dismissal and focus return passed. Screenshots are under
  `.impeccable/review/spacing/`. Fixture and development config were removed.
  This is component evidence, not an authenticated route sweep. Physical swipe,
  native history gestures, populated libraries and actual notification delivery
  remain unverified; earlier authenticated route evidence predates this change.
- Final `pnpm test`: 305/305; `pnpm lint`: pass; direct webpack build: pass,
  including TypeScript and 80 pages. Layout detector and `git diff --check`: pass.
  Standard `pnpm build` generated Prisma successfully but stopped at migration
  deployment against an intentionally unavailable local review URL. The configured
  database was not migrated. Temporary fixture type artifacts initially blocked
  compilation; removing generated development types resolved it. Middleware
  deprecation remains. Existing unrelated account/recovery edits were preserved.

- Publication: UI commit `964b58f` pushed to `origin/main` on 2026-09-30.
  Production `/login` returned HTTP 200 and its CSS changed from
  `01i-t978vz812.css` to `0vm3c6awhf476.css`. The live asset contains the new
  toast dismiss rules, 64px header and 24px group gap. This confirms UI
  publication, not an authenticated production journey or physical swipe test.
  Unrelated uncommitted account-deletion work was excluded from this push.

## Latest recorded checks

| Gate | Latest recorded result | Scope / limits |
|---|---|---|
| `pnpm test` | 319/319 pass, 2026-10-01 | Routine ownership/placement/rollback plus existing planner, persistence, training setup, Home, recovery, account and deletion coverage |
| `pnpm lint` | Pass, 2026-10-01 | Full repository |
| Direct TypeScript | Pass, 2026-09-30 | Existing generated client |
| Direct `next build --webpack` | Pass, 2026-10-01 | Bundle only, TypeScript and 80 pages; middleware deprecation remains |
| `pnpm build --webpack` | Pass, 2026-10-01 | Prisma generation, nine migrations and production bundle/TypeScript on new disposable PostgreSQL; configured database was not migrated |
| PostgreSQL acceptance | 7/7 pass after architecture cleanup, 2026-09-30 | Recovery acceptance plus six deletion scenarios: owned data/provider/webhook removal, retained anonymized shares, unshare scope, recipient history, durable throttle, Google proof expiry, provider outage, rollback and concurrent deletion |
| HTTP deletion acceptance | Pass, 2026-09-30 | Local production server/disposable DB: credentials cookie, cross-site rejection, wrong password, actual deletion, retained public [deleted] preview, expired old cookie, export 404 |
| Migration status | Nine migrations, including template routines, applied only to disposable PostgreSQL | Deploy migrations with code before using the new behavior elsewhere; configured database was not changed by these checks |

Latest checks reused installed dependencies with
`pnpm_config_verify_deps_before_run=false`. Prisma generation, migration deploy
and bundle compilation are distinct gates.

## Implemented behavior

- Home separates scheduled block structure from completion-date Activity
  outcomes, including standalone imports. Recent load is proportional and
  numerically labelled, with unknown/partial load distinguished from valid
  zero. Last outcome links include date/source; empty days say Nothing scheduled.
- Workout/Profile drafts use seven-day browser recovery, independent tab
  writers, explicit Restore/Discard, malformed/expiry/size checks and unavailable
  storage navigation guards. Profile updates validate before a single revision
  claim/write. New workout identities commit with their session and replay
  without duplicates; edit conflicts preserve drafts/blocks. Sign-out clears
  this browser's account drafts. Live checkpoints restore paused within 24 hours;
  accounting for elapsed time is explicit and completion remains server-owned.
- Profile has a separate Account section: safe sign-in capability readout,
  credential recovery, Strava access/consequences, current-device sign-out and
  sign-out everywhere. Fresh logins read the current sessionVersion. Downloads
  and their API/service were removed at the user's request.
- Account deletion requires current password or signed Google callback metadata
  within five minutes, with typed DELETE confirmation and durable password
  attempt throttling. Profile shows consequences/link count and owner-scoped
  Unshare all before deletion. Shared structure persists under [deleted] after
  free-text/source/creator removal; no tombstone User retains personal identity.
  Recipient sessions/outcomes survive coach deletion with coach-authored text
  and lineage removed. Independent recipient-owned copies remain theirs.
- Personal profile, owned training/outcomes, credentials/reset/request identities
  and connected provider/inbox/webhook records are removed atomically. Webhooks
  cannot enqueue without a locked live connection. Strava revocation runs after
  commit; outages do not retain tokens or block erasure and show manual provider
  revocation guidance. Other-device drafts and backups remain outside this action.
- Deletion review was inspected on the local production build with a synthetic
  account, desktop light and 390px light/dark. Public-link count, typed-confirmation
  gating and open/cancel focus passed. Mobile checks exposed footer overlap;
  Profile bottom spacing now encloses both training and Account controls, and
  final deletion/cancel buttons were verified visible above the fixed controls.
  Final UI deletion was not clicked; actual deletion was exercised through HTTP
  and PostgreSQL acceptance with disposable accounts. Live providers remain open.
- Authenticated browser acceptance used a synthetic account exclusively on
  disposable local PostgreSQL: Profile reload/restore retained unfinished pace
  input, save/reload cleared recovery; workout edit reload/restore/save passed;
  Live reload offered a checkpoint and restored paused. Home was inspected with
  synthetic planned/actual/unknown-load outcomes in desktop dark/light and 390px
  light; Account controls were inspected at 390px dark. Physical devices, quota
  guards and full multi-tab/failure UI acceptance remain open. Initial browser
  timeouts were superseded by this successful isolated run.
  Sign-out-everywhere
  confirmation hit a browser focus timeout, so UI revocation remains open even
  though the database service was verified. Temporary app processes and the
  disposable PostgreSQL container were removed; screenshot artifacts use only
  synthetic data. No configured account or provider data was changed.

- Signup creates self-coached ATHLETE accounts. Personal Workouts/Templates,
  Planner copies, Calendar, local Live, completion/correction and History form
  the core loop. Middleware redirects coach pages; the discovery page redirects in the personal
  experience; existing APIs/services retain role and ownership guards.
- Planner uses canonical repeated durations, strict cadence ranges, independent
  snapshots, atomic retry-safe batches and clear source selection. Personal
  edits do not require Assignment lineage; completion preserves the first
  planned baseline. Missing historical baselines are not fabricated.
- Shared authoring supports profile-backed HR/pace zones, target adjustments,
  repetitions/pauses, pointer/explicit ordering, undo/redo and tap-first phone
  lists. Reusable profile targets remain relative.
- Production uses Monolith, content-sized Home/Workouts, shared tokens and
  collapsible desktop/focus-managed mobile navigation. DESIGN.md owns the rules.
- File/Strava imports explicitly create standalone outcomes or match unfinished
  sessions. Measurements follow plan context; unmatched imports use recorded
  outcome layout. Removal restores matched plans. Live collects no telemetry.
- Guided drafts validate bounded model output and aggregate completed history,
  use cached provider health and standard-pattern fallback, and remain unsaved
  until reviewed and saved.
- Strava notifications read the local inbox on entry, every 15 visible seconds
  and on focus. Review later acknowledges; dismissal is recoverable. More than
  two arrivals open a selectable list that stays as the batch shrinks. Users can
  bulk add standalone sessions or dismiss, and individually edit/match. Bulk
  imports show progress and stop on failure with remaining selections preserved. All
  unimported rows remain on Import beyond the recent 100-activity provider page;
  provider updates preserve review state. Webhooks use two-minute leases,
  30-second-to-one-hour backoff, owner-only recovery and a secret-authenticated
  background worker. No retention deletion was added.

## Recorded browser and integration evidence

| Date | Evidence | Limits |
|---|---|---|
| 2026-09-30 | Strava components in mock fixture at 1440/390px, both themes: matching/standalone, discard restore, failure draft, periodic arrival, keyboard/Escape and reload passed. `.impeccable/review/strava-notifications/` | Fixture session warnings; no authenticated login/live delivery/real DB concurrency; fixture removed |
| 2026-09-30 | Strava batch mock fixture at 1440/390px, both themes: 30-row list, matching, preserved drafts, bulk standalone import, partial failure/retry, bulk dismiss, list at two remaining, Escape, live threshold transition and keyboard/overflow passed. `.impeccable/review/strava-batch/` | Mocked APIs, no live Strava delivery; fixture removed. Finish reviewer: ship; no material fixes |
| 2026-09-30 | Shell/sidebar fixture at 1440/1024/768/390/320px: width recovery, desktop persistence, drawer focus/dismissal, inert/scroll/resize/history cleanup, blocked storage and themes passed. `.impeccable/review/collapsible-menu/` | Component interactions, not authenticated journey; fixture removed |
| 2026-09-30 | Authenticated Home, Workouts, Planner, Templates, Calendar, History, Import, Profile, Preferences and completed detail at 1440/390px in both themes: 40 checks without horizontal overflow. `.impeccable/review/sizing-depth/` | Sparse data; populated Today/long lists, active editing/Live, import errors, coach/device acceptance unverified; preferences restored |
| 2026-09-29 | Fresh signup, empty routes at 1440/390px, saved 45-minute run, dated copy, three-block Live completion, reopened 45-minute/32-TSS outcome; Athlete `/coach` redirect | Partial themes/states; coach/import errors/assistive technology not verified; ignored local credentials |
| 2026-09-27 | Synthetic phone Planner/History and unsaved tap-edited draft at 320/390px; desktop Planner 1280px; auth screens and HTTP validation | No saved fixture data; native keyboard/devices/import profiling unverified |
| 2026-09-25 | Authenticated desktop target presets, fine adjustments, zone crossing/reset, session HR mode, inheritance and pause | Specific mobile target adjustment flow unverified |
| 2026-09-18 | Fresh create/plan/edit/reschedule/complete/correct/compare/reload journey; exact ranges, empty tabs, pointer/undo/reduced motion; DB replay/concurrency/rollback | Earlier UI and SQLite; does not certify current PostgreSQL |

Earlier task recorded user confirmation of deployed Strava OAuth/manual import.
That is user-reported evidence, not a fresh provider check by this cleanup.

## Strava production publication

On 2026-09-30, implementation commit `251df37` was pushed to `origin/main` after
284/284 tests, full lint, direct webpack bundle/TypeScript (76 pages), and diff
checks passed. The independently published documentation consolidation was
preserved. Standard `pnpm build` still hit the local Windows Prisma DLL lock
before migrations; the running local preview was not stopped.

Production at `https://glowing-couscous-delta.vercel.app` now serves the new
`/api/strava/inbox` endpoint: HTTP 401 with its expected sign-in JSON, replacing
the previous HTTP 404. `/login` returns 200. This verifies publication and the
unauthenticated guard, not an authenticated activity review. The production
webhook challenge returns 200 with the exact challenge. Read-only configured
database metadata confirms `20260930150000_strava_notifications` finished and
was not rolled back. No activity data was created, imported or deleted during
publication checks. Real Strava upload-to-popup, persisted review/matching,
scheduled retry execution and database concurrency remain acceptance gates.

Batch-review commit `eebb695` was pushed to `origin/main` after the recorded
fixture, tests, lint and direct build checks. Production's public login build
identifier changed from `px4Fm3HCkQRwQtCfjLQYa` to `GeGN8hEBlRyv3m38a-240`
after the push; login returned 200 and the inbox retained its expected 401 guard.
This confirms a new production build, not real authenticated batch acceptance.
The design reviewer and documenter approved the scoped extension. The documenter
reported pre-existing `.impeccable/design.json` drift from current Monolith
rules; global design files were preserved.

## Open gates and risks

- Imported workout interpretation has a [source-reviewed proposal](../IMPORTED-WORKOUT-ANALYSIS.md),
  dated 2026-10-01; no behavior, schema or model call changed. Strava's current
  API policy blocks the proposed API-data analysis path pending permitted scope.
  Separately review existing Strava-derived guided-AI history and retention;
  this planning pass did not audit or remediate their policy compatibility.
  Proposed first implementation uses independently supplied device files.

1. Verify remaining migrations in the intended target, including provider
   health; the Strava notification migration is confirmed in the configured
   database. The latest local Prisma generation passed against the current schema.
   Verify PostgreSQL persistence/concurrent placement and
   webhook claims without resetting existing data.
2. Configure HTTPS Strava callbacks/subscription and scheduled authenticated
   worker; verify live delivery, retry, update/privacy/delete/disconnect and
   deauthorization. Fixture inbox checks do not close live provider gates.
   The user reports webhook registration completed. A read-only production
   challenge check on 2026-09-30 against
   `https://glowing-couscous-delta.vercel.app/api/strava/webhook` now returned
   HTTP 200 with the exact challenge using the local `.env` verification token.
   The previous token mismatch is resolved and the notification implementation
   is published; see the production publication evidence above. No subscription
   or activity data was changed by the read-only challenge checks.
3. Verify guided creation with a server key and authenticated desktop/phone
   save/reopen, provider labels and fallback. No live model call recorded.
   Configure/test Resend delivery and optional Google OAuth independently.
4. Refresh public sharing, session mutations, populated saved templates/import
   errors and mobile target adjustments. Atlas, Flowline/Workbench/Trail and
   Terrain/Ribbon/Staging comparisons remain deferred developer verification,
   not personal-MVP blockers.
5. Complete iOS/Android, native keyboard/file picker, Live sleep/resume, touch,
   import performance and assistive-technology acceptance. Older axe findings
   included contrast, landmarks and template container ARIA; later token and
   landmark changes require a fresh audit rather than claiming old failures
   remain reproduced today.
6. Before broad signup, decide/complete privacy/support information, live-provider
   deletion acceptance and server-side signup abuse controls. Earlier readiness review
   recorded these missing; no launch certification is claimed.
7. Middleware-to-proxy deprecation persists. Default Turbopack compilation stalled
   during the latest cleanup; the migration-bearing webpack build passed on
   disposable PostgreSQL. The root font is bundled locally.

## Documentation maintenance

### Remaining account/recovery rollout gates, 2026-09-30

The initial source assessment has been followed by the implementation and
isolated evidence above. The full active plan remains indexed; it is not complete.

- Safe deletion is implemented and verified on disposable PostgreSQL and local
  HTTP. Live Google/Strava callbacks, physical-device acceptance and the actual
  backup/retention policy remain unverified. No real account deletion occurred.
- Operator/support identity and actual retention/backup facts remain owner
  inputs for public privacy/support. Durable signup/login abuse controls and
  verified-email lifecycle are still pending; email verification is deferred by
  the user. Downloads are also deferred.
- Deploy WorkoutSaveRequest and safe-account-deletion migrations with code. They have been
  reviewed/applied on the disposable database only; existing accounts/provider
  data and the configured database schema were not modified by these new checks.
- Home retains existing server-local date rules. An account timezone must be
  applied consistently across Calendar/Planner/History, rather than Home alone.
- Complete browser failures, multi-tab/account transitions, storage denial,
  changed/deleted-source restoration and actual sign-out-everywhere
  invalidation UI; finish physical phone sleep/wake and keyboard acceptance.


The 2026-09-30 consolidation replaced superseded reviews/histories with this
snapshot, owner index and operations/verification runbooks. Deferred gates are
retained above; task files no longer archive completed or idle work. Product,
architecture and design remain distinct contracts. Cleanup verification: relative documentation links and indexed owner paths resolve;
no references to removed reviews remain. `pnpm test` passed 284/284 and `pnpm
lint` passed on 2026-09-30 with installed dependencies reused. `git diff --check`
passed after line-ending cleanup. No build, migration, browser or provider check
was performed for this documentation-only change.

## Imported running workout interpretation, 2026-10-01

- Implemented opted-in independent running file analysis with TCX/FIT lap
  preservation, telemetry v1/v2 compatibility, initial stream/lap segmentation,
  code-calculated pooled interval pace, profile-backed intensity and steady-target
  estimates. Human-duration candidates use a soft tolerance; genuine 53-second
  repetitions are preserved. Coverage, insufficient measurements and uncertainty
  remain explicit. Advanced segmentation/calibration follows implementation.
- Atomic import enqueue and one current ActivityAnalysis job/result per activity;
  separate confirmed intention, profile/input version snapshots, owned API,
  duplicate-safe manual requests, bounded retries, leases and concurrency, and
  publication guards against changed/deleted inputs and stale workers. A secret
  worker provides browser-independent processing; after() improves import latency.
  Strava sources are excluded from this pipeline and guided model history.
- Optional model selects validated candidate IDs and adds bounded explanation;
  code owns measurements/emphasis and supplies a fallback on missing/invalid
  provider output. Reuses existing provider configuration. No live model call was
  made. No raw location, identity, private notes or unrelated history in prompts.
- Session review uses shared colorful duration-proportional blocks, measured
  average effort pace, likely intended workout, estimated target, evidence table
  and separate editable intention. Saved plans and telemetry remain untouched.
  Impeccable finish review: ship, scoped to supplied screenshots/component code;
  ordinary extension documentation review preserves existing visual contracts.
  Reports and reviewed screenshots are under .impeccable/review/activity-analysis/.
- pnpm test: 316/316 pass; pnpm lint and TypeScript check: pass. pnpm build --webpack:
  pass with all eleven migrations current on disposable PostgreSQL and 69 pages
  compiled. Existing middleware deprecation warning remains.
- Disposable PostgreSQL acceptance: atomic import/rollback, duplicate/concurrent
  jobs, owner/source refusal, corrections, cooldown, stale leases/exhausted attempts,
  matched-plan preservation, in-flight deletion and account cascade passed.
  Authenticated production-build HTTP acceptance passed for import/request/read,
  correction, worker secret, owner/source refusal and rendered session access.
  Secret worker processed the synthetic import before visiting its session.
- Actual-component browser evidence: desktop light/dark, 390px and 320px narrow
  layouts; evidence expansion and correction save/reload inspected. Confirmed
  intention survived reload while measured pooled pace remained unchanged. This
  does not certify physical phones, assistive technology or every result state.
- Rollout gates: deploy 20261001150000_activity_analysis and application code,
  configure worker secret/scheduler, verify live provider and scheduled delivery,
  benchmark independent real files, and complete physical-device/accessibility
  coverage. No configured database migration, hosted deployment or live-provider
  verification was performed for this feature. Strava source permission remains
  unresolved. Initial import enqueue lacks the manual queue cap; daily model
  budgets are deferred. See ../IMPORTED-WORKOUT-ANALYSIS.md and OPERATIONS.md.

- Temporary local server, browser tab and disposable PostgreSQL container were
  removed after verification. git diff --check passes; unrelated worktree changes
  are preserved.

## Imported interpretation review and release checks, 2026-10-01

- Corrected HR integration when an interval boundary clips a sensor span; only
  the overlapping portion now contributes. Analyzer identity is intervals-v2;
  obsolete queued jobs request reanalysis with a specific version-change message.
- Varied effort durations no longer imply a uniform repetition time. The optional
  model schema restricts candidate IDs to the actual supplied list; concrete JSON
  examples, a preferred-candidate tie rule and uncertainty guidance prevent
  unsupported within-effort variation claims from segment-only input.
- Evidence shows separate pace/HR zones, flags substantial disagreement and
  labels unclassified segments accurately. The table has named keyboard focus,
  column scopes and local horizontal scrolling. Existing Monolith tokens/layout
  remain. Inspected actual component at 1440px desktop in both themes, 390px light
  and 320px dark; arrow-key table scrolling works with no page-width overflow.
  Screenshots are in .impeccable/review/activity-analysis-review/.
- pnpm test: 319/319 pass; pnpm lint: pass; pnpm build --webpack: pass, including
  production TypeScript, 69 pages and all eleven migrations on a new disposable
  PostgreSQL database. git diff --check passes. Added regression checks for clipped
  sensor integration, irregular repetitions and bounded model input/invalid output.
  No live provider call or physical-device check was made.
- User explicitly authorized pushing all current worktree changes to main,
  including earlier routine-template, calendar and shared UI work. Remote main
  matched local c005c0387ab05d589de5c3125ce192e738b802b7 before release. Vercel
  dashboard access is signed out; public production verification will follow
  publication. Worker secret/scheduler and live-model readiness are not confirmed.

- Release command now pins the verified webpack bundler. Standard pnpm build
  passes on disposable PostgreSQL (69 pages); the leased-analysis PostgreSQL
  acceptance also passed again after the review changes. No production data
  was used by these checks.

- Full release 8006c5d was pushed to origin/main. Production publication verified:
  https://glowing-couscous-delta.vercel.app/login returns 200 and its build identity
  changed from obtmG_LM8ITBJCNflxj70 to wp8qmr6l7hc2wV0ljWGci. The new
  /api/activity-analysis/worker returns 401 Unauthorized JSON and owned analysis
  /api/activity-imports/1/analysis returns its expected sign-in 401 JSON (both were
  404 before publication). This verifies publication/guards, not an authenticated
  production activity review or a live model request.
- Read-only configured Neon migration metadata confirms template routine/retirement
  migrations and 20261001150000_activity_analysis finished without rollback. The
  analysis migration completed during release delivery; no seed, synthetic account,
  or activity mutation was run in that database. Disposable DB/container and
  temporary scripts were removed. Main includes the earlier routine, calendar and
  shared UI changes, as explicitly requested. Worker scheduling, secret/provider
  configuration and physical-device/real-file acceptance remain open gates.
