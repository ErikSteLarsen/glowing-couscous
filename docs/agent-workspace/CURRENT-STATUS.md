# Current status

Last verified locally on **2026-11-17**. Source code and tests are authoritative.

## Maintenance verification

- Added pinned Zod 4.6.7 structural schemas at seven existing session/plan
  service boundaries. Eleven API routes no longer assert arbitrary JSON is a
  typed draft. Invalid shapes return 400 before database access; no transport
  coercion/defaults replace semantic validation. Valid optional fields, decimal
  values, ownership and HTTP success contracts remain covered.
- Final code checks: 455 disposable PostgreSQL-enabled tests (zero skips),
  2 Chromium component checks, type checking, dead-code gate, lint and full
  production build passed. Independent review checked real caller payloads and
  successful response contracts. Authenticated editing/browser and live-provider
  acceptance remain distinct from these service/component checks.

- Independent tooling review caught and fixed datasource inheritance in
  `test:db`: the child now receives the validated disposable URL in all three
  datasource variables. Seven runner tests pass, including fake-child probes
  proving both explicit and derived targets replace inherited datasource URLs.

- Build/test/type commands now generate Prisma explicitly; removed the broken
  schema-text cache script. Node >=24 is declared. `pnpm test:db` safely targets
  only local disposable PostgreSQL and refuses unsafe explicit targets without
  exposing connection credentials. 444 database-enabled tests passed, including
  five runner guard cases; lint, type checking and production build passed.
- Added Knip as a development tool with explicit operational/test entrypoints.
  `pnpm check:deadcode` passes unused-file/dependency and import-resolution gates.
  Full Knip also reports internal export-surface opportunities, which are not
  bulk-fixed. Build still deploys migrations; no data/schema changes were added.

- Framework/authentication refresh: Next.js and matching ESLint config 16.4.6,
  Auth.js 5.0.0-beta.32 and Prisma adapter 2.11.3. 439 PostgreSQL-enabled tests,
  both Chromium checks, type checking and production build passed. Lint passes
  with seven new warnings about existing deliberate hard navigations across
  authentication/share flows. Local production HTTP verification passed
  credentials sign-in, roleless setup, same-role retry, JWT refresh and role
  boundaries; its synthetic account was deleted.
- Core/tooling refresh: Prisma CLI/client 6.19.3, React/DOM 19.3.1,
  Tailwind pair 4.3.5, PostCSS 8.5.33, date-fns 4.4.0, ESLint 9.39.5 and
  compatible transitive updates. Removed unused bcryptjs type stub and
  autoprefixer. No overrides or compatibility source changes were needed.
  439 DB-enabled tests, 2 Chromium checks, lint, types and production build pass.
- Registry audit now reports one high advisory (zero critical/moderate/low),
  down from 75 findings before maintenance. Prisma config pins deepmerge-ts
  7.1.5; its patched release is a major version. No speculative override was
  added. The advisory involves recursive object graphs, and no user objects
  enter this app's Prisma CLI configuration. This is a remaining upstream
  dependency risk, not a claim of proven exploitability or safety.

- Removed nine unreachable files: duplicate canvas authoring and exclusive
  helpers, abandoned editor wrappers, redirected discovery UI, legacy authoring
  helpers and an unused session renderer. Active WorkoutBuilder, session review,
  coach APIs and routed design experiments remain. Caller searches, 439 tests
  (zero skips), 2 Chromium interaction tests, lint, TypeScript and production
  build passed. Two deleted tests exclusively exercised the removed drop helper.

- Canonical block persistence now owns coach planner/library/training-plan writes
  and athlete planned/actual corrections. Duplicate field maps were removed;
  integer target columns round consistently while decimal strings and skipped
  blocks survive. Regression coverage exercises these saved values.
- Step verification: 441 PostgreSQL-enabled tests passed with zero skips;
  `pnpm lint`, TypeScript and `pnpm build` passed against local `tempo_dev`.

## UI SDK integration

- Adopted pinned UI SDK 0.1.0-beta.6 for settings switches, session-removal
  alert dialogs, snapshot selection and Strava inbox filters. Tempo tokens and
  service authorization remain the owners of appearance and mutations.
- Fixed the removal overlay's missing modal focus containment/return; pending
  writes block dismissal and failed deletions retain their error and retry.
- `pnpm test` with the disposable local PostgreSQL database passed **439/439**,
  zero skips. `pnpm lint`, TypeScript checking and `pnpm build` passed.
  The build applied no new schema changes to local `tempo_dev`. The existing
  Node DEP0205 warning remains. Initial checks needed Prisma regeneration and
  the existing local PostgreSQL container restarted.
