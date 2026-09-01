# Feature: Athlete Tempo Surfaces And Completion

- **IDs:** `ATHLETE-001`, `COMPLETE-001`
- **Status:** `shipped`
- **Last verified:** `2026-08-28`
- **Owner:** `lib/athlete-service.ts` for reads, `lib/athlete-session-adjustment-service.ts` for planned writes, and `lib/athlete-completion-service.ts` for Activity writes
- **Related work:** [baseline](../history/2026-08-21-baseline.md), [architecture](../../../ARCHITECTURE.md), [Live task](../tasks/2026-08-21-athlete-live-execution.md), [completion task](../tasks/2026-08-21-completion-integrity.md), [snapshot task](../tasks/2026-08-25-session-snapshots.md), [planned adjustment task](../tasks/2026-08-25-planned-session-adjustments.md), [calendar month polish](../history/2026-08-22-calendar-month-polish.md), [calendar week overview](../history/2026-08-22-calendar-week-overview.md), [calendar copy polish](../history/2026-08-28-calendar-copy-polish.md), [concise UI copy](../history/2026-08-28-concise-ui-copy.md), [month navigation](../history/2026-08-28-calendar-month-navigation.md), [navigation alignment correction](../history/2026-08-28-calendar-navigation-alignment-correction.md), [month empty state](../history/2026-08-28-calendar-month-empty-state.md), [shared session creator](../history/2026-08-28-shared-session-creator.md)

## Contract

An athlete with a coach or self-coached mode can view Home, Calendar week/month,
session detail, a live block stepper, Activity history, Profile, and Settings.
They can mark a session complete or move it back to planned while saving notes.

## Live Path

- **Routes/UI:** `/athlete`, `/athlete/calendar`, `/athlete/session/[sessionId]`,
  `/athlete/live/[sessionId]`, `/athlete/activity`, `/profile`, `/settings`.
- **Services:** `athleteService` methods for dashboard, calendar, activity,
  session detail, profile, and request state; `accountService` for profile/preferences.
- **Data:** `User`, `Session`, `Block`, `Activity`, `Plan`, `CoachRequest`.
- **Shared helpers/components:** `SessionBlockBar`, `Stepper`, `StatusBadge`,
  `MetricText`, `AthleteCalendarWeekScroller`, `session-math`.

## Behavior Already Implemented

- Home summarizes today, next four days, recent activity, trend, week totals,
  and configurable overview cards.
- Calendar supports a full Monday-first week overview and a full Monday-first month grid.
- The week overview always shows all seven Monday-to-Sunday days in a
  responsive one, two, or three-column layout. Its today shortcut is only
  shown when today is outside the visible week.
- Each session summary card links to session detail as a whole, without a
  separate nested `Open session` action.
- Calendar navigation and dense session metadata use compact desktop controls
  with a slightly more readable content text floor; discovery/request actions
  stack safely on narrow screens.
- The week scroller only shows loading status while requesting an adjacent week;
  idle explanatory copy is omitted.
- Athlete page headers and empty states use concise labels and action guidance
  instead of repeating visible layout behavior.
- Month navigation is right-anchored independently of the variable-length month
  label.
- Month view relies on its day grid for empty days and does not repeat an empty
  state below the calendar.
- Athletes can open Planner from the side menu, create a private session for one
  or more dates, edit/delete their own planned sessions, and prefill from their
  private templates.
- Month navigation sits beside the displayed month in the overview card, with
  labeled directional controls and readable grid overflow on narrow screens.
- Session detail derives status, duration, TSS, targets, zone segments, and block metadata.
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
- The active athlete route tree uses the light Tempo surface; unreferenced
  pre-convergence athlete week/session components were removed after reference
  analysis so their dark-theme controls cannot be reused accidentally.

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
- `pnpm db:push --force-reset && pnpm db:seed`, `pnpm lint`, and `pnpm build` —
  pass on 2026-08-25.
- `pnpm db:push --force-reset && pnpm db:seed` — pass on the disposable local
  SQLite database on 2026-08-21.

## Known Gaps

- Completion currently records manual metrics with nullable compliance; it is
  not a performed-metrics import or sensor integration.
- The live surface is guidance only and does not track current step state back to the server.
- Athlete onboarding and navigation polish remain planned.
- Athlete templates are private to their owner; coach-owned templates are still
  assigned through the coach workflow rather than automatically shared.
- Browser verification of planned-edit loading, empty/error states, keyboard
  focus, contrast, and narrow/wide responsive layouts remains outstanding.

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
