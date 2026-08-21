# Task: Enforce Coach-Request Lifecycle Invariants

- **Status:** `completed`
- **Agent:** `opencode-request-2026-08-21`
- **Created:** `2026-08-21`
- **Task ID:** `REQUEST-002`
- **Feature IDs:** `ONBOARD-001`, `COVERAGE-001`
- **Related records:** [onboarding](../features/onboarding.md), [auth](../features/auth.md), [audit](2026-08-21-incompleteness-audit.md)
- **Dependencies:** Decide how the database enforces one pending request per athlete. Recommended: a nullable unique pending-athlete key on `CoachRequest`.
- **Completed:** 2026-08-21
- **Completion record:** [progress and verification](2026-08-21-coach-request-invariants-progress.md)
- **Decision:** [database-backed pending uniqueness](../decisions/0005-pending-coach-request-uniqueness.md)

## Problem

The request service handles normal sequential flows but does not verify that an
athlete is still eligible before creating a request. Two concurrent requests to
different coaches can both become pending because the schema only enforces a
unique athlete/coach pair. Acceptance does not resolve inconsistent competing
pending rows. Coach request UI failures are also silent.

Relevant files:

- `lib/coach-request-service.ts`
- `prisma/schema.prisma`
- `app/api/athlete/coach-requests/route.ts`
- `app/api/coach/requests/route.ts`
- `app/api/coach/requests/[requestId]/route.ts`
- `app/(app)/athlete/find-coach/FindCoachClient.tsx`
- `components/CoachRequestsPanel.tsx`
- `tests/`

## Design

Preserve the current request lifecycle and self-coached mode, but enforce
eligibility inside the module rather than relying on UI redirects. The service
must verify caller role and current coach relationship before creating a request.

For SQLite, add a nullable unique `pendingAthleteId` field to `CoachRequest`.
Set it to the athlete ID only while status is `PENDING`; set it back to null on
rejection/acceptance. Catch unique-constraint races and return a domain conflict.
This preserves request history and the existing unique `(athleteId, coachId)`
pair without requiring a database partial-index feature.

Acceptance should run in one transaction, set the athlete relationship, clear
self-coached mode, mark the chosen request accepted, and resolve all other
pending rows according to the chosen policy. Recommended policy: mark them
`REJECTED` with the selected accepted request remaining `ACCEPTED`.

## Implementation Steps

1. Add failing service/integration tests for already-coached athletes, non-athlete
   callers, concurrent requests, acceptance cleanup, reopening, and resolved requests.
2. Add the pending-key schema field and update seed/backfill behavior.
3. Implement atomic create/reopen/accept/reject transitions with injected DB dependencies.
4. Centralize strict positive-integer parsing for request IDs.
5. Surface list/action failures in `CoachRequestsPanel` and disable in-flight actions.
6. Preserve intentional messaging-coming-soon behavior.
7. Update onboarding, coverage, schema decision, and history records.

## Acceptance Criteria

- A non-athlete cannot create a request through the module or route.
- An athlete with an existing coach receives a conflict and no new request.
- Self-coached eligibility is explicit and tested.
- At most one pending request exists per athlete, including concurrent attempts.
- Acceptance atomically updates the athlete and resolves competing pending requests.
- Rejected requests can reopen; accepted/rejected requests cannot be resolved again.
- Invalid IDs produce `400`; ownership failures do not leak other users' requests.
- Coach UI displays load/action errors and prevents duplicate submissions.

## Verification

```bash
pnpm test -- --test-name-pattern="coach request|onboarding|request|concurrent"
pnpm lint
pnpm build
```

For schema changes:

```bash
pnpm db:push
pnpm db:seed
pnpm test
pnpm lint
pnpm build
```