- `pnpm test:ui` passed isolated Chromium component acceptance at 390px and
  1440px: switch keyboard/disabled states, comparison arrow-key selection,
  alert-dialog focus containment/return, Escape, pending/error and retry.
  These fixture checks do not close authenticated route, visual-layout,
  physical-device, assistive-technology or live-provider gates.
- [SDK integration guide](../UI-SDK.md) records ownership and upgrade checks.
  This adoption does not constitute an exhaustive security or production audit.

## Release closeout

- Template Apply to Calendar now opens Planner with the owned template selected.
  Both navigation regression assertions use the current source-selection URL.
- Final local checks: `pnpm test` passed all 439 tests with the disposable
  PostgreSQL acceptance database (zero skips), `pnpm lint` passed, and
  `pnpm build` passed against local `tempo_dev`, with no pending migrations.
  The existing Node DEP0205 warning remains.
- Local production HTTP smoke verified auth redirects, login/signup and session
  endpoints, and the unauthenticated Calendar API guard without runtime errors.
  The repaired template CTA still needs an authenticated end-to-end browser check.
- GitHub/Vercel reported successful Production deployment of `fd4fff4` before
  this closeout. Anonymous production requests reached Vercel SSO protection,
  so application behavior in production is not verified. Deployment protection
  and live-provider acceptance remain explicit gates.
- WorkoutBuilder is the canonical mounted editor. The unreachable canvas editor
  and its exclusive helpers have been removed.

## Product and ownership

Tempo supports self-directed personal training without a coach. The Athlete
workspace owns workout creation, reusable templates, source-copy scheduling,
session execution, completion, correction, and Activity review. Coach
collaboration remains supported and secondary to this personal workflow.

Workouts are undated private definitions. Planner creates independent dated
copies. Calendar and session detail own scheduled context. Public sharing uses
sanitized snapshots and requires an explicit recipient save.

## Implemented behavior

- Mobile sticky workout actions reserve the bottom navigation and device safe
  area through one shared clearance token. Desktop actions use the viewport
  bottom. Chromium verified Save above navigation at 390px and the desktop
  bottom offset at 1440px; neither settled layout has horizontal overflow.
- The shared shell and controls use the dark Night Instrument system in
  `DESIGN.md`: cyan action, hairline rules, tabular measurements, and semantic
  training colors. `app/globals.css` implements the tokens. Design experiments
  have separate preview styles.
- Home displays fitness, fatigue, form, ramp rate, plan projections, weekly
  planned/completed volume, compliance, and the next unfinished session.
  Coach instructions belong to that session. Returning athletes retain their
  history view. Charts support pointer, keyboard, and vertical touch scrolling.
- Calendar has URL-addressable Monday-first week/month views, period navigation,
  keyboard shortcuts, and weekly summaries. Open self-planned sessions support
  drag or explicit-date moves. A transaction checks athlete ownership,
  completion, and coach assignment, preserves content and local wall time,
  and updates plan membership. Content and summaries refresh from server data.
- The shared Planning Desk assigns saved workouts to multiple dates and validates
  exact template cadence ranges. Placement batches are atomic and use request
  identities for retries. Completed sessions retain their planned baseline.
- WorkoutBuilder owns structured authoring, skipped blocks, repetitions,
  relative targets, profile-aware previews, presets, explicit reorder controls,
  and undo/redo. Generic prescriptions do not store personal profile values.
  Workout, template, and share authoring retain seconds. Shared duration labels
  show short intervals and second remainders instead of rounding them away.
  `WorkoutBuilder` is the mounted library editor; the duplicate unmounted canvas
  implementation and its exclusive input/drop helpers have been removed.
- Template authoring uses the shared editor with profile previews, explicit
  discard confirmation, failed-save draft retention, and locked controls while
  saving. The library and editor appear separately; mobile Save clears the
  bottom navigation. Template durations remain editable in seconds.
- Live expands repetitions into unique execution steps, omits skipped blocks,
  and uses canonical relative and profile-aware target labels. Current step,
  completed-step guidance, and a deliberate timed-step countdown resume from
  this browser after reload or navigation; running countdowns use a saved
  deadline and paused countdowns preserve their remaining time. Expiry does not
  mark a step complete, and manual step navigation or restart resets timer
  guidance. A changed ordered step/duration signature invalidates old progress.
  Only the server completion flow saves an outcome. The same generic labels
  appear in shared session summaries. Session detail uses refreshed
  completion/editor modes and preserves notes through corrections.
