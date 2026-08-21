# Feature: Coach Roster And Athlete Detail

- **ID:** `COACH-001`
- **Status:** `shipped`
- **Last verified:** `2026-08-21`
- **Owner:** `lib/coach-service.ts`
- **Related work:** [architecture](../../../ARCHITECTURE.md), [baseline](../history/2026-08-21-baseline.md)

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
- Request panels are included in the coach overview.

## Verification

- `tests/coach-service.test.ts` — overview/detail and roster ownership assertions pass on 2026-08-21.
- `pnpm test`, `pnpm lint`, and `pnpm build` — pass on 2026-08-21.

## Known Gaps

- More service-level coverage is needed around edge cases and API-level authorization.
- Coach profile detail and collaboration/messaging are intentionally outside the MVP.

## Extension Rules

- Start in `lib/coach-service.ts` for roster/detail read behavior.
- Keep pages as composition layers and preserve coach ownership predicates.
- Use `coachPlannerService` for planner mutations, not this read service.
