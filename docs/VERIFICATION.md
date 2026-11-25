# Verification and release acceptance

Methods live here; actual results and open gates belong in
[CURRENT-STATUS.md](agent-workspace/CURRENT-STATUS.md). Owners and boundaries
belong in [ARCHITECTURE.md](../ARCHITECTURE.md). Mock/preview fixtures establish
component behavior, not authenticated persistence or live provider delivery.

## Automated checks

Run smallest relevant checks during iteration. Use `pnpm typecheck` for
Prisma generation, Next route type generation and TypeScript together.
`pnpm check:deadcode` checks files, dependencies and import resolution; full
`pnpm exec knip` also exposes unused exports for review. The config explicitly
includes operational scripts, standalone acceptance checks and the UI fixture
so string-loaded entrypoints are not mistaken for dead code.

`pnpm test:db` loads `.env` when present and enables the full default suite's
PostgreSQL cases. It accepts `TEMPO_TEST_DATABASE_URL`, or derives the disposable
`tempo_acceptance` database from a local `DATABASE_URL`. It refuses remote hosts,
other ports and explicit non-disposable database names before running tests;
it never starts, resets or seeds a database. Database tests create/drop isolated
schemas and require local PostgreSQL on port 55432. `pnpm test` remains available
without a database, with persistence cases explicitly skipped. Before finishing behavior changes
run `pnpm test`, `pnpm lint` and `pnpm build` when allowed by the environment.
The build **deploys migrations**: confirm the target database first.
`pnpm exec next build --webpack` is a bundle-only check and must be labeled that
way. See [operations](OPERATIONS.md) for dependency preflight and DLL locks.
Prose-only edits need reference/source checks and `git diff --check`, not a
migration-bearing build or application tests.

A whole test file can fail at `1:1` with only `'test failed'` and no failed
subtests. Rerun with `--test-reporter=tap`. If it shows `signal: 'SIGKILL'`, the
environment killed the process; no test failed. Inside agent sessions on the
maintainer's T3 host, busy test process trees are sometimes SIGKILLed: about 2
in 10 `pnpm test` runs, more with parallel suites. The same suites pass from a
standalone systemd service. Rerun and record the rerun. Do not lower the test
concurrency to hide it.

Use an isolated disposable **PostgreSQL** database with current migrations for
persistence, missing-record, rollback, uniqueness and concurrency checks.
Historical SQLite evidence does not certify current PostgreSQL behavior;
permissive mocks and source regex checks alone cannot prove transactional behavior.

`tests/postgres-recovery.acceptance.ts` is an explicit integration check, outside
the unit-test glob. It requires the disposable local database named
`tempo_acceptance` on port 55432 and rejects other targets. Apply current
migrations there, set DATABASE_URL/DIRECT_URL for that process, then run
`node --experimental-strip-types --test tests/postgres-recovery.acceptance.ts`.
It creates/cleans its own synthetic accounts and covers concurrent creation,
stale edit claims, rollback after block removal, Profile conflicts
and session-version revocation. Never point it at a real account database.

`tests/postgres-deletion.acceptance.ts` uses the same disposable-only guard.
Run explicitly with `node --experimental-strip-types --test
tests/postgres-deletion.acceptance.ts`. It verifies credential/provider/webhook
erasure, anonymized share preservation, unshare ownership, recipient history,
durable attempt throttling, stale sessions, Google proof expiry, provider outage,
transaction rollback and simultaneous deletion. Live Google/Strava callbacks
require separate acceptance; do not delete a real account to verify this flow.

`tests/http-deletion.acceptance.ts` additionally requires a local production
server at `http://localhost:3100` with the same disposable DATABASE_URL/DIRECT_URL
and AUTH_URL/NEXTAUTH_URL set to that origin. It creates its own account and
checks actual credentials sign-in cookies, cross-site rejection, password
confirmation, public deleted-owner rendering, session revocation and removal
of the export endpoint. Run using Node's experimental strip-types test mode.

## Accounts and evidence

A dedicated local Athlete account was used on the configured Neon branch.
If present, its credentials are in gitignored
`.opencode/visual-test-account.local.md`; never copy them into tracked docs.
On another machine create a disposable personal account through signup.
Confirm the database is appropriate for test data; do not seed/reset an existing
branch to gain access. Record created data and restore review-only preferences.

Record dates, commands, actual outcomes, routes, themes, viewports, data source
and limitations. Distinguish authenticated routes, synthetic fixtures,
user-reported production behavior and live integrations. Screenshots support
interaction/persistence checks; they do not replace them.

## Athlete Workouts

Check at 390px and 1440px with local Athlete accounts with and without saved
workouts. Verify the default tab, arrow-key selection, explicit tab URLs, browser
Back, and Training plans access from the mobile drawer. Search and filter the Public
library, then reload and check the selected tab and filters. Open a filtered
legacy `/athlete/library` URL and verify it redirects to the same catalog results.
Check that a catalog card opens its detail and that Schedule opens Calendar
placement. From a detail opened through Workouts, Back returns to Public library.

Open **Customize** from a card and a detail page. Check the title, sport, notes,
blocks, and unsaved draft status. Close a clean draft and confirm the owned
workout count stays the same. Edit a new draft, reload, and restore it. Verify the
restored draft takes precedence over the initial catalog values. Save a
customized workout and confirm the owned workout API created exactly one row.
Check the `edit` URL, close the editor to Public library, and delete the test
workout.

## Personal MVP journey

1. Sign up without seed data or a coach. Verify login/logout, refresh, validation,
   network recovery and role setup where applicable.