- Login, signup, setup, and settings recover from failed requests. Signup
  distinguishes a created account from failed automatic sign-in. Setup retries
  the same saved role without permitting role changes. Settings restores failed
  toggles and prevents overlapping writes. Personal training is the first
  onboarding choice. Chromium verified failed signup/login requests, preserved
  input, a created account with failed automatic sign-in, successful retries,
  and settings rollback followed by persisted retry. A role save followed by
  a blocked session refresh also recovered on retry.
- Session outcomes, actual corrections, comparison, completion history, and
  sanitized sharing remain implemented. The older coach session adapter in
  `lib/planner-service.ts` remains transitional.
- Athletes can remove an open self-planned session from Calendar or session
  detail after an in-app confirmation. The delete service checks athlete
  ownership, completion, coach assignment, and concurrent session changes.
- Scheduled time is optional throughout athlete Home, Calendar, session detail,
  and Live. Unset times remain absent instead of being inferred from the
  timestamp; explicit times still appear in labels and calendar API data. This
  session-time clarity stage scores 8/10 after covering each athlete view.
- Home surfaces the three most recent overdue self-planned sessions with
  Start now and Move to today. Session detail uses the same overdue state,
  keeps Start live available, and offers a date picker. Live completion keeps
  the original schedule date; this recovery stage scores 8/10.
- Activity searches completed names literally, filters by sport, and pages
  through all saved outcomes. Counts, duration, and load cover the matching
  history. A read transaction keeps totals and rows consistent, with stable
  completion-date/id ordering and bounded page reads.
- Athletes can log completed work directly in Activity without creating or
  scheduling a plan. These entries persist as athlete-owned completed sessions
  and activities, show up on their completion date in Activity and Calendar,
  and preserve duration, RPE, and notes for review. Optional metric distance is
  stored as integer meters and shown in Activity and session detail; it can be
  omitted. Standalone entries carry no workout blocks or planned baseline.
  Unknown TSS stays unavailable and is disclosed in history, weekly summaries,
  and load estimates; coach views retain existing athlete visibility while
  hiding plan comparison and workout sharing for unplanned entries. Manual
  logging with optional distance scores **8.5/10**.
- Athletes can import one completed TCX or FIT file up to 5 MB after a
  read-only preview and explicit confirmation. TCX uses the strict streaming
  XML parser and estimates finish from start plus lap duration. FIT uses
  Garmin's FIT JavaScript SDK, requires an Activity file with valid integrity,
  exactly one supported sport Session, consistent start/finish summaries, and
  a valid Activity local timestamp. Files without a usable local timestamp and
  multi-session files are rejected so sport and local date are not guessed.
  FIT finish comes from the Session summary; TCX finish is labeled estimated.
  Both retain UTC instants, source offset, duration, optional distance, and
  athlete-scoped SHA-256 fingerprints. Only summary metrics and source
  provenance persist; preview writes nothing, and standalone imports have no
  blocks or plan baseline. Imports do not store compliance, raw file, GPS,
  sensor time series, unknown fields, or inferred TSS. FIT parsing rejects relative timestamp values as well as
  missing or invalid local-time provenance. FIT import scores **8/10**: the
  browser review confirmed explicit save, saved outcome times, duplicate
  recognition, and local-day Calendar placement. The bounded importer supports
  one running, cycling, or swimming Session and does not import route, sensor,
  or load data.
- Athletes can also import one GPX 1.1 activity up to 5 MB after choosing
  Running, Cycling, or Swimming and reviewing the parsed summary. The parser
  accepts one track with at least two valid trackpoints, explicit increasing
  timestamps, and one consistent UTC offset. It rejects routes without timed
  tracks, multiple tracks, invalid coordinates or times, and mixed offsets.
  Duration uses the first and last trackpoint times; distance is summed between
  consecutive points within each segment, without bridging segment gaps. Only
  summary metrics, source offset, and athlete-scoped SHA-256 fingerprint persist;
  raw files, GPS coordinates, sensor series, TSS, and planned structure do not.
  GPX files can be explicitly paired to an eligible session or kept separate.
  Duplicate previews use the saved activity sport. SQLite coverage verifies
  parser boundaries, read-only preview, ownership, source-local day, concurrent
  duplicate safety, summary-only persistence, and planned-session pairing.
  Production-build Chromium verified sport selection, preview, save, duplicate
  recognition, Activity/session review, and Calendar placement. At 390px, the
  preview and saved Activity had no horizontal overflow. This import stage
  scores **8.5/10**.
