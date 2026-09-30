# Current Status

## Main publication verification — 2026-09-30

Current content-sizing/theme-depth and collapsible-menu changes were rechecked
before publication: `pnpm test` passed 273/273, `pnpm lint` passed, and direct
`node node_modules/next/dist/bin/next build --webpack` passed TypeScript and all
75 static pages. The existing middleware deprecation warning remains.
`pnpm_config_verify_deps_before_run=false` reused installed dependencies.
`pnpm build` failed at Prisma generation with the existing Windows engine-DLL
EPERM lock, before migrations; loopback database overrides prevented access
to the configured database during that attempt. No new browser or production
verification was performed. Existing visual evidence and coverage limits below
remain applicable.

## Collapsible workspace menu — 2026-09-30

The shared authenticated shell exposes Hide menu on desktop and a sticky
top-left Show menu control when navigation is hidden. Collapsing releases the
entire 228px sidebar column. The browser saves this choice across navigation
and reloads; storage failures retain the choice for the current session.
Mobile retains the four-destination bottom bar and focus-managed drawer,
independently of the desktop preference. Dismissal supports the close control,
overlay, Escape, and navigation. Route/history changes and desktop resizing
close the drawer, release body scroll lock and inert content, and recover
focus when a breakpoint hides the focused control. Menu controls use 44px
targets, semantic theme colors, safe-area padding, and reduced-motion support.
The mobile navigation no longer overrides the shared dark-mode muted color.

- Actual `AppShell`/`AppSidebar` components were checked in a temporary local
  browser fixture at 1440, 1024, 768, 390, and 320px. Desktop width recovery,
  client navigation/reload persistence, drawer focus containment and return,
  Escape/overlay/close/link dismissal, inert content, scroll locking, resize
  cleanup, sticky recovery, browser-history dismissal, blocked storage, and
  both themes passed. No horizontal overflow or browser page errors occurred.
  Light/dark screenshots are in `.impeccable/review/collapsible-menu/`.
  The temporary fixture was removed before the final build.
- `pnpm test`: 273/273 pass. `pnpm lint`: pass. Direct
  `node node_modules/next/dist/bin/next build --webpack`: pass, including
  TypeScript and 75 static pages; existing middleware deprecation warning.
  `git diff --check`: pass. The bundled pnpm required
  `pnpm_config_verify_deps_before_run=false` to reuse the installed dependencies
  rather than attempt an unsolicited reinstall.
- `pnpm build` was attempted and failed with Windows EPERM replacing Prisma's
  engine DLL, before migration deployment. Authenticated browser verification
  was attempted but login failed because the configured Neon database was
  unreachable. No database data or authentication rules were changed.
- Impeccable's mechanical detector ran over the changed shell/sidebar/CSS;
  it reported existing typography/radius advisories in the scanned files.
  No unrelated design-system cleanup was undertaken.
- Coverage limits: authenticated route data, coach-only pages, physical touch,
  and assistive-technology behavior were not verified in this change. The shell
  fixture proves component interactions, not an authenticated training journey.

## Content sizing and tonal depth — 2026-09-30

Reviewed the latest pushed Monolith revision (`3c0ec03`, matching remote main)
with Impeccable and the authenticated local visual account. Home's fixed
620px Today panel and 360px scrolling week were the largest density mismatch.
Today now follows its content (about 222px for the verified empty state), the
complete week ledger grows naturally (about 445px for the verified week), and
optional readouts leave no reserved grid slots when disabled. Session titles
wrap above their duration/state and retain a 44px link target. Sparse trend
bars are capped at 48px rather than stretching one activity across the panel.

Home and Workouts now use shared page gutters. Workout library columns fit
the available panel width with a preferred 280px minimum. Planner scrolls only
long desktop source results, keeping search/creation controls and selected-day
details outside that scrolling region. Preferences has an explicit 640px
measure; Profile retains its existing 860px form width. Calendar, History,
Templates, Import, and session detail retain their existing content measures.

Shared light/dark tokens separate canvas, work panels, Today, and fields, with
a subtle inset edge highlight. Ordinary rows retain their border-based depth;
no repeated floating-card shadows or new accent roles were introduced.

- Authenticated browser checks at 1440×900 and 390×844 covered Home, Workouts,
  Planner, Templates, Calendar, History, Import, Profile, Preferences, and the
  existing completed session detail in both themes. All 40 production-bundle
  route/theme/viewport checks had no horizontal overflow. Home was checked
  with all optional readouts enabled and disabled. The test account's original
  disabled overview preferences were restored; no workout/session data was
  created or removed. Screenshots are in `.impeccable/review/sizing-depth/`.
- `pnpm test`: 273/273 pass. `pnpm lint`: pass. TypeScript and
  `pnpm exec next build --webpack`: pass, 75 static pages. The existing
  middleware deprecation warning remains. `git diff --check`: pass.
- `pnpm build` was attempted and blocked by Windows EPERM while Prisma tried
  to replace the engine DLL held by the existing preview. It stopped before
  migration deployment. The separate bundle build reused the current client.
- Impeccable's scoped layout detector returned no findings.
- Coverage limits: populated Today, long multi-session weeks/source libraries,
  active authoring/Live, import errors, coach-only pages, physical touch, and
  assistive-technology behavior were not reverified. Mobile retains natural
  page scrolling; this review does not claim every page fits one viewport.

## Monolith Cobalt rollout - accepted ship (2026-09-29)

The authenticated workspace now uses Monolith Cobalt in light and dark themes.
Shared semantic tokens cover Home, Workouts, Templates, Planner, Calendar,
session detail and Live, History and Import, Profile and Settings, and coach
surfaces. The selected Home/Workouts composition is in `app/monolith.css`;
theme tokens and shared control roles are in `app/globals.css`. The old Focus
and actual-page comparisons, their palettes, and production query-selector
branches were removed. Older workout/planning developer experiments are
separate and cannot select a production theme.

A disposable Athlete account was created through normal signup on the configured
Neon branch. Its credentials are in the gitignored
`.opencode/visual-test-account.local.md`; future-agent instructions are in
`VISUAL-VERIFICATION.md`. No database seed or reset was run.

Authenticated local headless Chrome opened Home, Workouts, Planner, Calendar,
History, Templates, Import, Profile, and Settings. It captured empty states at
1440px and 390px, switched to light theme and retained that preference across
routes, then generated and saved a 45-minute running workout, placed a dated
copy in Planner, finished three live blocks, and reopened the saved 45-minute,
32-TSS outcome in History and session detail. After preview cleanup it captured
populated Workouts at 1440px and Home at 390px. An Athlete visit to `/coach`
redirected back to `/athlete`.

The user explicitly accepted the remaining coverage limits for this release:
authorized coach pages, import errors, assistive technology, and every route in
both themes were not visually verified. The desktop browser integration was
disconnected; the authenticated check used local Chrome DevTools Protocol.
Do not claim those untested states passed.

| Gate | Result |
|---|---|
| `pnpm test` | Pass, 273/273. |
| `pnpm lint` and direct `tsc --noEmit` | Pass. |
| Direct `next build --webpack` | Pass, 75 static pages; existing middleware warning. |
| `pnpm build` | Not run because it deploys migrations to configured Neon first. |
| `git diff --check` | Pass. |

Historical notes below describe earlier snapshots and are not the current
route inventory or acceptance gate.

## Guided Workout Creator — 2026-09-29

The Athlete Workouts library offers a four-choice guided creator for running,
biking, and swimming: duration (30, 45, 60, or 75 minutes), effort (easy,
steady, or hard), and intervals (yes or no). The server summarizes only the
signed-in user's completed activities from the preceding 28 days. When a
configured OpenAI Responses or compatible Chat Completions provider is healthy,
the model authors the entire title, summary, explanation, and ordered workout
blocks. Server validation requires the requested sport and exact duration,
valid block order, active interval recovery when requested, bounded zone time,
and gentler limits for sparse same-sport history or recent high RPE. Targets
come from the user's profile and are applied server-side; raw profile values
are not sent to the model. A missing provider, failed health check, timeout, or
invalid model draft uses a deterministic standard pattern. The form shows
cached AI availability, and the editor labels the actual source of each draft.
Every draft is private and unsaved until explicitly saved to the library.

Provider health uses one database row and a short claim lease across app
instances. A successful minimal model probe is reused for 15 minutes; a failed
probe or invalid generation is cached as unavailable for two minutes. The
model receives choice values and aggregate history, never identity, notes, raw
telemetry, or profile values. No live provider request was run because no AI
key is configured in this environment. No authenticated browser session was
used to inspect the form visually. Coach library behavior is preserved.

| Gate | Result |
|---|---|
| Guided creator tests | Pass, 18/18 focused tests, including all 72 standard input combinations, original model blocks, invalid-output rejection, custom Chat Completions, Responses structured output, and concurrent shared health cache. |
| Full source tests | Pass, 272/272 via direct Node script. |
| ESLint | Changed workout files pass. Full lint reports one `react-hooks/set-state-in-effect` error in a separate, uncommitted `components/AppShell.tsx` edit that appeared during this work; that file is not in this change. |
| TypeScript | Pass via direct `tsc --noEmit`. |
| Prisma schema | Pass via `prisma validate`. New additive `AiProviderHealth` migration has not been applied in this environment. |
| Production build | Pass via direct `next build --webpack`, including TypeScript and all 75 static pages. The repo's `pnpm build` script was not run because it first deploys migrations to the configured database. |
| UI detector | The previous guided form passed; the new availability copy has not been checked visually in an authenticated browser. |
| Browser/API integration | Not verified with an authenticated account or a live OpenAI key. |

