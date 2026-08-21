# Feature: Athlete Tempo Surfaces And Completion

- **IDs:** `ATHLETE-001`, `COMPLETE-001`
- **Status:** `shipped`
- **Last verified:** `2026-08-21`
- **Owner:** `lib/athlete-service.ts` for reads; completion API for activity writes
- **Related work:** [baseline](../history/2026-08-21-baseline.md), [architecture](../../../ARCHITECTURE.md)

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
- Activity feed returns the latest twelve activities with totals and block segments.

## Verification

- Calendar, session math, navigation, source, accessibility, and build checks pass on 2026-08-21.
- `pnpm test` — 84 passing tests; completion route behavior is not yet covered by a dedicated focused test.

## Known Gaps

- Completion currently records planned metrics with `compliancePct: 100`; it is
  not a performed-metrics import or sensor integration.
- The live surface is guidance only and does not track current step state back to the server.
- Athlete onboarding and navigation polish remain planned.

## Extension Rules

- Add athlete read behavior to `lib/athlete-service.ts`.
- Add account preference/name behavior to `lib/account-service.ts`.
- Keep completion ownership checks tied to `session.athleteId`.
- Derive display metrics from structured blocks; do not duplicate calculated values in new models.