- Athletes can explicitly pair a TCX/FIT/GPX preview with an open, same-sport,
  same-source-local-date self-planned session they own, or choose to keep it as
  a separate activity. Only planned or adjusted sessions are eligible; missed
  sessions are excluded. No candidate is preselected. Confirmation revalidates
  eligibility and atomically creates the summary Activity and completes the
  session. Planned title, date, blocks, and existing baseline are preserved; a
  missing baseline is captured before completion. Paired review compares actual
  and planned duration only. Imported summary metrics never create actual
  blocks, TSS, or full compliance; Home, Calendar, Activity, and weekly read
  models label paired results as duration-only and keep standalone imports
  unplanned. Weekly percentages describe planned duration recorded, not full
  workout compliance. TCX, FIT, and GPX duplicate retries remain athlete-scoped.
  This pairing stage scores **8.5/10** after service tests and a 390px Chromium
  review of explicit candidate choice, paired and standalone outcomes, and
  Calendar duration labels.
- Athletes can also explicitly pair a manual summary with an open, same-sport,
  same-completion-date self-planned session they own, or keep it separate.
  Coach-assigned and stale/ineligible sessions are rejected. The transaction
  preserves the planned title, blocks, and existing baseline (capturing one if
  absent), then saves duration, optional distance, effort, and note with
  completion. Activity and session review show actual versus planned duration;
  no actual intervals, TSS, or full compliance are inferred. At 390px,
  Chromium verified the unselected-candidate state, disabled save until an
  explicit choice, paired review, and the separate-activity path with no
  horizontal overflow. Axe found no WCAG 2 A/AA violations; the session scan
  had one incomplete contrast check on an obscured navigation link. Manual
  summary pairing scores **8.5/10**.
- Athletes can correct saved manual activities from session outcome review.
  Standalone entries allow title, sport, completion date, duration, distance,
  RPE, and notes; paired entries allow only performed summary fields, preserving
  the planned session, its date, blocks, and baseline. Owner checks, version
  checks, and transactional writes keep Activity, Calendar, session review, and
  load history in sync. Imports remain source-preserving. SQLite coverage
  verifies both correction paths, validation, ownership, stale-write handling,
  read-model consistency, and unknown load. Production-build Chromium verified
  standalone correction and the paired correction form. A paired summary
  saved as 42m, 9.25 km, RPE 7, and updated notes; the outcome survived reload,
  appeared in filtered Activity and Calendar, and retained its planned title,
  date, blocks, and duration baseline. At 390px and 1440px, the session page had
  no horizontal overflow. Summary-only entries do not show the structured
  workout editor. Axe found no WCAG 2 A/AA violations or incomplete checks for
  the paired correction form at 390px. This correction stage scores **8.5/10**.
- Summary-only activity views omit the empty workout-structure image when no
  segments were recorded. Populated session and Activity timelines retain a
  nonempty accessible name. Chromium verified an unplanned manual outcome has
  no `role="img"` at 390px and 1440px, while structured Activity rows and a
  completed workout still show meaningful timeline labels. The outcome message
  continues to explain that no blocks were recorded; this presentation repair
  scores **9/10**.
- Personal event milestones and completed-activity review score **8.5/10**.
  Athletes can create and edit dated events, record their own goal/result time
  and note, and explicitly link one or more of their completed activities.
  Each Activity can be linked to at most one event; search is paginated and
  owner-scoped. Link/unlink and event deletion leave the Activity and event
  result independent. Linked rows show source-local dates for imported files
  and server-local dates otherwise, duration, and optional distance without
  exposing private Activity notes or snapshots.
  A 390px Chromium review verified linking, unlinking with immediate candidate
  refresh, event deletion preserving activities, source-local date display
  across UTC midnight, and no horizontal overflow. Axe found zero WCAG 2 A/AA
  violations; one contrast check was incomplete because the navigation link
  was partially obscured. Impeccable found no UI findings. Automatic event
  matching and training-plan generation remain out of scope.
- Planner shows all seven weekdays at 390, 1280 and 1440px without a
  hidden horizontal scroll; the calendar and selection panel stack beside the
  source list on desktop. A successful placement clears the date selection, so
  the assign button cannot place the same dates twice from a repeated click.