Remaining release gate for this capability: configure a server model key if
AI-authored workouts are desired, apply the additive migration in the target
environment, and verify an authenticated desktop/phone draft flow with a live
provider, including save and reopen. The keyless validated creator works now.

## Calendar Week Density and Mobile Day Navigation — 2026-09-28

The Athlete Calendar week view now lays out day columns according to the
available width. Day stacks expand with their session lists and use more space
between rows. Phones show only the selected day, with previous/next controls
and the selected date kept in the URL. Calendar week/month rows and Planner's
compact date preview share a rounded, duration-weighted average-zone swatch
before the session title; pause segments are excluded. Week rows retain their
session details and recorded heart-rate timeline.

| Gate | Result |
|---|---|
| Source tests | Pass, 254/254 using `node --experimental-strip-types --test tests/*.test.mjs tests/*.test.ts`. The `pnpm test` wrapper stopped during its dependency preflight with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY`. |
| ESLint | Pass using `node node_modules/eslint/bin/eslint.js .` and targeted lint on the changed files. The `pnpm lint` wrapper stopped at the same dependency preflight. |
| TypeScript | `tsc --noEmit` reports three generated Prisma Client mismatches in `auth.ts` and `lib/password-reset-service.ts`; it reported no errors in the changed files. |
| Impeccable detector | Ran once. It reported advisory typography and radius findings in shared styles and the existing Calendar heading. |
| Browser/device view | Not verified: an unauthenticated request to the local Calendar redirected to sign-in, and no account or session was used. |
| Production build | Not run because the `pnpm build` script runs `prisma migrate deploy` against the configured database before building. |

## Import Activity Dialog Width — 2026-09-27

The Strava activity details dialog keeps long metadata and measurement values
inside its available width. Its sticky footer aligns within the dialog, and
expanded interval tables use fixed proportional columns, wrap long values, and
scroll vertically without a horizontal scroll area. The Impeccable detector,
targeted ESLint, and `git diff --check` pass.
The production build could not finish because this environment could not fetch
Schibsted Grotesk from Google Fonts; browser/device rendering and tests were not
run.

## First-Run and Production Readiness Review — 2026-09-27

The production route and copy review found a coherent self-directed path:
sign up, complete personal setup, create a reusable workout, place it in
Planner, follow it in Live, then review it in History. Existing page purposes
are distinct enough to keep the current structure: Home is the starting and
progress overview; Workouts is the reusable library and editor; Planner places
saved workouts and templates on dates; Calendar browses scheduled work by date;
Templates stores reusable multi-session structures; Live guides the current
session; History reviews completed work and opens imports; Profile owns training
metrics and zones; Preferences configures the Home overview. Sharing remains a
read-only view of a saved snapshot. Coach routes remain secondary to the
personal workflow. The mobile Plan / Workouts / History groupings already match
these jobs; no broad route move was warranted.

Small first-run fixes improve signup purpose and password guidance, browser
autofill, recoverable network errors in signup/login/setup, and consistency of
the desktop History label with mobile navigation. Signup also rejects a blank
display name and returns the normal duplicate-email response if concurrent
requests race. Workout target and editor
instructions explain effort levels and time/target entry in direct terms. Home,
Workouts, Profile, Settings, History, and Templates now define their jobs and
clarify training metrics. Preferences shows only the Home-card controls that
users can change; static Units and Notifications notes have been removed. No
route move was needed.

Credentials now have a short-lived, single-use password recovery flow with
generic responses, per-account request limits, and session invalidation after a
reset. Shared error and not-found screens provide a way to recover from
unexpected failures and missing routes. Production migration
`20260927150000_password_reset` has been applied; a follow-up Prisma status
check confirms all four migrations are up to date. Password recovery still
requires a Resend API key, verified sender, and HTTPS `AUTH_URL` before email
delivery can work.

| Gate | Result | Evidence |
|---|---|---|
| Source tests | Pass, 254/254 | `node --experimental-strip-types --test tests/*.test.mjs tests/*.test.ts` |
| ESLint | Pass | `node node_modules/eslint/bin/eslint.js .` |
| Strict TypeScript | Pass | All sources and tests type-check using a temporary Prisma Client generated from the current schema; workspace DLL replacement is blocked by the running dev server. |
| Prisma schema | Pass | `prisma validate --schema prisma/schema.prisma` |
| Impeccable detector | Advisory only | One scan of changed UI TSX returned two non-blocking type-ramp findings on existing Home metrics (22px and 10px); no blockers. |
| Independent critique | Not run | This review used direct source and route review, the browser, automated checks, and the Impeccable detector. |
| Browser visual check | Partial | Local `/signup`, `/login`, `/forgot-password`, valid-token and missing-token `/reset-password`, and 404 checked at desktop size; signup and missing-token reset checked at 320×780. No authenticated account was available for the complete personal-workflow journey. |
| Local HTTP smoke | Pass | Public auth pages return 200, protected `/athlete` redirects to sign-in, unknown route returns 404, and invalid signup/reset requests return 400. No email was sent. |
| `pnpm test` / `pnpm lint` | Blocked before scripts ran | pnpm attempted a dependency install and aborted with `ERR_PNPM_ABORTED_REMOVE_MODULES_DIR_NO_TTY` |
| Production build | Limited pass | An isolated Webpack build compiled all routes after the Google font import was replaced by a system-font fallback in the temporary copy. An unmodified build stopped because this environment denies network access to Google Fonts; this does not verify the production font build. |
| Production migration status | Pass | Applied `20260927150000_password_reset`; follow-up `prisma migrate status` reports all four migrations applied. |
| `pnpm build` | Not run | Build was not run in this database update; migration was applied and verified separately. |
| Device acceptance | Partial | Auth screens checked at 320×780; previous Planner/History phone review remains the authenticated responsive evidence. No physical touch/device run was performed in this pass. |

Remaining release checks are provider setup and delivery, authenticated
first-run journey checks against a connected database, and a build environment
that can fetch the configured Google font. There is no in-app privacy/support
information or account-deletion flow, and public signup has no server-side
abuse limit; decide and complete those launch controls before opening signups
widely. The local authenticated journey was not run because no test account or
session was available and no account or data was created for this review.

Before this review added the password-reset migration, a read-only Prisma query
through the pooled `DATABASE_URL` succeeded and `prisma migrate status`
reported the three then-existing migrations applied. On 2026-09-27, at the
user's request, the new migration was applied successfully; the follow-up
read-only status check confirms all four migrations are applied. The migration
adds password-reset storage and a session-version field; no other application
records were modified. The restarted development server returned HTTP 200 for
`/login` during the earlier review.

On **2026-09-27**, phone-only usability work is implemented across the shared
shell, Calendar/Planner, workout editor/libraries, and Activity History.
Athlete mobile navigation is Home, Plan, Workouts, and History; coach mobile
links remain role-owned. Calendar carries its selected date into Planner, whose
week strip has 44px date targets, scrolls the current date into view, and keeps
a compact selected-workout action available while scrolling. Workout editing
uses a tap-first ordered block list on phones, while desktop keeps its chart.
History keeps the complete feed and desktop table while adding three compact
phone metrics, sport/filter disclosures, and a populated-history Import action.
Muted text and frequent controls were adjusted below 768px; global tokens,
services, data behavior, routes, and desktop output remain unchanged.

The authenticated visual pass covered a synthetic Planner and populated
History at 320×780 and 390×844, plus the Planner at 1280×900. The selected day
and compact sticky action were visible at 320px, and the 1280px view retained
the desktop sidebar and month layout. Temporary fixtures were removed and no
review record or assignment was saved. The configured Neon database was
unreachable during the final preview, so connected-data assignment, saved
library, and populated production-route checks remain open, along with physical
iOS/Android, native keyboard/safe-area, assistive-technology, and import
performance checks.

Verification: **249/249 tests pass**, full ESLint passes, and a full production
Next.js build passes using Webpack and a loopback-only database URL. No
migration or database write ran. Next’s existing Google font was fetched for
the successful build; the build reports existing `jose` Edge Runtime warnings
and the middleware deprecation notice. `pnpm test`/`pnpm lint` could not pass
their noninteractive dependency-install preflight, so equivalent commands ran
directly with the installed Node executables. `git diff --check` passes. See
[MOBILE-READINESS-REVIEW.md](MOBILE-READINESS-REVIEW.md) for the route inventory,
implemented phone adjustments, and remaining acceptance gates.

On **2026-09-27**, Athlete Calendar session rows use a shorter stacked layout
for multiple sessions per day; month cells preview up to two single-line titles
and a remaining count. Imported week rows keep `Avg HR` visible while the
two-minute label is removed from the visual summary; it describes each chart
bin's duration and remains in the chart's accessible label and interval
tooltips. Calendar-row hover and focus retain the border/surface highlight
without the animated leading stripe. `git diff --check` passes. The Impeccable
detector reported advisory typography and radius findings in shared styling.
Tests, lint, build, and authenticated browser rendering were not run in this
turn.

On **2026-09-27**, Completed work now covers the full history with week/month
navigation, a sport filter, and date/sport ordering. The period summary breaks
out completed sessions, total time, and recorded distance for running,
swimming, biking, strength, and any additional sports in the history. App
completions and file/Strava imports use the same summary; a matched import
remains one activity and shows both its imported title and planned session.
Outcome details and plan/actual comparison remain available from each row.
`git diff --check` and targeted ESLint pass. `pnpm lint` stopped in its
noninteractive dependency preflight; direct TypeScript checking reports
pre-existing fixture/type errors under `tests/`, with none reported in the
changed production files. Tests, build, and browser rendering were not run.

On **2026-09-27**, the Workouts library uses the 1080px measure without an
enclosing `Surface`. Compact workout cards form a responsive grid, reaching
three columns at 900px of content width. Create workout now sits beside its
description at wider sizes and stacks below it on narrow screens. The count
moved beside search and updates to show filtered results against the total.
Completed work now uses an open three-metric summary and separated history
rows; Activity notes remain inline. Planner selection now uses a persistent
tinted cell and inset frame, while today remains marked on its numeral.
`DESIGN.md` records the visual rules. `pnpm test` passes (248 tests), full
`eslint .` passes, and `pnpm build` passes in an isolated clean checkout
containing these changes. The configured database has three migrations and an
up-to-date schema. In the active checkout, Prisma regeneration cannot replace
the Windows query-engine DLL held by the running local server; the isolated
build completes the full script. Next.js reports its existing middleware
deprecation warning. The populated workout grid, populated Activity rows, and
mobile render were not visually verified.

On **2026-09-27**, the route-by-route mobile readiness review was expanded into
a specific proposed implementation plan. It recommends four athlete mobile
destinations (Home, Plan, Workouts, History), a day-agenda-first planning flow,
touch-first workout editing, task-focused session/live screens, and clear
secondary locations for templates, imports, metrics, account settings, and
coach work. The plan now explicitly scopes visual and interaction changes to
phone layouts: desktop navigation, page hierarchy, editor canvas, global color
tokens, control sizes, and default service behavior must remain unchanged.
Mobile-only History pagination may add service support while preserving the
existing desktop result. It specifies per-route phone adjustments, work
packages, and device acceptance criteria while preserving desktop behavior and
existing routes. The focused Impeccable detector returned 11 advisory
type-ramp findings and no blockers. Source review confirmed muted-text contrast
below 4.5:1 and a roughly 35px Planner date target at 320px. Populated mobile
routes, Import, sharing, and physical touch behavior still need fresh
verification. This is a proposal only: no UI code or runtime tests changed. See
[MOBILE-READINESS-REVIEW.md](MOBILE-READINESS-REVIEW.md).

On **2026-09-26**, the activity workspace is labeled **Import** and lives at
`/athlete/import`; the former `/athlete/imported-activities` route redirects to
it, and Strava OAuth returns to the new path.

On **2026-09-26**, Profile now keeps its save action in a viewport-pinned
footer above the mobile navigation and reserves scroll space beneath the form.
The footer shows unsaved, saving, saved, and error states; Save changes is
disabled until the draft differs from the last confirmed save. The targeted
diff check passes. The Impeccable detector ran and reported advisory findings
across the shared stylesheet. `pnpm lint` could not complete because local
dependencies are absent and registry requests return `EACCES`; `pnpm test` and
`pnpm build` were not run for the same reason.

On **2026-09-26**, the first Vercel deployment of the activity import and
Strava work stopped before migrations because `ensure-prisma-client.mjs` used
`require.resolve("prisma")`, which resolves Prisma's package export rather
than its CLI executable. The helper now reads the executable declared by the
installed Prisma package. The user confirmed the next Vercel deployment reached
Ready and the deployed Strava connection/manual import worked.

On **2026-09-26**, standalone imported activities without matched workouts use
a single-column detail view. It leads with recorded duration and training load,
then shows available metric charts and saved notes; plan-only context and an
inapplicable share action are omitted. `git diff --check` and the Impeccable
detector pass. Local dependencies are absent, and browser and production
rendering have not been verified.

On **2026-09-26**, pace review found that tiny positive speed samples from
stops/GPS drift were converted into extreme min/km values, inflating the
average and flattening the bars. Pace now ignores speeds below 0.5 m/s, uses a
harmonic mean of accepted pace samples, and scales bar height to the 5th–95th
percentile while the interval table keeps the accepted sample range. Node's
TypeScript syntax check, `git diff --check`, and the Impeccable detector pass.
Chart tests, a full build, and browser inspection after this change have not
been run.

On **2026-09-26**, imported sessions in the athlete week Calendar now show a
compact recorded heart-rate timeline in place of the summarized zone strip.
Minute-aligned bars expose interval shape and widen for long activities; their
color uses the saved HRmax zones when available, and intervals without samples
remain blank. The chart caps at 48 bars to fit compact calendar rows. The
calendar also uses the recorded duration for imported FIT and Strava sessions.
Session detail now exposes recorded measurement charts for both FIT and Strava
imports beneath the scheduled score and workout block list. Standalone imports
without planned blocks use an activity overview with recorded duration/load and
hide the empty plan canvas and block list; matched workouts retain their plan
score and blocks.
`git diff --check`,
Node TypeScript syntax checks for the changed service files, and the Impeccable
detector pass with no new findings; its only hits are existing type-ramp
advisories in touched files. ESLint could not run because the local dependencies
are absent and pnpm cannot reach the package registry. No authenticated browser
tab was available, so the calendar rendering and production build remain
unverified.

On **2026-09-26**, `public/tempo-sports-loop.svg` is a standalone, transparent
triathlon mark proposal: swimming, cycling, then running in a twelve-second loop.
The bicycle wheelbase is shortened from 162 to 116 SVG units; spokes and rim
marks rotate, and road speed follows wheel circumference and rotation speed.
The running gait uses articulated legs, a rearward push-off and heel recovery,
lower arm swing, and ground speed matched to the planted foot. Eight additional
running poses were visually inspected after refining the gait to remove the
high-knee marching appearance; the full GIF and a running-only preview were
regenerated. Water and ground move continuously left through repeating, edge-faded
patterns. Tempo colors, the monoline style, and a static swimmer for reduced
motion are preserved. `scripts/generate-tempo-sports.mjs` rebuilds the SVG without
dependencies and optionally renders preview frames using an existing Sharp
installation. Twelve representative poses were visually inspected from a local
300-frame render; the GIF preview uses the same poses, timing, and surface motion.
SVG XML parsing, generator execution/syntax, the Impeccable detector, and targeted
diff checks pass. ESLint is unavailable in the incomplete local dependency tree.
The SVG has not been browser-verified or integrated into signup. Application
test/build gates were not run for this standalone asset revision.

On **2026-09-26**, Strava accounts can be linked to a Tempo user through OAuth;
encrypted tokens refresh server-side. The Imported activities page lists and
reviews Strava activities, loads streams for bar previews, lets the user adjust
the Tempo category and optionally match an unfinished planned session, then
imports through the shared activity service. The webhook endpoint queues
create/update/delete, privacy, and deauthorization events, acknowledges quickly,
and processes them asynchronously. Disconnect or Strava deauthorization
removes the connection, inbox data, credentials, imported sessions, and
associated measurements while restoring matched planned sessions. Cleanup is
atomic with imports so an in-flight review cannot recreate data after
disconnect; token revocation failure is surfaced with a Strava settings link.
The review shows approved training metadata, and over-dense streams are capped
while retaining the final sample. A subscription setup script and authenticated
queue-recovery endpoint are included. The user configured production OAuth and
confirmed the deployed manual connection/import flow. Automatic webhook
subscription and event verification remain; the production migration ran in
the successful Vercel build, while a separate non-production migration check
has not been done.

Focused parser, import, chart, and pure Node checks passed in earlier runs. The
latest pace correction has syntax and diff checks only. Full local repository
verification is limited by an incomplete `node_modules` tree and inaccessible
package registry; complete import-service tests, lint, and a local production
build remain unverified. See the
[activity import task](tasks/2026-09-26-strava-activity-import.md).

On **2026-09-26**, the shared Imported activities page now accepts FIT, TCX, and
GPX files for both signed-in roles, previews available metrics with
parameter-specific bars, offers matching to an unfinished personal planned
session of the same sport, and imports to a new completed session otherwise.
Imports are owner-scoped, fingerprinted to prevent repeats, validated
server-side, and persist normalized telemetry on `Activity`; planned workout
blocks are kept intact. Heart-rate-based zone/load estimates use the saved
HRmax when available; otherwise load is explicitly unavailable across the
activity, Home, Calendar, and session views. Time charts use minute bars
(temperature uses five-minute bars); elevation and grade use distance buckets,
capped at 120 bars. Focused parser, import service, and chart tests pass
(17/17); full ESLint and `git diff --check` pass. The full suite is 233/237,
with the same four pre-existing athlete planned-session adjustment failures.
TypeScript reports existing test-fixture errors and none in the importer or
changed production files. Prisma schema validation and client generation pass.
A direct production build is blocked when Next.js cannot fetch Schibsted
Grotesk from Google Fonts. The schema migration has not been applied or
verified against a non-production database, and authenticated browser behavior
remains unverified in this environment.

On **2026-09-26**, Home, athlete Calendar week/month, and the shared athlete/coach Planning Desk mark today across the full day cell with a tinted surface, inset brand frame, and filled date marker. Hover remains a separate lighter treatment, and date selection keeps its check or focused-day state. Current dates carry `aria-current="date"` where the view exposes an individual date control. `git diff --check` passes. The Impeccable detector completed with advisory type/radius findings in the touched files. No authenticated browser tab was available, so responsive rendering was not visually verified.

On **2026-09-26**, Planner month cells in the shared athlete/coach Planning Desk show the first assigned workout title and a zone-colored swatch on one row. The swatch represents the rounded, duration-weighted average intensity zone; pause time is excluded and narrow calendars keep their count-only treatment. Selected-day details retain the full timeline. Home and week Calendar continue using compact `SessionRow` timelines, while the athlete Calendar month view remains title-only. `DESIGN.md` records this boundary. Targeted ESLint, `git diff --check`, and the confirming Impeccable detector pass with no findings; an initial 10px type-size advisory was corrected to 11px. The bundled Node test suite is 216/220, with the same four existing athlete planned-edit validation failures. The `pnpm test` wrapper stops at the noninteractive module-purge preflight, so the suite was run directly with the bundled Node runtime. Authenticated browser verification was unavailable because the local planner redirects to sign-in and no browser session is attached; build was not run while the local app server is active.

On **2026-09-26**, the live current-block timer now carries a restrained zone tint and matching horizontal rules, with a text zone label; pause blocks use a neutral recovery treatment. The countdown remains dark and legible. `git diff --check` passes. The Impeccable detector reported only the existing intentional 60px/84px timer type-size advisories. `pnpm test`, `pnpm lint`, and `pnpm build` could not start because the dependency preflight again stopped at the noninteractive module-purge prompt. This change has not been browser-verified.

On **2026-09-26**, pages and nested editing states with a clear parent now use a shared 40px icon-only back control. Page-level arrows sit inline before the title; their accessible name and hover hint identify the destination. Athlete session details preserve Home, Calendar, Activity, or Planner origin; the Planner origin now resolves correctly. Live sessions return to session details, and coach athlete details return to the roster or restore the Planner's selected athlete and date. Workout editing retains its unsaved-change confirmation, and shared-workout intake returns to its preview. The post-save live action is labeled “View session details.” Focused navigation-target tests pass 2/2 using the bundled Node runtime, and `git diff --check` passes. The Impeccable detector reported only advisory font-size findings on the existing page-heading tokens in `components/ui.tsx`. Full `pnpm test` and `pnpm lint` did not start: dependency preflight required a noninteractive refresh, and the refresh retry failed with `EPERM` while replacing the repo-local Sharp package file. That left `node_modules` incomplete, so `pnpm build` and browser verification could not run.

On **2026-09-25**, athlete session detail now presents the scheduled workout as a read-only duration/zone score and ordered block list, with a read-only saved outcome and comparison. An edit-source link appears only for the athlete's own reusable source and opens that workout directly in Workouts; scheduled copies remain independent. Live execution now has a deadline-based current-block and session countdown, auto-advance/catch-up, start/pause/resume, previous, next, skip, restart confirmation, optional screen wake lock, and an explicit completion save after the final block. Progress remains local and resets on refresh. Headless Chromium rendered the shared production components at 1440×1200 and 390×844 from a temporary synthetic review surface, and exercised countdown, pause, next, skip, previous, and restart. The independent Impeccable review returned `ship` with no material findings. The connected authenticated browser was unavailable, so the actual session routes were not browser-tested. `pnpm lint`, `pnpm build`, and `git diff --check` pass. `pnpm test` passes 214/218; the same four existing athlete planned-edit validation failures recorded below remain. The Impeccable detector reported advisory type-ramp findings; non-timer values were aligned to documented sizes, while the prominent 60px mobile / 84px desktop timer remains intentional.

On **2026-09-25**, Profile now saves backward-compatible max-HR, race-result, and five-zone running pace defaults in `User.performanceProfileJson`. HR ranges mirror the [Olympiatoppen intensity-scale calculator](https://olt-skala.nif.no/): 55–72%, 72–82%, 82–87%, 87–92%, and 92–100% HRmax, with the site's floor/+1 bpm boundaries. Running defaults are clearly identified as Tempo race-speed estimates (not OLT pace bands), editable as fastest/slowest min/km. Workout and template creators now pass the current profile for athletes and coaches; profile pace and HR target references stay relative in saved/shared content and resolve per user. The selected block shows its applicable range/current target and its accessible chart label carries the resolved value. Focused profile/target/persistence checks (22) pass, and `pnpm lint` passes. The build script now reuses Prisma Client when its generated schema matches the checked-in schema, avoiding Windows `EPERM` when a running Next server holds the query-engine DLL; it regenerates the client when missing or stale. Full `pnpm build` and direct `pnpm exec next build` pass with the existing middleware deprecation warning; Prisma reports no pending migrations. Full `pnpm test` is 210/214: the same four athlete planned-edit validation failures recorded below remain. Direct `pnpm exec tsc --noEmit` reports existing test-fixture errors, none in the changed production source. Browser review was unavailable because no desktop browser was connected.

On **2026-09-25**, editing one block's target range now opens a focused native dialog instead of expanding inside Block details. The “More block details” accordion and its exact-duration, within-block repetition, skip-toggle, and block-note controls were removed from the canvas inspector; existing stored block values remain intact. `DESIGN.md` now reflects the shorter inspector. Focused workout-layout tests (6) and full ESLint passed; `git diff --check` passed. The full suite passed 204/208, with four existing athlete planned-edit failures from the active-block validation change. Direct TypeScript checking reported existing test-fixture errors and none in the changed component. `pnpm build` stopped at Prisma generation because a running process held the Windows query-engine DLL; authenticated browser verification was unavailable. The Impeccable detector reported advisory font-size findings in existing CSS.

On **2026-09-25**, the shared workout editor now gives newly inserted effort blocks a sport-aware midpoint target from explicit Zone 1–5 bounds. Profile thresholds enable absolute watts, pace, or sport-specific heart rate; without them the editor uses relative threshold targets (or RPE for non-endurance sports). Fine adjustments and manual target edits reclassify a block when they cross a zone boundary, while selecting a zone resets its target to that zone's midpoint. Chart bars now show numeric differences within zones, and pauses sit visibly above the baseline. Session targets moved beside Sport, and Notes moved beside the title editor. An authenticated desktop browser verified preset insertion, a small within-zone adjustment, Zone 3 to Zone 4 crossing, zone reset, session-wide heart-rate mode, inheritance by a new block, and a visible pause in an unsaved draft. Mobile browser verification remains open. Eleven focused tests, focused ESLint, `git diff --check`, and the Impeccable layout detector passed. Direct full TypeScript checking still has unrelated Prisma and fixture errors, with none in changed files. Standard `pnpm test`, `pnpm lint`, and `pnpm build` stopped at the noninteractive dependency-purge prompt.

On **2026-09-25**, target controls were reorganized after browser review. The workout chart now stays focused on its timeline; the block inspector holds the current target and single- or multi-block adjustments, with exact target fields behind a disclosure. A centered native Session targets dialog holds session-wide range setup and adjustment. An authenticated desktop browser verified the dialog, an unsaved heart-rate range applied to a Zone 2 block, and a session-wide increase with in-dialog feedback. The review workout was not saved. Focused tests, focused ESLint, `git diff --check`, and the Impeccable layout detector passed; the general detector reported existing advisory type-ramp findings. Mobile rendering remains unverified. Standard `pnpm` checks continue to stop at the local dependency-purge prompt.

On **2026-09-25**, the shared workout editor gained target intensity fine-tuning for one block, selected blocks, and the whole session. It shifts existing ranges by sport-appropriate steps (power 5 W, pace 5 seconds in the faster direction, heart rate 1 bpm, relative targets 1 percentage point), skips pauses and untargeted blocks, and keeps zone labels unchanged. Session-wide setup now accepts a target type and explicit range for each used zone, including heart-rate targets for running, biking, and swimming, then applies those ranges to active blocks. This does not yet persist zone boundaries separately or clamp later fine-tuning within those boundaries. Two focused tests, focused ESLint, and `git diff --check` passed. Direct TypeScript checking had existing Prisma and fixture errors but none in changed files. Standard `pnpm test`, `pnpm lint`, and `pnpm build` stopped at the noninteractive dependency-purge prompt. Browser interaction was not verified.

On **2026-09-25**, the duration text in both pause steppers was increased from 11px to 12px after review. `git diff --check` passed. This visual adjustment was not browser verified.

On **2026-09-25**, Place a pause now uses the same five-second −/+ duration control as the selected pause inspector, replacing its slider while retaining the 5–180 second insertion range. The duration text in both controls is slightly smaller. `git diff --check` passed and the Impeccable detector returned existing advisory font-size findings only. Standard `pnpm test`, `pnpm lint`, and `pnpm build` stopped at the noninteractive dependency-purge prompt; browser interaction was not verified.

On **2026-09-25**, the selected Pause between blocks duration control uses −/+ buttons in five-second steps in place of its slider. The exact-seconds field remains available, and the buttons respect its 1–1800 second limits. `git diff --check` passed; the Impeccable detector reported only existing advisory font-size findings. Standard `pnpm test`, `pnpm lint`, and `pnpm build` stopped at the local noninteractive dependency-purge prompt. Browser interaction was not verified.

On **2026-09-25**, the chart toolbar received another Impeccable layout pass: the selected-count badge now matches the 40px square control rhythm, Multi-select keeps an explicit accessible name, and Undo/Redo move to the toolbar's left as visually quiet history controls. The command group remains on the same row as Workout chart at the narrow desktop fixture width; at 390px, history and selection share one row above block actions. A temporary production-CSS fixture was visually checked at both widths and removed. Eight focused tests, focused ESLint, `git diff --check`, and the Impeccable layout detector passed with no findings. Standard `pnpm test`, `pnpm lint`, and `pnpm build` stopped at the local noninteractive dependency-purge prompt. Authenticated editor interaction was not verified.

On **2026-09-25**, the chart controls were reorganized again so the title and toolbar occupy the same row at the production chart's narrow desktop width. The selected count is a small badge, block actions are a compact soft-surface icon group, and history uses quiet icon buttons with accessible names and tooltips. Group separator lines were removed. A production-CSS fixture was visually reviewed twice at desktop width and once at 390px, then removed. Eight focused tests, focused ESLint, `git diff --check`, and the Impeccable layout detector passed with no findings. Standard `pnpm test`, `pnpm lint`, and `pnpm build` stopped at the local noninteractive dependency-purge prompt. Authenticated editor interaction was not verified.

On **2026-09-25**, the chart toolbar now centers Select multiple and its count, selected-block actions, and Undo/Redo on one row when the chart is wide enough. Subtle rules separate the groups; at 390px they wrap into selection, a two-column action group, and history. A temporary production-CSS fixture was visually reviewed at desktop and phone widths, then removed. Eight focused tests, focused ESLint, `git diff --check`, and the Impeccable layout detector passed with no layout findings. Standard `pnpm test`, `pnpm lint`, and `pnpm build` again stopped at the local noninteractive dependency-purge prompt. Authenticated editor interaction was not verified.

On **2026-09-25**, the workout library's Create/Edit workout row now shows a warning-colored Unsaved draft or Unsaved changes status from its actual dirty state. The shared chart keeps its own draft label for non-library editors; the library hides that duplicate. Selection count, Select multiple, Undo/Redo, and selected-block actions now occupy the chart's upper-right area, with a balanced two-by-two selected-action layout on phones. The overall Build a pattern heading is gone; Pause between sets precedes the repeat stepper, and Apply repeats follows it. Two visual Impeccable layout/polish iterations used a temporary page with production CSS at desktop and 390px, then removed that page. Eight focused tests, focused ESLint, `git diff --check`, and the Impeccable detector passed; the detector reported only existing advisory font-size findings. Direct TypeScript checking reported no error in the changed components, while unrelated existing errors remain. Standard `pnpm test`, `pnpm lint`, and `pnpm build` stopped at the local noninteractive dependency-purge prompt. Authenticated editor interaction was not verified.

On **2026-09-25**, the pattern area received an Impeccable polish pass. Both columns now center their headings and controls, the repeat stepper has clear internal dividers and hover states, and the pause slider is short enough to sit beside both placement buttons at a 390px phone viewport. A temporary public fixture using the production CSS was visually checked at the default desktop width and 390px, then removed; authenticated editor interaction was not verified. Eight focused tests, focused ESLint, and `git diff --check` passed. The Impeccable detector found only pre-existing advisory font-size findings. Standard `pnpm test`, `pnpm lint`, and `pnpm build` again stopped at the local noninteractive dependency-purge prompt.

On **2026-09-25**, the pattern controls now follow the requested horizontal placement: Pause between sets sits immediately right of the repeat stepper, and the pause length slider sits left of Add before and Add after. Apply repeats moved into the repeat heading to keep the section compact. Eight focused tests, focused ESLint, the Impeccable layout detector (no findings), and `git diff --check` passed. Standard `pnpm test`, `pnpm lint`, and `pnpm build` stopped at the local noninteractive dependency-purge prompt. Authenticated browser rendering remains unverified because the documented demo login failed previously.

On **2026-09-25**, the pattern area received a compactness pass: repeat count and Apply now share a line, the pause slider fills its column, and repeated helper copy was removed. Repeat and pause remain side by side at wider editor widths and stack at narrow widths. Eight focused tests, focused ESLint, the Impeccable layout detector (no findings), and `git diff --check` passed. Standard `pnpm test`, `pnpm lint`, and `pnpm build` again stopped at the local noninteractive dependency-purge prompt. This pass was reviewed in source; authenticated browser rendering remains unverified because the documented demo login failed previously.

On **2026-09-25**, the pattern controls now place Repeat selection and Place a pause side by side when the editor container is wider than 900px, then stack them at narrower widths. Repeat selection uses labeled −/+ buttons with a bounded 1–10 set count in place of its slider; the pause length slider remains compact. Eight focused tests, focused ESLint, the Impeccable detector, and `git diff --check` passed. Standard `pnpm test`, `pnpm lint`, and `pnpm build` again stopped at the local noninteractive dependency-purge prompt. The changed layout was reviewed in source but was not visually verified in an authenticated browser because the documented demo login failed in the previous pass.

On **2026-09-25**, the shared workout editor now separates repeat and pause placement into two responsive rows. Pauses can be inserted before or after a selected effort when that side has an open interior gap, and disabled placement is explained in context. Repeated sets use the same pause length control, now stated beside the repeat controls. Eight focused tests, focused ESLint, the Impeccable detector, and `git diff --check` passed. Standard `pnpm test`, `pnpm lint`, and `pnpm build` stopped at the existing noninteractive dependency-purge prompt; direct TypeScript checking remains blocked by existing Prisma client and fixture errors. Browser verification was attempted, but the documented demo credentials were rejected by the local app, so the new layout was not visually verified in a browser.

On **2026-09-25**, the workout editor keeps Block details visible with selection guidance when no single block is active. Clicking a selected chart bar again deselects it, and selected bars use their existing border without a second focus outline. Pause bars can be dragged like other blocks; a selected pause and effort can be duplicated or repeated together, and repeated copies retain pause selection. Eight focused tests, focused ESLint, and `git diff --check` passed. Standard `pnpm test`, `pnpm lint`, and `pnpm build` stopped at the local noninteractive dependency-purge prompt. Direct TypeScript checking remains blocked by existing Prisma client and fixture errors, with no reported error in `WorkoutCanvasEditor.tsx`. Browser interaction was not verified in this pass.

On **2026-09-24**, the workout editor's repeat slider was shortened and grouped with a seconds-based pause slider, a Pause between sets option, and an Add pause after selection action. Pauses are distinct persisted blocks created only when there are surrounding workout blocks or between repeated sets; they are not palette presets and are not draggable in the chart. Pause time contributes to elapsed duration, not training load, and workout authoring, session detail, and live execution display exact seconds. An authenticated local browser verified adding a 30-second pause between two unsaved interval blocks and selecting it for seconds-based editing; the draft was not saved. Eighteen focused tests, full direct ESLint, and `git diff --check` passed. The Impeccable detector returned advisory typography findings only. Standard `pnpm test`, `pnpm lint`, and `pnpm build` stopped at the local noninteractive dependency-purge prompt. Direct full tests passed 105 of 121 with the remaining suites blocked by Prisma client access; direct production build was blocked by the same Prisma access issue and a Google Fonts fetch failure. Browser mobile layout and server persistence were not verified.

On **2026-09-24**, the shared workout editor now groups the workout name, pencil edit control, sport selector, and optional notes disclosure in a compact responsive header after initial setup. Choosing another sport when blocks exist requires an inline confirmation; confirming clears the editor blocks and sport-specific metrics while preserving the name and notes. Focused ESLint, the Impeccable detector, and `git diff --check` passed. Standard `pnpm test`, `pnpm lint`, and `pnpm build` stopped at the local noninteractive dependency-purge prompt. Direct TypeScript checking remains blocked by existing Prisma client and test fixture errors, with no reported error in `WorkoutBuilder.tsx`. Browser rendering was not verified.

On **2026-09-24**, the workout selection count and Select multiple control now form a left-side group; move, duplicate, and remove remain a right-side group on the same toolbar when space permits. The toolbar still wraps at narrower widths. The local authenticated browser showed the new grouping with one selected block in an unsaved draft. Focused layout tests, ESLint, and `git diff --check` passed. The Impeccable detector reported advisory typography findings only.

On **2026-09-24**, the workout canvas selection count, Select multiple control, and selected-block actions now share one wrapping toolbar. At the local desktop browser width, all controls fit on one row and retain 40px targets; narrower content wraps the action group without changing the controls' behavior. The review draft remained unsaved. Focused layout tests and ESLint passed; the Impeccable detector reported existing advisory typography differences only. A narrow browser viewport was not available for direct visual verification in this pass.

On **2026-09-24**, workout authoring now centers the chart and places the selected block inspector directly after the chart at medium and narrow content widths; wide content can show the inspector beside it. Empty drafts no longer show disabled repeat and selection action rows. The palette and empty chart explain both click and drag entry, and selection reveals movement, duplication, removal, and repeat controls. Movement buttons disable at sequence boundaries, block type is directly editable separately from effort, and repetitions and block notes have clearer labels. Existing skipped blocks are visibly marked and excluded from active duration; new reusable workouts hide Skip and require an active block to save. Template selection moved before detailed building, and whole-workout deletion moved away from sticky Save. The local authenticated browser verified add, block type change, undo, duplicate, and repeat in an unsaved draft. Focused layout/drop tests and full direct ESLint passed; the Impeccable detector had advisory typography findings only. Standard `pnpm test`, `pnpm lint`, and `pnpm build` stopped at the local noninteractive dependency-purge prompt. Direct full tests and production build were blocked by access denied to the installed Prisma client; the build also could not fetch Google Fonts. A fresh mobile viewport browser pass was unavailable in this session.

On **2026-09-24**, the workout library header now stacks its description above the count and Create workout action at phone widths. The production canvas uses two columns at medium desktop widths so the chart has room; the wide layout keeps its side inspector. On phones, selected block details appear directly after the chart and before repeat and reorder controls. An authenticated local browser verified these states at 390px, the default desktop width, and 1440px; the review draft was not saved. All 201 tests, full direct ESLint, direct production build, the Impeccable detector, and `git diff --check` passed when the installed dependencies were accessible. Standard `pnpm test`, `pnpm lint`, and `pnpm build` stopped at the existing noninteractive dependency-purge prompt in the restricted shell. The direct build reported only the existing middleware deprecation warning.

On **2026-09-24**, an authenticated local browser review of the workout creator at the default desktop viewport and a 390px mobile viewport verified that repetitions can be cleared, retyped as `20`, and restored to `20` after an empty blur. The test workout remained unsaved. Visual review found the production editor's three-column layout cramped at the default desktop viewport (the chart and action row narrow and the session title wraps), a squeezed description beside the Create workout action in the mobile empty library, and the mobile block inspector below the chart and repeat/action controls, leaving the chart outside the viewport while editing. These are verified improvement suggestions, not implemented changes. The browser viewport was restored after review.

On **2026-09-24**, the Impeccable design sidecar was refreshed from the current `DESIGN.md` color tokens. All 49 documented colors now have matching sidecar metadata, and future visual direction work is configured to start in code. The doctor pass reports no drift. A broad detector pass found advisory type and radius differences across production UI and design previews; it reported no blocking defect. No visual tokens or rendered styles were changed in this maintenance pass.

On **2026-09-24**, the production workout canvas block inspector allows temporary blank or invalid text while editing exact duration, repetitions, and training target bounds. Only valid values update the canonical draft; leaving an invalid field restores its last accepted number. This permits replacing `1` with `20` by backspacing without introducing zero-duration or zero-repetition blocks. Focused ESLint and the Impeccable detector passed. Standard `pnpm test`, `pnpm lint`, and `pnpm build` stopped at the existing noninteractive dependency-purge prompt; direct TypeScript checking remains blocked by existing Prisma client and test fixture errors. Browser interaction was not verified.

On **2026-09-24**, the production intensity tile's pointer-following drag copy fades to 20% opacity over the session chart, letting the block-shaped placement preview become the dominant drop cue while the tile stays connected to the pointer. Moving back outside restores the tile's normal drag opacity; the source tile stays visible in the library throughout. Reduced-motion settings remove the fade transition. This uses the same pointer-derived chart boundary as final insertion, so the visual handoff and drop location agree.

On **2026-09-24**, the production canvas now chooses insertion gaps from the pointer's horizontal position in the undisturbed duration-proportional workout, rather than treating every hovered bar as an insert-before target. The left and right halves of a bar now map to the corresponding gaps, and the same position drives the translucent placement preview and final drop. The dragged tile and chart-bar overlays are slightly more transparent so the chart remains visible. The local authenticated browser confirmed insert-before, insert-after, and chart reordering; all actions remained in an unsaved draft. Focused drop-index tests and ESLint passed.

On **2026-09-24**, the internal full-height dividers in a connected chart selection were matched to the outer selection outline at 2px and the same rendered dark tone. The local authenticated browser showed uniform border weight across the four selected blocks.

On **2026-09-24**, connected selected bars now retain one thin internal divider per block boundary. Each divider runs from the taller adjacent bar's top to the chart baseline, while the selected group keeps a single outer outline and no white gap. The authenticated local browser showed all three dividers reaching the bottom of a four-block stepped selection.

On **2026-09-24**, connected selected chart bars now form one continuous selection silhouette. Their white internal dividers and dark internal seams are removed; the outline follows only the group's outer left and right edges, top steps, and baseline, including rising and falling intensity changes. The authenticated local browser showed four adjacent selected blocks as one seamless stepped shape. Unselected bars retain their fine white separators.

On **2026-09-24**, the connected multi-selection border now follows upward steps in the intensity chart: when a selected bar is taller than the selected bar before it, the newly exposed left edge is drawn while the shared lower seam stays thin. The local authenticated browser showed this edge on a selected Z2–Z3–Z4 rising sequence.

On **2026-09-24**, adjacent selected workout-chart bars now share a single inner seam instead of stacking two 2px selection outlines. The outer selection edges remain visible. The authenticated local browser showed four connected selected bars with the slimmer seams.

On **2026-09-24**, the production workout canvas intensity palette now uses equal-height tiles with a fixed swatch and five-step effort scale, replacing the variable-height miniature bars. A dragged palette tile remains in the library while a matching tile follows the pointer. Dragging into the chart shows a translucent block-shaped placement preview instead of the tall insertion line; dragging an existing session bar also uses a pointer-following block preview while the sortable bars reposition. The local browser verified palette insertion, chart reordering, cancellation outside the chart, and the narrow layout at 390px; those actions changed only an unsaved draft. The public comparison palette received the same tile design. Eighteen focused tests, focused ESLint, and `git diff --check` passed; the Impeccable detector found advisory type-ramp differences only.

On **2026-09-24**, the intensity palette's small grip icons were removed in the production canvas and public comparison preview. The whole tile remains draggable and clickable; a grab cursor and subtle tile highlight now communicate that behavior without implying a narrow drag handle.

On **2026-09-24**, each intensity tile is now one full-surface drag target in both the production workout canvas and its public preview. The small grip icon remains a visual cue, while click-to-add is still available and a completed drag suppresses its follow-up click. In the authenticated local browser, dragging from the Z3 label added one block, dragging from the far edge of Z4 added one more, and clicking Z2 added one more; the draft showed three blocks with no duplicate insertion. Changes remained unsaved.

On **2026-09-24**, the production workout canvas was simplified to one layout: the compact Interval score chart with Block details beside it. The three layout tabs were removed from `WorkoutCanvasEditor`; all chart editing, drag, copy, repeat, duration, and advanced-detail controls remain in that one view. The public `/design/workout-canvas` comparison remains available as a design preview. The authenticated local browser showed the production editor without layout tabs, with the intensity palette, full chart, controls, and side inspector present. Eighteen focused tests, focused ESLint, and `git diff --check` passed.

On **2026-09-23**, production workout, template, and planned-session authoring adopted the full-session workout canvas through `WorkoutBuilder` and `WorkoutCanvasEditor`. The same canonical draft and save adapters remain in place. Five 10-minute intensity presets can be added or dragged into the duration-proportional chart. Bars support selection, group selection, chart reordering, copy, delete, earlier/later, undo/redo, and a live 1–10× repeat preview before applying. A selected block's duration slider is capped at 30 minutes; advanced details preserve exact seconds, repetitions, targets, notes, and skipped state, including existing blocks longer than 30 minutes until changed. The public preview's slider now also ends at 30 minutes. In the local authenticated browser, a new unsaved workout accepted a preset, changed to 30 minutes, showed a 4× live repeat preview, and rendered Interval score with its side inspector without overlap. Focused source tests and full direct ESLint passed. Normal `pnpm test`, `pnpm lint`, and `pnpm build` stopped at the local noninteractive dependency-purge prompt. Direct full tests and build remain blocked by access denied to the local Prisma client; direct build also could not fetch Google Fonts. No workout was saved during browser verification.

On **2026-09-23**, the `/design/workout-canvas` preview palette now offers five intensity zones, each with a 10-minute starting block and a small effort-height cue. A selected chart bar exposes a 1–60 minute duration slider; changing it redraws the width immediately. A separate 1–10× repeat slider inserts translucent copies into the chart as a live preview and updates the projected session length; Apply repeats commits those copies to the sample session. Pointer-based palette insertion now uses the actual position under the pointer, and a local browser drag placed a new Z3 block at position two. The profile and ribbon keep inline editing, while the compact score keeps its side inspector. Focused ESLint passed; the Impeccable detector returned advisory typography findings only. The standard `pnpm test`, `pnpm lint`, and `pnpm build` commands again stopped before running at the noninteractive dependency-purge prompt. This remains a non-persistent public design preview.

On **2026-09-23**, the three `/design/workout-canvas` concepts were revised from labeled cards and checkboxes into continuous, text-free workout bars. Bars share the available chart width in proportion to duration with no minimum width or horizontal scrolling; a selected bar reveals its details outside the chart. Multi-selection uses Shift-click or a toolbar mode, while bar dragging and explicit earlier/later controls remain. Profile, ribbon, and compact score use the same chart interaction but compare different density and inspector placement. Local browser checks showed all three layouts, click-to-inspect, and 34 bars fitting a 605px chart without overflow after multiplying a selection. Focused ESLint passed. Standard `pnpm test`, `pnpm lint`, and `pnpm build` again stopped at the local noninteractive dependency-purge prompt. The Impeccable detector reported advisory typography findings only.

On **2026-09-23**, `/design/workout-canvas` was added as a sample-data comparison of three interactive workout authoring layouts: Intensity profile, Session ribbon, and Session score. Each uses the visible full session as the drag and selection target, with explicit recovery blocks, multi-block copy/multiply/delete/reorder controls, and an accessible button alternative to dragging. Profile and ribbon edit the selected block below the canvas; score shows a side inspector. This is a design preview only and does not save workouts or alter production authoring. Focused ESLint passed. The normal `pnpm test`, `pnpm lint`, and `pnpm build` commands stopped at the existing noninteractive dependency-purge prompt. Direct TypeScript checking reached pre-existing Prisma client and test fixture errors; it reported no errors in the new preview files. In the local browser, the profile rendered, two blocks could be selected and multiplied into the visible session, and the score layout showed its side inspector. Mobile rendering was not checked.

On **2026-09-23**, the signed-in sidebar's decorative “Current flow / Indigo /
paper” specimen and its unused CSS were removed. The public sign-in page no
longer advertises seeded demo credentials; they remain documented for optional
local seeding in README.md. Personal navigation no longer carries unused role
and active-coach parameters through the layout, shell, sidebar, and navigation
helpers. Settings now defines metadata only for the three personal overview
cards it displays, resolving an existing build-time type mismatch while keeping
legacy `coachNote` preferences in storage. Existing role guards and coach
routes remain intact. All 199 tests passed outside the restricted sandbox,
full ESLint passed, and direct production build passed with the existing
middleware deprecation warning. The Impeccable detector found advisory-only
style findings. Browser rendering was not verified in this pass.

On **2026-09-23**, Home, Calendar week/month, and the personal and coach Planning
Desk now mark the current date directly on its numeral with a restrained ink
underline and tint. The Today badges were removed; selected Planner dates keep
their separate fill and checkmark. Date controls retain spoken today labels and
current-date semantics. Mobile month day links now have a visible “View day”
action even without sessions. Focused ESLint and the Impeccable detector passed
(detector findings were existing advisories). The full `pnpm` test, lint, and
build commands each stopped at a noninteractive dependency-purge prompt before
running. Browser rendering was not verified in this pass.

On **2026-09-23**, authenticated content widths were fitted to their tasks
inside the unchanged 1800px page frame. The initial caps were too close to the
available width at common desktop sizes, so they were tightened: Profile and
Preferences stop at 860px; the single-column workout library stops at 800px;
session detail and live execution stop at 960px; Activity and the template
library stop at 1080px. Limited content sections center horizontally within
the shared frame when there is spare width and remain fluid on narrower screens.
The unused second desktop grid column in Profile was also removed so its form
uses the full compact measure. Workout and template editors expand to the
available frame width when active, while workout basics retains its centered
46rem panel. Home, Calendar, and Planner keep their full width. Page headings,
descriptions, gutters, and header positions are unchanged. A stale local dev
server stylesheet initially omitted the centering rule despite serving the
new width caps; restarting the server corrected it. In the browser at 1280px,
the Workouts header spans 1016px from x=240 to x=1256, while the 800px library
is centered from x=348 to x=1148 with 108px on each side. Opening its editor
restores the full 1016px content width. The Impeccable layout detector reported
no findings, all six focused layout tests passed, and focused ESLint passed.
The full suite and direct build remain blocked locally by denied
reads of the installed Prisma client; the build also could not fetch the Google
Font. The normal `pnpm` commands stopped at a noninteractive dependency-purge
prompt, so direct local binaries were used for available checks.

On **2026-09-23**, a stale JWT from the previous local database could send
`/athlete` to `/login` while middleware sent `/login` back to `/athlete`,
creating a redirect loop. Middleware now leaves sign-in and sign-up reachable
even when a cookie claims an existing role, so the user can establish a fresh
session against PostgreSQL. All 199 tests and lint pass. The full build could
not complete while the active dev server held Prisma's Windows engine DLL open
during `prisma generate` (`EPERM` rename); it was not stopped for this check.

The local PostgreSQL setup was verified on **2026-09-23**. The user supplied
pooled and direct Neon URLs in the ignored `.env`. An empty leftover SQLite-era
migration directory was removed, `pnpm db:migrate` reported no pending
migrations, and a Prisma `User` count succeeded through the pooled runtime URL.
The database contains one user. No seed was run, so existing data was preserved.

On **2026-09-23**, middleware authentication was separated from the Prisma-backed
server auth setup. The Edge middleware now loads a shared JWT/session config
without importing Prisma. The reported `@prisma/client` package read failure is
specific to the restricted local sandbox: the installed file reads normally
outside it. All 199 tests and lint pass outside the sandbox, and direct Next.js
compilation succeeds. Full `pnpm build` stops before Next.js because the local
`.env` lacks `DIRECT_URL`; direct `next build` then reaches an unrelated existing
type error in `app/(app)/settings/SettingsClient.tsx` (`coachNote` is absent from
its `overviewLabels` record).

Full gate verification last recorded on **2026-09-22**. Focused Planner usability changes were reviewed on **2026-09-23**. Source and tests are the authority; this file is a short operational snapshot, not a changelog.

Checkout reconciliation was verified on **2026-09-22**. The Windows layout and
product changes were rebased onto the newer Ubuntu commit history, later Ubuntu
working-tree refinements and its live Impeccable configuration were included,
and unique changes from both checkouts were preserved. On the reconciled Windows
tree, the current test suite passes all 199 tests, lint passes, and the production build
passes with the existing middleware-to-proxy deprecation warning.

## Product

Workout Planner is a Tempo-aligned personal training planner with optional coach collaboration. The live app
supports credentials authentication, optional Google OAuth, coach and athlete
roles, Monday-based planning, structured workout blocks, reusable libraries and
templates, independent source-copy assignment, completion history, local live
execution, session outcome comparison, and sanitized workout sharing.

The first shipment now presents one personal workspace to every signed-in
account. Signup and setup do not expose a role choice; valid legacy roles enter
the same personal paths. Coach discovery, requests, roster, and coach
navigation are hidden while their stored data and implementation remain dormant
for a later collaboration release.

The current ownership split is important:

- Workouts stores reusable owner-scoped definitions without dates or assignments.
- Planner creates independent dated copies from those definitions.
- Calendar and session detail own scheduled-session context.
- Templates and training plans remain separate reusable source types.

## Current MVP Focus

Complete the self-directed workflow in PRODUCT.md: a fresh user with no coach
or seeded content can create reusable workouts/templates, schedule their own
sessions, follow and complete them, and review saved outcomes.

The personal Planning Desk, session completion, and Activity path now pass the fresh-account acceptance journey, including repeated-workout placement, rescheduling, live execution, completion, actual correction, comparison, persistence, and mobile layout. Coach-only gaps remain secondary; preserve existing coach functionality while improving shared owners.

## Design Context

The current visual contract is documented in `DESIGN.md` and verified against
`app/globals.css`, `components/ui.tsx`, `components/AppShell.tsx`,
`components/AppSidebar.tsx`, `components/tempo/*`, and `components/WorkoutBuilder.tsx`.
The canonical direction is the light, editorial, Monday-first **Ink Is Movement**
studio, translated from the user's supplied ink-flow reference.
Routes under `/design/*` remain alternate visual previews and are not production
design sources. Indigo owns forward action and active context while blue-gray
linework carries focus and flow. The comparison dialog uses the defined overlay
shadow token. The installed Impeccable launcher has no `document` command, so the
sidecar is kept synchronized manually from the canonical contract and tokens.

The focused 2026-09-22 interface pass made the personal create-to-plan loop
directly reachable on mobile, added useful empty-Home actions, converted the
narrow Home week to a horizontal channel, removed the fixed-width mobile month
canvas, hardened drawer and comparison-dialog isolation, and exposed live
completion state to assistive technology. The Impeccable detector completed
with advisory-only existing type-ramp findings. This pass did not rerun browser
acceptance; the browser gate below remains the recorded 2026-09-18 evidence.

On 2026-09-23, Planner now distinguishes an empty source library from an empty
search, links first-use athletes to creating the selected content type, and
uses pressed buttons for source filters instead of tabs without tab-key
navigation. Selected-day details move above the month grid on narrow screens,
calendar day names are included in accessible labels, and reversed template
range selection now reports chronological endpoints. The post-change
Impeccable detector returned no findings and focused ESLint passed. Browser
rendering could not be verified: Next/Turbopack was denied access to the local
`@prisma/client` package metadata, so the previously recorded browser evidence
remains the 2026-09-18 acceptance pass.

The shared workout creator now uses an explicit basics-to-details step, keeps
the block library and sequence hidden until a name and sport are confirmed,
makes click-to-add and drag targets visible, maps timeline height to intensity
at every size, and exposes selected-block intensity, duration, repetitions,
targets, notes, and an adjacent recovery-block action. The refinement was
browser-checked at desktop and 390px mobile widths on 2026-09-22. The full
199-test suite, lint, and production build pass; the build retains the existing
middleware deprecation warning. A standalone `tsc --noEmit` still reports
pre-existing typing errors in test fixtures while the production build's
TypeScript gate passes.

The workout creator’s session-shape preview now uses a dedicated 160px terrain:
each block remains time-proportional in width and rises from a visible Zone 1
recovery baseline through Zone 5. Compact and card previews keep their denser
shared timeline treatment. The focused source check and direct lint pass on
2026-09-22; the duplicate `redirect` import that blocked compilation was
removed and the related 35-test architecture/navigation check passes. The
production build remains blocked locally by Prisma package-read access and
Google Font network failures.

The basics step was subsequently tightened to a centered 46rem maximum measure
with clearer spacing and a standard-size Continue action. Template selection
and save controls now remain out of the first-step hierarchy and appear only
with the detailed authoring workspace. Once details are unlocked, Edit basics
now edits name and sport inline while leaving the block library, sequence, and
inspector visible.

On 2026-09-22, Planner now keeps a selected checkmark visible alongside the
Today label, and Workout Builder has a dedicated, announced trailing drop zone
for placing a block last. Direct lint and 35 focused dependency-independent
tests pass. The full suite is currently blocked when Prisma-importing test
modules hit access-denied reads of the installed Prisma client. A direct
production compilation is likewise blocked by those package reads and an
unavailable Google Font fetch; these failures are outside the repaired files.

## Verified Gates

| Gate | Result | Command or evidence |
|---|---|---|
| Tests | 214/218; four existing athlete planned-edit validation failures | `pnpm test` on 2026-09-25; the new execution and source-ownership checks pass |
| Lint | Pass | `pnpm lint` on 2026-09-25 |
| Production build | Pass | `pnpm build` on 2026-09-25; no pending migrations, existing middleware deprecation warning |
| Interface quality pass | Pass | Independent Impeccable design and technical assessments, focused source regression coverage, and detector scan on 2026-09-22; detector findings were advisory-only |
| Planner usability refinements | Source and detector pass; browser blocked | Focused ESLint passed and post-change `impeccable detect --json components/PlannerDesk.tsx` returned `[]` on 2026-09-23; local Next rendering was blocked by access denied reading `@prisma/client` metadata |
| Database setup | Pass | Neon URLs configured locally; `pnpm db:migrate` found no pending migrations and a pooled Prisma `User` count succeeded on 2026-09-23 |
| Design context | Pass | `DESIGN.md`, `.impeccable/design.json`, and the signed-in surface brief synchronized with Ink Is Movement tokens and shared components; focused workout builder presets, progressive basics, zone chart, and three workout-flow direction previews verified in source; detector completed with advisory-only findings |
| Button standardization | Pass | Shared standard/compact/ghost tiers now use 40px/32px targets with 13px/12px sentence-case labels; compact controls are shadow-free, navigation uses ghost controls, and segmented controls plus production utility controls use the same sizing and focus rules; detector completed with advisory-only type-ramp findings |
| Browser workflow verification | Pass | Headless Chromium completed the personal plan-to-Activity journey at desktop and 390px mobile widths on 2026-09-18 |
| Session detail and live execution | Independent review: ship; headless responsive and control review passed | Temporary synthetic surface using the production components captured at 1440×1200 and 390×844; countdown, pause, next, skip, previous, and restart exercised. Authenticated route review unavailable because the interactive browser was disconnected. |
| Input field standardization | Pass with known a11y gaps | Shared inputs/selects now use 40px height, 13px text, 3px radius, shared inset depth, and shared focus treatment; textareas retain extra writing room; browser-checked login and template editor at desktop/mobile widths; axe found no field-specific failure |
| Form action rhythm | Pass with known a11y gaps | Actions that submit, cancel, clear, copy, or delete alongside 40px fields now use the matching standard 40px tone; compact sizing remains for dense toolbars, menus, list rows, and navigation; template filter/editor and athlete/coach planner actions checked at desktop/mobile widths; danger token now clears the standard action contrast threshold |

## Capability State

- Authentication and role setup are active and covered by source-level tests.
- Coach roster, athlete detail, requests, planner, libraries, templates, and training plans are active implementation paths.
- Athlete Home, Calendar, Workouts, Planner, Templates, Session, Live, Activity, Profile, and Settings are active implementation paths.
- The canonical visual workout builder supports structured blocks, skipped blocks, repetitions, relative targets, and profile-aware previews without persisting profile values into generic prescriptions. Workout authoring uses a focused library/editor mode, opens new workouts directly in the builder, puts sport and name first, and collapses those basics into a compact editable header once complete. The shared full-session chart has five 10-minute intensity presets, direct bar selection and reordering, copy/delete controls, live repeat previews, three layouts including the Interval score side inspector, and a 30-minute duration slider. Advanced details retain the canonical target, note, skip, and repetition fields; saves continue to preflight the canonical draft validator.
- The public `/design/workout-flow/flowline`, `/workbench`, and `/trail` routes share an interactive sample-data preview surface. They demonstrate connected sequencing, a persistent palette/workbench, and four-pass authoring with preset insertion, drag and explicit reorder controls, block inspection, undo/redo, and a Trail intention choice without changing production persistence.
- The public `/design/planner/field`, `/atlas`, and `/dispatch` routes share an interactive synthetic-data preview surface. Field is a week-first drop wall, Atlas is now a comparison index for Select days, Template range, and Planning desk month-planning directions, and Dispatch is a multi-day source queue; the revised Atlas directions support workout multi-selection, template range validation, source search tabs, selected-day session detail, and exact-workout preview navigation without changing planner persistence.
- Production `/coach/planner` and `/athlete/planner` now use the shared `components/PlannerDesk.tsx` month-first assignment surface. Workouts can be assigned to multiple selected dates, templates require exact cadence-length ranges, coach training plans retain Monday anchoring, selected-day sessions link into existing session/athlete context, and the old coach source panel plus week/form composition were removed.
- Three additional public Workbench experiments preserve the block library and Block details inspector while varying only the middle field: Terrain maps intensity to block height, Ribbon expands the duration-weighted color session across the full field and exposes a multi-selection tray, and Staging provides a temporary repeated-block shelf before moving a set into the final sequence.
- The workouts library and editor now distinguish unscheduled library versions from Planner copies and explain empty, search, save, delete, share, and editing states in direct task language; the shared builder uses context-specific labels for workout and template editing. The library is hidden while a workout is being authored so the builder has the full surface.
- Planner is now source-only for both roles: it places saved workouts and templates on selected dates, normalizes week/month templates to their planning anchors, assigns coach training plans, and keeps authoring in Workouts or Templates. Existing planned sessions can be reviewed and removed from Planner without reopening the workout creator.
- Sharing is implemented with sanitized immutable snapshots and explicit recipient saves. Browser acceptance remains a gap.
- `lib/planner-service.ts` and the older coach session mutation route remain transitional compatibility code. Do not extend them for new behavior.
- The signed-in shell, shared UI primitives, session rows, authored ink-flow linework, and athlete Home now use the Ink Is Movement visual world without changing route or data behavior. Workspace navigation is owned by the sidebar and mobile bar; page headers keep only page-local or contextual actions instead of repeating sibling destinations.
- Production buttons now use the shared primary, secondary, danger, compact, and ghost tiers. Standard actions use 40px targets with quieter 13px labels; dense controls use 32px targets with 12px labels, and page-header/navigation actions use the lighter compact or ghost tiers. Content-rich workout preset cards remain an explicit editor exception.
- Production inputs and selects now use the same 40px/13px rhythm as standard actions, while textareas keep a roomier writing height. Route-specific labels and the legacy block editor now reuse the shared field treatment instead of introducing larger radii or typography.
- Form actions now follow the same 40px rhythm when they operate on a field: filtering/creation, editor save/cancel, planner create/delete, session adjustment, recovery, and share-link copy actions are standard-sized. Dense command bars, menus, calendar navigation, and repeated list actions intentionally remain 32px.
- Workspace pages now use one 1800px maximum frame with no per-route width variants. Shared `--page-*` tokens in `app/globals.css` own 20/24/32px gutters, 24px top padding, a 96px header band, and a 16px section gap. `TopBar` top-aligns headings; authentication uses `AuthPageShell`. Planner gives its complete seven-column month priority and adapts source/selection rails to available width.

## Verified Preview Gates

| Gate | Result | Command or evidence |
|---|---|---|
| Planner direction previews | Pass | Playwright Chromium checked the three public preview routes at 1440px desktop and the Field route at 390px; explicit source selection, multi-day placement, and pointer drag/drop passed against the rebuilt bundle with no page or console errors; captures are in `.impeccable/review/planner/` |
| Atlas assignment directions | Pass with browser gap | `pnpm test`, `pnpm lint`, and `pnpm build` pass; HTTP smoke checks returned 200 for the Atlas index, Select days, Template range, Planning desk, and exact-workout preview routes; no browser executable is available in the current environment for interaction capture |
| Production Planning Desk | Pass | 196 tests, lint/build, clean Impeccable detector, authenticated multi-date placement, exact template ranges, mobile width, retry replay, and concurrent same-key requests pass |

## Running Layout Verification — 2026-09-18

The local app at `http://localhost:3000` runs from `C:/Users/Erik/koding/glowing-couscous`, not the separate WSL task checkout. Layout-only changes were applied to this Windows checkout; existing PRODUCT.md and .impeccable/design.json edits were preserved, and unrelated WSL functional changes were not imported.

- `pnpm test`: 188 tests pass. `pnpm lint`: pass.
- `pnpm build`: blocked at Prisma generation by the running Windows server holding query_engine-windows.dll.node open (EPERM). `pnpm exec next build`: pass with the existing generated client; no schema changes were made. Existing middleware deprecation warning remains.
- Chromium against the actual `localhost:3000`: 56 athlete/coach route-viewport checks passed at 1280×720, 1366×768, 1920×1080, and 390×844. Desktop titles start at y=24, page content at y=136, with shared left/right frame boundaries. Complete six-week Planner fits desktop height, date selection works, and checked pages have no horizontal overflow.
- Planner, Templates, and Calendar screenshots were compared directly. Mobile retains natural page scrolling; checks do not claim that all content of every page fits one viewport. Public sharing and populated session/live pages were not reverified in this pass.
- UI detector reported 69 advisory findings and no blocking findings, primarily existing typography/radius values.
## Known Gaps

- Browser verification is still needed for public share previews, the six workout-flow direction and Workbench experiment previews, some session mutation flows, and physical pointer/touch acceptance of the workout builder and preview presets.
- Browser verification is still needed for the revised Atlas directions, including multi-date workout selection, template range validation, source search tabs, selected-day drill-down, and responsive layout behavior.
- Credentials flows are locally covered; external OAuth integration is not.
- Live execution is a local guidance stepper and does not collect device or sensor telemetry.
- Next.js reports a middleware-to-proxy deprecation warning; this is not currently a build failure.
- The design detector reports advisory literal colors, radii, and sizes in the
  scoped `/design/*` direction previews, workout/editor and preset/chart label
  sizes, responsive editorial type values, shared compact controls, and Calendar
  labels; no blocking findings were reported.
- `agent-browser` axe checks on authenticated Calendar and Templates found
  existing muted navigation/calendar text below the 4.5:1 contrast threshold
  and missing `main`/region landmarks. These are outside the button density
  change and should be addressed in a separate accessibility pass.
- The template editor axe check also reports two existing ARIA-role issues on
  non-role containers, low contrast on the drag-handle text and share-link
  helper copy, and the same missing landmark coverage. The danger action token
  was darkened during form-action alignment and no longer appears in that
  contrast result. These remaining findings are separate from the field and
  action-rhythm work.

## Functional Repair Verification — 2026-09-18

All prioritized repairs are on main. The final gates pass under WSL with Node 24.8.0: 196 tests, lint, and production build. Next.js still reports the existing middleware-to-proxy deprecation warning.

Fresh-account Chromium acceptance covered a repeated workout showing 20 minutes for a 300-second block repeated four times, multi-date Planner placement, self-planned editing and cross-date rescheduling, live execution, completion, actual correction, Planned/Actual comparison, Activity review, persisted authentication, and a 390px Planner viewport without horizontal overflow. Earlier focused checks covered exact week/month template selection, empty source tabs, placement/removal feedback, reduced motion, pointer insertion, undo/redo, and mobile builder layout. Physical-device touch remains unclaimed.

The additive PlacementRequest migration was applied to the existing development SQLite database without reset. Same-key replay returned the original IDs, two concurrent identical API requests both returned the same two session IDs, different payload reuse is rejected, user scopes are isolated, and a simulated mid-batch failure rolls back sessions, plans, and the request reservation. Impeccable detectors returned no findings for the changed production UI files.
