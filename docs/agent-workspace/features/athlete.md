# Feature: Athlete Tempo Surfaces And Completion

- **IDs:** `ATHLETE-001`, `COMPLETE-001`
- **Status:** `in-progress`
- **Last verified:** `2026-09-13`
- **Owner:** `lib/athlete-service.ts` for reads, `lib/athlete-session-adjustment-service.ts` for planned writes, and `lib/athlete-completion-service.ts` for Activity writes
- **Related work:** [baseline](../history/2026-08-21-baseline.md), [architecture](../../../ARCHITECTURE.md), [Live task](../tasks/2026-08-21-athlete-live-execution.md), [completion task](../tasks/2026-08-21-completion-integrity.md), [snapshot task](../tasks/2026-08-25-session-snapshots.md), [planned adjustment task](../tasks/2026-08-25-planned-session-adjustments.md), [calendar month polish](../history/2026-08-22-calendar-month-polish.md), [calendar week overview](../history/2026-08-22-calendar-week-overview.md), [calendar copy polish](../history/2026-08-28-calendar-copy-polish.md), [concise UI copy](../history/2026-08-28-concise-ui-copy.md), [month navigation](../history/2026-08-28-calendar-month-navigation.md), [navigation alignment correction](../history/2026-08-28-calendar-navigation-alignment-correction.md), [month empty state](../history/2026-08-28-calendar-month-empty-state.md), [shared session creator](../history/2026-08-28-shared-session-creator.md), [navigation context and workouts](../history/2026-09-03-navigation-context-and-workouts.md), [navigation decision](../decisions/0014-contextual-athlete-navigation.md)

## Contract

An athlete with a coach or self-coached mode can view Home, Calendar week/month,
an unassigned Workouts library plus scheduled-workout context, Planner,
day/week/month Templates, session detail, a live block stepper, Activity
history, Profile, and Settings.
They can mark a session complete or move it back to planned while saving notes.

## Live Path

- **Routes/UI:** `/athlete`, `/athlete/calendar`, `/athlete/workouts`, `/athlete/session/[sessionId]`,
  `/athlete/live/[sessionId]`, `/athlete/activity`, `/profile`, `/settings`.
- **Services:** `athleteService` methods for dashboard, calendar, activity,
  session detail, profile, and request state; `accountService` for profile/preferences.
- **Data:** `User`, `Session`, `Block`, `Activity`, `Plan`, `CoachRequest`.
- **Shared helpers/components:** `SessionBlockBar`, `Stepper`, `StatusBadge`,
  `MetricText`, `AthleteCalendarWeekScroller`, `session-math`.

## Behavior Already Implemented

- Home summarizes today, next four days, recent activity, trend, week totals,
  and configurable overview cards.
- Home also exposes an additive Monday-first `weekDays` read model, an explicit
  next-action treatment, and aligned session-row/status semantics shared with
  the migrated execution and history surfaces.
- Home today and upcoming-day session tiles link individually to session detail,
  including every session when a day has multiple sessions.
- Home session tiles omit the planned/status badge so workout titles and metadata
  have more room; titles wrap instead of being truncated.
- Home keeps Calendar as one top-level action, sends an empty week toward Planner,
  and uses a four-column large-desktop week tier with wider spacing before the
  seven-column wall tier.
- Home keeps overview customization in Settings without repeating a Settings
  shortcut beneath the overview cards.
- Workouts lists all scheduled sessions and links each card to its session detail.
- Workouts now leads with current-week scheduled work using the shared session-row
  grammar, while the unassigned library remains a separate authoring surface.
- Workouts also owns private standalone workout creation/editing. These records
  have no date or Plan until the athlete places them through Planner.
- Athlete Planner can load a saved private workout as source content and create
  independent dated copies for the selected days.
- Session links preserve whether they were opened from Home, Calendar, Activity,
  or Workouts; session detail and Live return through that same context, with
  Calendar as the direct-link fallback.