- Session detail and Live do not highlight Home in the sidebar; Home matches
  only its own route.
- Athletes can share workouts directly from their library. Recipient saves
  retain failed drafts, require explicit discard, and lock editing while
  pending. Athlete copies go to Planner; coach copies are unscheduled and
  visible in Workouts through the current library service.
- Athlete workout and template cards open Planner with that owned source
  selected. Successful saves link directly to the new source; the Planner
  validates source IDs against the signed-in athlete's libraries, opens week
  templates on a Monday-to-Sunday range, opens month templates on the full
  calendar month, and retains a selected source during month navigation.
  The template card hands off with `source=template:<id>`; the Calendar route
  does not consume the former `add=1&template=<id>` query.
  Athletes can review or change the cadence-aligned range before assignment;
  invalid or removed source links show an explanation. This handoff scores
  **8.5/10** after local Chromium verified creating and assigning a new workout,
  single-day/week/month template handoffs, a seven-day template assignment,
  month navigation, and invalid-source feedback. At 390px and 1440px, Planner
  had no horizontal overflow; axe 4.12.1 found zero violations and zero
  incomplete checks. Workouts and Templates also had zero violations or
  incomplete checks at 390px.

## Verified gates

| Gate | Result | Evidence |
|---|---|---|
| Tests | Pass, 293 tests | `pnpm test` on 2026-11-10 after GPX import; includes GPX parsing and boundaries, upload validation, preview without writes, athlete isolation, concurrent deduplication, planned-session pairing, and source-local Activity, Calendar, and load models |
| Lint | Pass | `pnpm lint` on 2026-11-10 after GPX import |
| Production build | Pass | `pnpm build` on 2026-11-10 after GPX import; Node emits the existing `DEP0205` warning for `module.register()` |
| Workout authoring design previews | Pass, 8.5/10 as design exploration | Six preview routes were checked in local production-build Chromium at 1440×900 and 390×844; document and body widths matched both viewports. Flowline keyboard/pointer reorder, presets, save/reset, Trail intention choices, and Workbench selection/repeat/copy-paste/staging/reset interactions were exercised. Axe 4.12.1 found zero WCAG 2 A/AA violations at both sizes; three contrast checks remained incomplete where content is covered by a drag pseudo-element or outside the current position of an intentional horizontal scroller, and those regions were visually inspected. Terrain labels and group semantics, Ribbon group semantics, Flowline card fit, drag description IDs, and forward reorder were corrected. Impeccable reported advisory-only design-token findings across the preview stylesheet. The previews remain sample-only; Ribbon is the strongest concept if a later authoring redesign is requested. No production authoring change was made. |
| Library-to-Planner handoff | Pass, 8.5/10 | Local production-build Chromium at 390px created a workout, used the save feedback link to open it selected in Planner, and assigned it. Created single-day, week, and month templates; the week handoff selected Monday 9–Sunday 15 Nov and assigned seven copies; the month handoff selected 1–30 Nov and exposed the enabled assignment action. Month navigation retained the selected template; an invalid workout ID showed the unavailable-source explanation. The current template card now links directly with `source=template:<id>`; focused source assertion covers the repaired handoff, with browser re-check pending. Planner axe 4.12.1: zero WCAG 2 A/AA violations and zero incomplete checks at 390px and 1440px. Workouts and Templates scans also had zero violations/incomplete checks at 390px; measured document/body widths matched the 390px viewport. |
| Imported activity pairing | Pass, 8.5/10 | SQLite TCX and FIT coverage verifies same-local-day candidates, owner/sport/date/status boundaries including missed-session exclusion, stale 409, preserved planned fields and baseline, null-baseline capture, atomic Activity/session completion, summary-only actuals, duplicate retry, paired Activity/detail/weekly duration, unknown TSS, and duration-only status. Chromium at 390px verified an unselected candidate and disabled save until an explicit choice, paired Activity/session outcomes, the separate-activity path and “no planned comparison,” and Calendar labels “Duration recorded” versus “Unplanned”; no horizontal overflow. Session detail and Activity axe scans had zero WCAG 2 A/AA violations. Calendar scan had zero violations; its two quick-navigation contrast checks were incomplete, then manually measured at 6.06:1 against the page background. |
| Mobile workout actions | Pass | 390px Chromium: action bar bottom 780px, navigation top 783px; desktop offset 0px; both review axes found no actionable issue |
| Template authoring | Pass | Chromium discard/keep, blocked fetch, delayed save locks, retry/reload, and 20-second interval persistence; editor and list axe scans have no violations; 390px and 1440px have no overflow; design detector has no findings |
| Activity history | Pass | SQLite pagination across 26 outcomes, filtered totals, timestamp ties, ownership, stale pages, and literal `%`/`_`/backslash searches; Chromium recorded completion notes, older/newer pages, filters, reload, empty recovery, no overflow, and zero axe violations |
| Manual activity logging | Pass, 8.5/10 | SQLite verifies athlete-only creation, retry idempotency and owner isolation, distance conversion/validation/omission and preservation on retry, no planned baseline, correct completion-date visibility, and unknown-load accounting; fresh and existing SQLite `db:push` preserve schema/data. Chromium at 390px saved a 42-minute run with 5.25 km, showed the value in Activity and session detail, and saved a second run with no distance; both routes had no horizontal overflow and zero WCAG 2 A/AA violations. Impeccable detector returned no findings. |
| Manual summary pairing | Pass, 8.5/10 | SQLite verifies eligible self-planned candidates, explicit selection or separate logging, coach/owner/date/sport/status rejection, stale-choice rejection, atomic completion, request-key retries, planned content and baseline preservation, missing-baseline capture, summary-only actuals, distance/RPE/note retention, duration-only comparison, and no inferred TSS or blocks. Local production-build Chromium at 390px verified an unselected candidate and disabled save, paired Activity/session review showing actual versus planned duration, the standalone path, and no overflow. Axe: zero violations; one session-page contrast check remained incomplete because the navigation link was obscured. `pnpm test` (283), `pnpm lint`, and `pnpm build` pass; build emits the existing Node `DEP0205` warning. |
| Manual activity correction | Pass, 8.5/10 | SQLite verifies standalone and paired corrections, ownership, field/source boundaries, validation, stale-write protection, and consistent Activity, Calendar, session, and load read models. Production-build Chromium verified standalone correction and paired correction through save and reload; paired metrics appeared in filtered Activity and Calendar while the planned title, date, blocks, and duration baseline stayed intact. At 390px and 1440px, session review had no horizontal overflow; the summary-only structured editor is absent. Axe on paired correction at 390px: zero WCAG 2 A/AA violations and zero incomplete checks. `pnpm test` (285), `pnpm lint`, and `pnpm build` pass; build emits existing `DEP0205`. |
| Summary-only workout structure | Pass, 9/10 | The shared `SessionBlockBar` omits the image when there are no segments. Production-build Chromium verified a standalone manual outcome has no empty `role="img"` at 390px or 1440px; Activity rows and a populated planned outcome still expose meaningful timeline labels. The outcome still says no workout blocks were recorded. `pnpm test` (285), `pnpm lint`, and `pnpm build` pass; build emits existing `DEP0205`. |
| TCX activity import | Pass, 8/10 | `pnpm test` passes 265 tests; parser/SQLite coverage verifies namespaced TCX, exact 5 MB parser boundary, malformed/DOCTYPE/unsupported inputs, streamed body cap without Content-Length, preview without writes, explicit confirmation, athlete ownership, per-athlete fingerprints, concurrent duplicate safety, atomic persistence, unknown TSS/no plan baseline/no route storage, source-local completion day around UTC midnight, and start/finish provenance in Activity and session detail. `pnpm lint` and `pnpm build` pass; build emits the existing Node `DEP0205` warning. Existing Chromium verified preview, explicit save, duplicate recognition, and 390px layout; final Chromium re-check verified recorded start, estimated finish, duplicate review, Sun 8 Nov placement, Activity/session detail, and desktop/390px layouts with no horizontal overflow. Impeccable detector returned no findings. Disposable test activity was removed. |
| Personal event milestones and completed-activity review | Pass, 8.5/10 | SQLite coverage includes explicit multi-activity linking, one-event-per-Activity behavior, athlete and Session ownership, completed status, minimal private-field projection, source-local date, independent result data, atomic unlink, and activity preservation on event deletion. 390px Chromium verified linking/unlinking, candidate refresh, event deletion preserving Activity, source-local display across UTC midnight, and no overflow. Axe 4.12.1: 0 WCAG 2 A/AA violations and one incomplete color-contrast check on a partially obscured navigation link. Impeccable detector returned `[]`. |
| FIT activity import | Pass, 8/10 | SQLite tests verify Activity type and integrity rejection, unsupported and multi-session sport rejection, absolute timestamp and local-time provenance validation, UTC-boundary local day, exact metric/provenance mapping, preview without Session/Activity writes, athlete isolation, concurrent retry deduplication, and no GPS/sensor persistence. `pnpm test` (276), `pnpm lint`, and `pnpm build` pass; build emits existing Node `DEP0205`. Chromium confirmed preview, explicit save, saved outcome times and metrics, duplicate recognition, and Saturday 7 Nov Calendar placement. At 390px, preview details stack without horizontal document overflow. Coach review shows imported activity duration and correctly labels load/comparison as unavailable. Impeccable detector found five existing 11px type-ramp advisories in the coach athlete page; no findings in the athlete import or session review surfaces. The disposable browser database and fixtures were removed. |
| GPX activity import | Pass, 8.5/10 | SQLite verifies GPX 1.1 timed-track parsing, explicit sport selection, valid coordinates, consistent offsets, ordered timestamps, route-only/multiple-track/untimed/malformed rejection, segment-safe distance, preview without writes, athlete ownership, saved-sport duplicate review, concurrent deduplication, no coordinate/TSS persistence, planned-session pairing, and source-local Activity/Calendar/load models. `pnpm test` (293), `pnpm lint`, and `pnpm build` pass; build emits existing Node `DEP0205`. Production-build Chromium verified sport selection, preview, explicit standalone save, duplicate recognition, Activity and session review, and Calendar placement on the source-local day. At 390px the preview, saved Activity, session review, and Calendar had no horizontal overflow. Impeccable had no findings on the athlete import or session surfaces; five existing 11px type-ramp advisories remain on the coach athlete page. Disposable browser data and captures were removed. |
| Shared recipient copies | Pass | SQLite checks athlete/coach/template destinations, privacy, independent copies, and 20-second blocks; Chromium anonymous preview, sign-in return, failure/retry, discard/keep, pending locks, template/calendar persistence, and zero share-editor or workout-library axe violations; both review axes found no actionable issue |
| Short interval precision | Pass | Duration regression covers seconds, remainders, and hour boundaries; 390px Chromium saved/reloaded a 20-second workout block and showed `20s x 3` with a 20-second input; both review axes found no actionable issue |
| Dashboard | Pass | Desktop and 390px Chromium: pointer at final plotted day, Home/End readings, no horizontal overflow or browser errors; coach-note service regressions pass |
| Session execution and corrections | Pass | Chromium repeated/skipped execution, relative labels, completion, immediate actual correction, notes, reopening, planned adjustment, and reload persistence; session detail axe reports no violations |
| Live progress and step timer | Pass, 253 tests | Execution tests verify resume data round-trip, workout-change invalidation, corrupt/out-of-range data recovery, explicit restart, timestamp-based countdown, pause/resume, expiry, and timer reset for completed/manual-navigation states. Chromium verified start, pause/resume, running and paused reload recovery, expiry without step completion, manual advance reset, and restart; a hydration guard prevents a false Start timer control before saved progress appears. `pnpm test`, `pnpm lint`, and `pnpm build` pass. |
| Personal session removal | Pass | SQLite verifies owner scope, completed/activity/coach-assigned refusal, and block cascade; Chromium desktop and 390px confirms the in-app dialog, Escape cancel, Calendar removal, refresh feedback, and no horizontal overflow |
| Untimed session display | Pass | Focused checks cover null and explicit times through Home, Calendar, detail, and the shared date formatter; `pnpm test`, `pnpm lint`, and `pnpm build` pass |
| Overdue session recovery | Pass | Home and detail service regressions cover recent ordering, coach/plan/completion exclusions, matching Missed state, late completion, and retained schedule date; existing SQLite tests cover safe rescheduling and unchanged content |
| Library-to-Planner handoff | Pass, 251 tests | Resolver and response tests cover owned, malformed, cross-kind, and unsafe IDs; route and UI assertions cover save/card links, template range setup, and source retention on month navigation; `pnpm test`, `pnpm lint`, and `pnpm build` pass |
| Calendar persistence | Pass | Chromium explicit-date, keyboard-drag, and pointer-drag moves persisted after navigation/reload |
| Calendar dates and ownership | Pass | Isolated SQLite tests cover foreign athletes, coach ownership, completed sessions, impossible dates, plan membership, content preservation, and Oslo/New York DST |
| Calendar accessibility | Pass in scanned week view | Chromium axe 4.12.1: no violations; 390px month view has no horizontal overflow |
| Roleless production authentication | Pass | `node --env-file=.env scripts/verify-roleless-setup.mjs` against a local production server; failed before the proxy migration and passed afterward |
| Design detector | Advisory only | Event UI scan found one existing Home 11px type-ramp advisory at line 279, outside the event markup; no other findings in the scanned event surfaces |

