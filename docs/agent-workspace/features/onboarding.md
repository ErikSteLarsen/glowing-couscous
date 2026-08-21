# Feature: Athlete Coach Discovery And Requests

- **ID:** `ONBOARD-001`
- **Status:** `shipped`
- **Last verified:** `2026-08-21`
- **Owner:** `lib/coach-request-service.ts`, `prisma/schema.prisma`, and athlete request-state reads in `lib/athlete-service.ts`
- **Related work:** [baseline](../history/2026-08-21-baseline.md), [product scope](../../../SPEC.md), [request task](../tasks/2026-08-21-coach-request-invariants.md)

## Contract

An athlete without an active coach can search coaches, send one pending request,
see pending/rejected state, reopen a rejected request, and wait for coach action.
A coach can list pending requests and accept or reject them.

## Live Path

- **Routes/UI:** `/athlete/find-coach`, `/athlete/profile`, `/api/coaches`,
  `/api/athlete/coach-requests`, `/api/coach/requests/*`.
- **Services:** `searchCoaches`, `createForAthlete`, `listForAthlete`,
  `listPendingForCoach`, `decideForCoach`.
- **Data:** `User.coachId`, `User.selfCoached`, `CoachRequest`.
- **Shared helpers/components:** `FindCoachClient`, `CoachRequestsPanel`, app navigation.

## Behavior Already Implemented

- Search is limited to coach users and ten results.
- An athlete cannot have multiple pending requests; another coach is rejected
  until the current request is resolved.
- Rejected requests can be reopened.
- Accepting a request updates the athlete relationship and clears self-coached mode.
- Resolved requests cannot be resolved again.
- Request creation verifies the caller is an athlete without an active coach;
  self-coached athletes remain eligible to request a coach.
- `CoachRequest.pendingAthleteId` is unique while pending, so concurrent requests
  resolve to one winner; resolved rows clear the key.
- Acceptance atomically connects the athlete, clears self-coached mode, and
  rejects competing pending requests.
- Coach and athlete request UIs display load/action failures and block duplicate
  in-flight actions.

## Verification

- Coach-request service, route, onboarding, and UI source tests pass in `pnpm test`
  on 2026-08-21 (99 tests).
- `pnpm lint && pnpm build` — pass on 2026-08-21.
- `pnpm db:push --accept-data-loss && pnpm db:seed` — pass on the disposable
  local SQLite database on 2026-08-21; the seeded pending row has its pending key.

## Known Gaps

- Messaging is explicitly not implemented; the UI says it is coming soon.
- Pending/rejected state presentation and cross-role navigation still need UX polish.

## Extension Rules

- Start lifecycle behavior in `lib/coach-request-service.ts`.
- Keep `/api/coaches`, athlete request routes, and coach request routes thin.
- Preserve the unique athlete/coach pair and one-pending-request rule.