- Calendar supports a full Monday-first week overview and a full Monday-first month grid.
- The week overview always shows all seven Monday-to-Sunday days in a
  responsive one, two, or three-column layout. Its today shortcut is only
  shown when today is outside the visible week.
- Each session summary card links to session detail as a whole, without a
  separate nested `Open session` action.
- Calendar workout rows omit visible planned/completed status badges; completed
  rows are subtly muted while their state remains available to assistive labels.
- Calendar workout rows omit assignment time; the session detail surface remains
  the place to inspect time when it exists.
- Calendar navigation and dense session metadata use compact desktop controls
  with a slightly more readable content text floor; discovery/request actions
  stack safely on narrow screens.
- The week scroller only shows loading status while requesting an adjacent week;
  idle explanatory copy is omitted.
- Athlete page headers and empty states use concise labels and action guidance
  instead of repeating visible layout behavior.
- Month navigation is right-anchored independently of the variable-length month
  label.
- Calendar relies on its day grid for empty days and does not render a separate
  workout summary below the calendar.
- Athletes can open Planner from the side menu, create a private session for one
  or more dates, edit/delete their own planned sessions, and prefill from their
  private templates.
- Month navigation sits beside the displayed month in the overview card, with
  labeled directional controls and readable grid overflow on narrow screens.
- Session detail derives status, duration, TSS, targets, zone segments, and block metadata.
- Session and Live surfaces now retain a compact week/date/status context and
  derive their primary action from the session state; completion and network
  feedback uses announced success/error semantics.
- Live execution presents ordered blocks and a stepper-style execution view.
- Live execution advances, goes back, restarts, and marks blocks complete through
  local client state; refresh intentionally restarts the guidance state.
- Completion upserts an `Activity`, derives metrics from planned blocks, sets
  session status to completed, and supports undo to planned.
- Completion stores the complete latest actual editor payload and RPE on the
  Activity, while retained notes remain available through the Activity/Session
  fields and old outcomes remain independent of future planned edits.
- Owning athletes and roster coaches can correct a completed actual through the
  shared canonical editor/API without reopening the session or changing its
  completion status.
- Athletes can open the same stored baseline/actual comparison from Session
  detail and Activity; equal versions remain a single view.
- Athletes can open the shared session editor before completion, change one
  assigned session and its date/time, save an adjusted planned status, and leave
  the source/template baseline untouched.
- Manual completion stores `manual-actual` estimates with nullable compliance,
  persisted segments, and notes retained on the Session across reopen.
- Completed sessions cannot be edited or deleted through coach planner mutation
  paths while their Activity outcome exists.
- Activity feed returns the latest twelve activities with totals and block segments.
- Activity explicitly labels its latest-twelve scope, marks completed state, and
  leads with a Review outcome action.
- The active athlete route tree uses the light Tempo surface; unreferenced
  pre-convergence athlete week/session components were removed after reference
  analysis so their dark-theme controls cannot be reused accidentally.
- Athlete Planner provides visible week navigation, safe date normalization,
  labeled multi-day controls, session metadata, sticky wide-screen save actions,
  and accessible live save feedback.
- Private workout-to-Planner prefilling preserves the selected date set when a
  user switches back to a blank draft; standalone workout cards use the shared
  field-surface token rather than a new hard-coded color.
- `SessionRow` is the shared workout-card primitive across Home, Calendar
  week/month, and Workouts. Its `default`, `compact`, and `month` variants adapt
  content to available space without route-local workout markup and never render
  a status badge. Completed Calendar cards remain muted; the domain status stays
  available for action logic and accessible context.
- `SessionRow` card variants use the shared `SessionBlockBar` intensity timeline:
  segment width represents duration, color identifies the existing zone, and a
  compact rising height encodes Zone 1 through Zone 5. The month tile stays
  title-only and full-detail bars retain the structure timeline. Card timelines
  are transparent, width-capped, and square-edged so their taller zone silhouette
  stays compact without clipping shorter bars.