Calendar review identified unclear handling of optional scheduled times. Explicit
times appear in visible metadata and accessible names, while unset times remain
absent across athlete views and the calendar API. Session review identified
cross-sport heart-rate resolution; both Live and WorkoutBuilder now require the
current sport, with distinct-sport and missing-value regressions.
Overdue personal sessions now have a direct recovery path from Home and detail;
the state is derived from the scheduled date and ownership, and rescheduling
reuses the conditional schedule mutation.
Roleless JWT refresh previously called Prisma in Edge middleware and cleared
the session. `proxy.ts` now runs that guard in Node.js; the runtime regression
checks the real cookie/session flow and deletes its temporary account.
Dashboard review
findings are corrected, and its recheck found no actionable remaining issue.
The continuation closed mobile, template, Activity, sharing, and duration
iterations. Each was committed, reviewed on standards and product behavior,
corrected where needed, and pushed. Disposable history fixtures and the fresh
recipient account were removed after verification.

## Remaining limits and unverified behavior

- Personal sessions cannot yet be skipped (no skipped outcome or "Plan again").
  An earlier uncommitted attempt is not on main.
- Planner placement has no optional time-of-day input, and repeated placement
  of the same source does not yet warn before duplicating dates.
- The session correction editor is still a narrow side card at 1440px; its
  horizontal overflow has not been fixed or verified on main.

