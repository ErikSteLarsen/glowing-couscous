# Feature: Coach Roster And Athlete Detail

- **ID:** `COACH-001`
- **Status:** `in-progress`
- **Last verified:** `2026-09-08`
- **Owner:** `lib/coach-service.ts` for reads; `lib/session-comparison-service.ts` for role-scoped comparison reads
- **Related work:** [architecture](../../../ARCHITECTURE.md), [baseline](../history/2026-08-21-baseline.md), [comparison task](../tasks/2026-08-25-baseline-actual-comparison.md)

## Contract

Coaches see their athlete roster, pending requests, current-week compliance,
next sessions, and a detailed athlete view with plan context, week metrics,
calendar sessions, and recent prior sessions.

## Live Path

- **Routes/UI:** `/coach`, `/coach/athletes/[athleteId]`.
- **Services:** `createCoachService()` exposes `getOverview`, `getAthleteDetail`, and `hasAthlete`.
- **Data:** `User.athletes`, `CoachRequest`, `Plan`, `Session`, `Block`, `Activity`.
- **Shared helpers/components:** `lib/week.ts`, `lib/session-math.ts`, shared UI primitives.

## Behavior Already Implemented

- Roster reads only athletes whose `coachId` matches the signed-in coach.
- Current week is Monday through Sunday and session summaries derive planned and actual metrics.
- Athlete detail includes active plan/goal race, current-week stats, week days,
  and eight previous sessions.
- Athlete-detail session cards expose the stored coach-baseline/athlete-actual
  comparison dialog without exposing source/template records.
- Request panels are included in the coach overview.
- Roster rows now provide direct `Plan next session` handoffs and a real empty
  roster state; athlete detail uses aligned Monday-first day groups with
  day-level assignment links and contextual comparison/share labels.

## Verification

- `tests/coach-service.test.ts` — overview/detail and roster ownership assertions pass on 2026-08-21.
- `pnpm test`, `pnpm lint`, and `pnpm build` — pass on 2026-08-25; comparison
  route/component coverage is included.
- `pnpm test`, `pnpm lint`, `pnpm build`, `git diff --check`, and the Impeccable
  detector (`[]`) pass after the coach oversight batch on 2026-09-08; browser
  viewport inspection remains outstanding.
- 2026-09-08 headed Chrome acceptance — coach roster, athlete detail, Workouts,
  Planner, and Templates loaded at 390×844, 1280×900, 1440×1000, and 1920×1080
  without horizontal overflow, runtime exceptions, or console errors; focus,
  role redirects, drawer behavior, and responsive stacking were reviewed.
- 2026-09-09 continuation — the connected desktop-browser bridge remains
  unavailable, so no new coach viewport or interaction evidence is claimed.
  `pnpm test` (175), `pnpm lint`, `pnpm build`, `git diff --check`, and the
  focused Impeccable detector (`[]`) pass.

## Known Gaps

- More service-level coverage is needed around edge cases and API-level authorization.
- Browser verification of comparison dialog loading/error and save interactions
  remains outstanding; primary roster/detail responsive states are covered.
- Coach profile detail and collaboration/messaging are intentionally outside the MVP.

## Extension Rules

- Start in `lib/coach-service.ts` for roster/detail read behavior.
- Keep pages as composition layers and preserve coach ownership predicates.
- Use `coachPlannerService` for planner mutations, not this read service.