## Verification

- Calendar, session math, navigation, source, accessibility, cleanup, calendar
  layout, and build checks pass on 2026-08-22.
- `pnpm test` — 146 passing tests, including focused completion, snapshot,
  assignment, and immutable planner behavior coverage.
- `pnpm test`, `pnpm lint`, and `pnpm build` pass after the desktop-first sizing
  polish on 2026-08-28.
- `pnpm test` — 147 passing tests after removing idle calendar loading guidance
  on 2026-08-28.
- `pnpm lint` and `git diff --check` — pass on 2026-08-28.
- `pnpm test`, `pnpm lint`, `pnpm build`, and `git diff --check` pass after the
  concise UI copy audit on 2026-08-28.
- `pnpm test`, `pnpm lint`, `pnpm build`, and `git diff --check` pass after the
  month navigation adjustment on 2026-08-28.
- `pnpm test` — 150 passing tests after the shared session creator on 2026-08-28.
- `pnpm lint`, `pnpm build`, and `git diff --check` — pass on 2026-08-28.
- `pnpm test` — 168 passing tests after Home per-session navigation on 2026-09-02.
- `pnpm lint`, `pnpm build`, and `git diff --check` — pass on 2026-09-02.
- `pnpm test` — 168 passing tests after Home session density polish on 2026-09-02.
- `pnpm lint`, `pnpm build`, and `git diff --check` — pass on 2026-09-02.
- `pnpm test` — 170 passing tests after navigation context and Workouts on 2026-09-03.
- `pnpm lint`, `pnpm build`, and `git diff --check` — pass on 2026-09-03.
- `pnpm db:push --force-reset && pnpm db:seed`, `pnpm lint`, and `pnpm build` —
  pass on 2026-08-25.
- `pnpm db:push --force-reset && pnpm db:seed` — pass on the disposable local
  SQLite database on 2026-08-21.
- `pnpm test` — 170 passing tests on 2026-09-06.
- `pnpm lint`, `pnpm build`, `git diff --check`, and the Impeccable detector —
  pass on 2026-09-06.
- `pnpm test` — 175 passing tests on 2026-09-07; `pnpm lint`, `pnpm build`,
  `git diff --check`, and the Impeccable detector pass after audit hardening.
- `pnpm test` — 175 passing tests on 2026-09-08 after the bounded surface review;
  `pnpm lint`, `pnpm build`, `git diff --check`, and the Impeccable detector
  remain clean. Browser viewport inspection is still outstanding.
- `pnpm test`, `pnpm lint`, `pnpm build`, `git diff --check`, and the Impeccable
  detector (`[]`) pass after the week-at-a-glance Home/Calendar batch on
  2026-09-08; browser viewport inspection remains outstanding.
- `pnpm test`, `pnpm lint`, `pnpm build`, `git diff --check`, and the Impeccable
  detector (`[]`) pass after the athlete execution/history batch on 2026-09-08;
  browser viewport inspection remains outstanding.
- 2026-09-08 headed Chrome finish review — athlete Home, Calendar (empty and
  scheduled weeks), Workouts, Planner, Templates, Activity, Session, and Live
  loaded at 390×844, 1280×900, 1440×1000, and 1920×1080 without horizontal
  overflow, runtime exceptions, or console errors. Mobile shell focus recovery,
  session/live context, role redirects, and 44px checkbox label hit areas were
  verified; full mutation-flow acceptance remains separate.
- 2026-09-09 continuation — the connected desktop-browser bridge remains
  unavailable, so no new athlete viewport or interaction evidence is claimed.
  `pnpm test` (175), `pnpm lint`, `pnpm build`, `git diff --check`, and the
  focused Impeccable detector (`[]`) pass.
