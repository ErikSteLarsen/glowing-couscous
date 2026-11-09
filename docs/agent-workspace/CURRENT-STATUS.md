# Current status

Last verified locally on **2026-11-09**. Source code and tests are authoritative.

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
- Template authoring uses the shared editor with profile previews, explicit
  discard confirmation, failed-save draft retention, and locked controls while
  saving. The library and editor appear separately; mobile Save clears the
  bottom navigation. Template durations remain editable in seconds.
- Live expands repetitions into unique execution steps, omits skipped blocks,
  and uses canonical relative and profile-aware target labels. The same generic
  labels appear in shared session summaries. Session detail uses refreshed
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
- Athletes can share workouts directly from their library. Recipient saves
  retain failed drafts, require explicit discard, and lock editing while
  pending. Athlete copies go to Planner; coach copies are unscheduled and
  visible in Workouts through the current library service.
- Athlete workout and template cards open Planner with that owned source
  selected. Successful saves link directly to the new source; the Planner
  validates source IDs against the signed-in athlete's libraries, initializes
  template date-range selection, and retains a selected source during month
  navigation. Invalid or removed source links show an explanation.
- The library-to-Planner handoff scores 8/10: source selection, ownership,
  creation feedback, and navigation are covered; direct browser and accessibility
  checks remain unverified.

## Verified gates

| Gate | Result | Evidence |
|---|---|---|
| Tests | Pass, 251 tests | `pnpm test` on 2026-11-09 after the library-to-Planner handoff changes |
| Lint | Pass | `pnpm lint` on 2026-11-09 after the library-to-Planner handoff changes |
| Production build | Pass | `pnpm build` on 2026-11-09; Node emits `DEP0205` for `module.register()` |
| Mobile workout actions | Pass | 390px Chromium: action bar bottom 780px, navigation top 783px; desktop offset 0px; both review axes found no actionable issue |
| Template authoring | Pass | Chromium discard/keep, blocked fetch, delayed save locks, retry/reload, and 20-second interval persistence; editor and list axe scans have no violations; 390px and 1440px have no overflow; design detector has no findings |
| Activity history | Pass | SQLite pagination across 26 outcomes, filtered totals, timestamp ties, ownership, stale pages, and literal `%`/`_`/backslash searches; Chromium recorded completion notes, older/newer pages, filters, reload, empty recovery, no overflow, and zero axe violations |
| Shared recipient copies | Pass | SQLite checks athlete/coach/template destinations, privacy, independent copies, and 20-second blocks; Chromium anonymous preview, sign-in return, failure/retry, discard/keep, pending locks, template/calendar persistence, and zero share-editor or workout-library axe violations; both review axes found no actionable issue |
| Short interval precision | Pass | Duration regression covers seconds, remainders, and hour boundaries; 390px Chromium saved/reloaded a 20-second workout block and showed `20s x 3` with a 20-second input; both review axes found no actionable issue |
| Dashboard | Pass | Desktop and 390px Chromium: pointer at final plotted day, Home/End readings, no horizontal overflow or browser errors; coach-note service regressions pass |
| Session execution and corrections | Pass | Chromium repeated/skipped execution, relative labels, completion, immediate actual correction, notes, reopening, planned adjustment, and reload persistence; session detail axe reports no violations |
| Personal session removal | Pass | SQLite verifies owner scope, completed/activity/coach-assigned refusal, and block cascade; Chromium desktop and 390px confirms the in-app dialog, Escape cancel, Calendar removal, refresh feedback, and no horizontal overflow |
| Untimed session display | Pass | Focused checks cover null and explicit times through Home, Calendar, detail, and the shared date formatter; `pnpm test`, `pnpm lint`, and `pnpm build` pass |
| Overdue session recovery | Pass | Home and detail service regressions cover recent ordering, coach/plan/completion exclusions, matching Missed state, late completion, and retained schedule date; existing SQLite tests cover safe rescheduling and unchanged content |
| Library-to-Planner handoff | Pass, 251 tests | Resolver and response tests cover owned, malformed, cross-kind, and unsafe IDs; route and UI assertions cover save/card links, template range setup, and source retention on month navigation; `pnpm test`, `pnpm lint`, and `pnpm build` pass |
| Calendar persistence | Pass | Chromium explicit-date, keyboard-drag, and pointer-drag moves persisted after navigation/reload |
| Calendar dates and ownership | Pass | Isolated SQLite tests cover foreign athletes, coach ownership, completed sessions, impossible dates, plan membership, content preservation, and Oslo/New York DST |
| Calendar accessibility | Pass in scanned week view | Chromium axe 4.12.1: no violations; 390px month view has no horizontal overflow |
| Roleless production authentication | Pass | `node --env-file=.env scripts/verify-roleless-setup.mjs` against a local production server; failed before the proxy migration and passed afterward |
| Design detector | Pass for changed calendar | No findings; dashboard chart labels have advisory typography findings |

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

- Auth.js still redirects to its error page if provider discovery fails, even
  when credentials sign-in requested an inline response. Credential-callback
  failures are recovered inline; provider-discovery outages remain a dependency
  limitation.
- Per-athlete time zones are not implemented. Calendar days use the server's
  local time zone; rescheduling preserves wall time within that zone.
- Live execution is a local guidance stepper without device or sensor telemetry.
- External Google OAuth, physical-device touch, and production deployment have
  not been verified in this run.
- Shared previews and recipient intake passed fresh Chromium checks. Alternate
  workout/planner design previews have not had browser acceptance rerun.
  Workouts, Templates, and Activity list accessibility scans found no violations;
  template editor and list now also pass fresh scans.
- Direct library-to-Planner source selection, month navigation, and template
  range interactions have not had a browser or accessibility run.
- The specialized Next.js dev-loop skill requires Next.js 16.3 or later; this
  app uses 16.2.4. Current evidence uses project checks and direct Chromium tests.
