# Feature: Athlete Tempo Surfaces And Completion

- **IDs:** `ATHLETE-001`, `COMPLETE-001`
- **Status:** `shipped`
- **Last verified:** `2026-08-21`
- **Owner:** `lib/athlete-service.ts` for reads; `lib/athlete-completion-service.ts` for Activity writes
- **Related work:** [baseline](../history/2026-08-21-baseline.md), [architecture](../../../ARCHITECTURE.md), [Live task](../tasks/2026-08-21-athlete-live-execution.md), [completion task](../tasks/2026-08-21-completion-integrity.md)

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
- Calendar supports a Monday-first week scroller and a full Monday-first month grid.
- Session detail derives status, duration, TSS, targets, zone segments, and block metadata.
- Live execution presents ordered blocks and a stepper-style execution view.
- Completion upserts an `Activity`, derives metrics from planned blocks, sets
  session status to completed, and supports undo to planned.
- Manual completion stores `manual-planned` estimates with nullable compliance,
  persisted segments, and notes retained on the Session across reopen.
- Completed sessions cannot be edited or deleted through coach planner mutation
  paths while their Activity outcome exists.
- Activity feed returns the latest twelve activities with totals and block segments.

## Verification

- Calendar, session math, navigation, source, accessibility, and build checks pass on 2026-08-21.
- `pnpm test` — 103 passing tests, including focused completion service and
  immutable planner behavior coverage.
- `pnpm db:push --force-reset && pnpm db:seed` — pass on the disposable local
  SQLite database on 2026-08-21.

## Known Gaps

- Completion currently records planned metrics with `compliancePct: 100`; it is
  not a performed-metrics import or sensor integration.
- Live is currently a static block outline; it has no client-owned execution
  state or advance/previous controls.
- The live surface is guidance only and does not track current step state back to the server.
- Athlete onboarding and navigation polish remain planned.

## Extension Rules

- Add athlete read behavior to `lib/athlete-service.ts`.
- Add account preference/name behavior to `lib/account-service.ts`.
- Add completion writes to `lib/athlete-completion-service.ts`; keep the route
  as an authentication, parsing, and serialization adapter.
- Keep completion ownership checks tied to `session.athleteId`.
- Use stored Activity segments/source for outcome reads; do not derive old
  Activity history from mutable current Session blocks.