- 2026-09-11 Home overview polish — `pnpm test` (175), `pnpm lint`, `pnpm build`,
  `git diff --check`, and the focused Impeccable detector (`[]`) pass after
  removing duplicate Calendar actions, separating overview settings, and adding
  large-desktop spacing. Browser viewport inspection remains unavailable.
- 2026-09-13 Calendar empty-week summary removal — the direct athlete calendar
  suite (8 tests), `pnpm lint`, `git diff --check`, and the focused Impeccable
  detector (`[]`) pass. `pnpm test` and `pnpm build` exceeded the available
  timeout while unrelated long-running work remained; the build had compiled
  and completed TypeScript before timing out during page-data collection.
- 2026-09-13 Calendar status density — the direct athlete calendar suite (8
  tests), `pnpm lint`, `git diff --check`, and the focused Impeccable detector
  (`[]`) pass after hiding calendar status badges and muting completed rows.
- 2026-09-13 Calendar time density — the direct athlete calendar suite (8 tests),
  `pnpm lint`, `git diff --check`, and the focused Impeccable detector (`[]`)
  pass after removing assignment times from Calendar workout rows.
 - 2026-09-13 Workout card standardization — the focused athlete/calendar and
   architecture suite (175 tests), `pnpm lint`, `pnpm build`, `git diff --check`,
   and the focused Impeccable detector (`[]`) pass after routing Home, Calendar
   week, Calendar month, and Workouts through `SessionRow` variants. Build keeps
   the existing middleware-to-proxy deprecation warning. Browser inspection
   remains unavailable because the desktop browser bridge is disconnected.
  - 2026-09-13 Completed-status UI cleanup — the focused architecture suite (17
  passing), `pnpm lint`, `pnpm build`, and `git diff --check` pass after removing
  `SessionRow` status rendering and `showStatus` overrides. `StatusBadge` now
  renders planned, adjusted, and missed states only; completed state remains
  domain data and is never rendered as a badge.
  - 2026-09-14 Shared workout-card intensity timeline — `pnpm test` (175
  passing), `pnpm lint`, `pnpm build`, `git diff --check`, and the focused
  Impeccable detector (`[]`) pass. The build retains the existing
  middleware-to-proxy deprecation warning; a browser visual pass was not
  available because no local Chromium binary is installed.
  - 2026-09-14 Intensity timeline proportion refinement — `pnpm test` (175
  passing), `pnpm lint`, `pnpm build`, `git diff --check`, and the focused
  Impeccable detector (`[]`) pass after removing the bar backdrop, capping its
  width, and strengthening its vertical zone differences.
  - 2026-09-14 Intensity timeline edge refinement — `pnpm test` (175 passing),
  `pnpm lint`, `git diff --check`, and the focused Impeccable detector (`[]`)
  pass after removing chart and segment border radii for the card treatments.

## Known Gaps

- Completion currently records manual metrics with nullable compliance; it is
  not a performed-metrics import or sensor integration.
- The live surface is guidance only and does not track current step state back to the server.
- Athlete onboarding and navigation polish remain planned.
- Athlete templates are private to their owner; coach-owned templates are still
  assigned through the coach workflow rather than automatically shared.
- Browser verification of planned-edit mutation recovery, comparison dialog
  interaction, and all API error branches remains outstanding; the primary
  responsive read/detail surfaces, empty/rest states, and shell interaction
  states were reviewed.

## Extension Rules

- Add athlete read behavior to `lib/athlete-service.ts`.
- Add account preference/name behavior to `lib/account-service.ts`.
- Add completion writes to `lib/athlete-completion-service.ts`; keep the route
  as an authentication, parsing, and serialization adapter.
- Keep live transitions in the pure `lib/athlete-execution.ts` module and local
  `LiveSessionClient`; do not add execution persistence or telemetry.
- Keep completion ownership checks tied to `session.athleteId`.
- Use stored Activity segments/source for outcome reads; do not derive old
  Activity history from mutable current Session blocks.