- Auth.js still redirects to its error page if provider discovery fails, even
  when credentials sign-in requested an inline response. Credential-callback
  failures are recovered inline; provider-discovery outages remain a dependency
  limitation.
- Per-athlete time zones are not implemented. Calendar days use the server's
  local time zone; rescheduling preserves wall time within that zone.
- Live execution and its countdown are local guidance only; no device or sensor
  telemetry is collected, and countdown expiry does not record actual work.
- Live progress is stored per session in the current browser only; it does not
  sync across browsers/devices. Timer browser verification covered desktop
  Chromium; physical-device interaction remains unverified.
- External Google OAuth, physical-device touch, and production deployment have
  not been verified in this run.
- Manual activity logging records duration, optional distance, RPE, and notes.
  TCX and FIT imports preserve distance and source provenance. GPX import
  derives distance from one timed track; mixed offsets and route-only files are
  rejected because they cannot be represented consistently by the current
  source-local timestamp model. FIT imports require a usable Activity local
  timestamp and one supported sport session. GPS coordinates, raw file
  contents, and sensor series are not stored. Imported TSS remains unavailable,
  and direct device sync is unsupported.
- Shared previews and recipient intake passed fresh Chromium checks. The six
  workout authoring previews passed desktop/mobile browser acceptance; Terrain
  and Ribbon keep horizontal scrolling inside their charts. Workouts, Templates,
  and Activity list accessibility scans found no violations; template editor
  and list now also pass fresh scans.