2. Create/save/reopen a workout. A 300-second block repeated four times shows
   1,200 seconds. Exercise add, reorder, duplicate, remove, targets, pauses,
   undo/redo, failure draft retention and explicit save feedback.
3. Schedule multiple dates in Calendar; check week/month views after reload. Edit and
   cross-week reschedule personal work without requiring Assignment lineage.
4. Customize a built-in plan and compose saved and public workouts in Training
   plans. Apply one complete week or whole month, preview the actual dated sessions, preserve within-day order,
   and leave empty weekdays untouched. Refuse old block-template input and
   retired public/coach template paths. Verify snapshots after source deletion,
   owner isolation, relative targets, replay and rollback with
   `tests/postgres-template-routines.acceptance.ts` on the guarded disposable DB.
   For migration acceptance, first apply migrations through template_routines
   only to a fresh disposable database, then run
   `tests/postgres-template-cleanup.acceptance.ts` alone: it creates old-format
   fixtures, deploys the cleanup migration and verifies retained sessions/outcomes.
   Run routine acceptance after cleanup, not concurrently with it. Start a local
   production server against this DB on port 3106 and run
   `tests/http-template-routines.acceptance.ts` for authenticated API saves,
   page reload, assignment/replay, old-path refusal and template deletion.
   These integration files remain outside the default unit-test glob.
   With a fresh Athlete account, preview a built-in triathlon week in Training
   plans. Apply Triathlon Build with one optional recovery workout, a swim-set
   alternative and the long ride. Check the selected duration, empty rest day,
   dated workouts and Calendar reload. The PostgreSQL case in
   `tests/built-in-training-plans.test.ts` checks plan version, week boundaries,
   option validation, snapshot lineage and an idempotent retry.
5. Follow Live: start, pause, previous, next, skip, restart, final zero and
   explicit completion. Live does not collect device/sensor telemetry.
6. Complete, correct actuals, compare Planned/Actual and reopen History after
   refresh/sign-in. Preserve the first planned baseline; never fabricate a
   missing legacy baseline from current blocks or mutable library content.
7. Verify batch rollback, same-key replay/concurrency, different-payload key
   rejection and cross-user isolation with the actual database.
8. Exercise failure/retry/removal and shared coach regressions; another user's
   content must remain inaccessible to unauthorized reads and mutations.

## Integration acceptance

| Area | Required checks |
|---|---|
| Guided creator | Keyless fallback, live model validation/source labels, invalid response, authenticated desktop/phone save/reopen, provider-health migration |
| Files | FIT/TCX/GPX parsing/errors, duplicates, matching/standalone import, measurements, removal restoring planned work |
| Strava | HTTPS challenge/OAuth return, live webhook, leased retry/recovery, updates/privacy/delete/deauthorization, duplicate-safe explicit import |
| Strava inbox | Visit/explicit refresh arrival, newest-first Needs review/All activities, discard/restore beyond provider recent page, matching/standalone, failure draft retention, dialog keyboard/Escape; no shell polling or automatic arrival dialog |
| Sharing | Public workout previews, sanitization, long content, explicit authenticated intake and unauthorized mutation rejection |
| Auth | Configured recovery email delivery, expiry/single use/session invalidation and optional Google OAuth |

## Responsive and accessibility acceptance

Check actual routes in both themes at desktop, 768px and 320–430px. Include
empty/populated/long content, expanded tables, overflow, 200% zoom/text scaling,
keyboard/focus, names/labels, landmarks, contrast, reduced motion and non-color
feedback. Shell checks include drawer focus return/containment, Escape, inert
content, scroll lock, resize/history cleanup and desktop menu/theme persistence.

Phone navigation groups Home, Calendar, Workouts (Training plans), and
History (Import). Verify date handoff, week strip/sticky placement, tap-first
editing, History filters and pinned Profile save state. Check coach navigation
against existing role boundaries after shared changes.

Physical iOS Safari and Android Chrome checks include portrait/landscape,
safe areas/browser chrome, keyboard/autofill/file picking, one-handed reach,
Live sleep/lock/resume, VoiceOver/TalkBack, and maximum supported imports on a
representative lower-memory phone. Desktop emulation does not close those gates.
Developer `/design/*` comparisons are outside MVP acceptance unless promoted.

## Imported workout analysis acceptance

Unit acceptance: variable-duration repeated efforts, genuine 53-second efforts,
continuous/no-data results, missing spans and measurable stops, lap validation,
source eligibility and malformed model output. Verify pooled covered work time
and distance, not an average of per-repetition pace values or recovery-inclusive
pace. Existing parser and provider tests remain relevant.

On the disposable PostgreSQL database described above (127.0.0.1:55432,
tempo_acceptance), run tests/postgres-activity-analysis.acceptance.ts with pnpm exec
node --test --experimental-strip-types. It refuses other database targets and
checks atomic enqueue/rollback, ownership, duplicate/concurrent requests,
corrections, stale leases, exhausted attempts, matched-plan preservation,
in-flight deletion and account cascade. Run tests/http-activity-analysis.acceptance.ts
with the same command against a production local server at localhost:3100 and
ACTIVITY_ANALYSIS_WORKER_SECRET=disposable-analysis-worker; it exercises authenticated
import/request/read/correction and source/owner/worker refusal. These tests create
and remove synthetic accounts. Disable live model keys for deterministic acceptance.

Browser acceptance covers eligible opt-in and explicit Analyze, pending/result,
pooled pace and proportional blocks, evidence expansion, correction save/reload,
unknown zones and both themes on desktop and narrow viewports. Full keyboard,
assistive technology, physical-device, independent real-file segmentation,
live-provider and scheduled production worker acceptance are separate gates.