- Next.js is now 16.4.6. Current acceptance evidence uses project checks,
  isolated Chromium interactions and local production HTTP authentication.

## Strava and activity import

- Strava is an optional integration owned by one Tempo user and one Strava
  athlete. OAuth tokens are encrypted server-side. Recent Strava activities land
  in the Import inbox for explicit review; nothing is imported automatically.
- Webhook notifications are queued and processed by a scheduled authenticated
  worker. The production webhook challenge and the `/api/strava/inbox` auth
  guard were checked; authenticated review of a real Strava upload, persisted
  matching, retry execution and concurrency are still open acceptance gates.
- File import (TCX, FIT, GPX) previews before save and deduplicates by file
  fingerprint. Guided workout creation is provider-dependent; no live model call
  is recorded here.

## Open gates

- Live Strava delivery, retry, update, privacy, delete and deauthorization
  flows need acceptance against the live provider.
- Resend password-reset delivery and optional Google OAuth need separate
  configuration and testing.
- Imported workout interpretation is proposal-only (see
  `docs/IMPORTED-WORKOUT-ANALYSIS.md`); Strava API-data analysis is blocked
  pending permitted scope.
- Before broad signup: privacy/support information, live-provider deletion
  acceptance and server-side signup abuse controls are not yet in place.
- `middleware` to `proxy` naming is complete in code; the default Turbopack
  build has stalled in past runs, so webpack builds are the verified path.
