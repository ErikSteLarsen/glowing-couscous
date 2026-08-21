# Task: Make Completion And Activity Semantics Consistent

- **Status:** `planned`
- **Agent:** `<assigned agent>`
- **Created:** `2026-08-21`
- **Task ID:** `COMPLETION-002`
- **Feature IDs:** `COMPLETE-001`, `ATHLETE-001`, `PLAN-001`, `COMPAT-001`, `COVERAGE-001`
- **Related records:** [athlete feature](../features/athlete.md), [compatibility](../features/compatibility.md), [coverage](../features/coverage.md), [audit](2026-08-21-incompleteness-audit.md)
- **Dependencies:** Decide the completed-session edit policy before implementation. This task recommends completed sessions are immutable.

## Problem

The completion route derives Activity metrics from planned blocks, writes
`compliancePct: 100`, and presents those values as performed outcomes. Activity
history derives segments from the current mutable Session blocks. Planner edits
can replace blocks and reset Session status while leaving Activity intact. The
undo branch deletes Activity and loses notes after refresh. The route also uses
truthiness for untrusted `isDone` JSON.

Relevant files:

- `app/api/athlete/sessions/[sessionId]/completion/route.ts`
- `lib/athlete-service.ts`
- `lib/coach-service.ts`
- `lib/coach-planner-service.ts`
- `lib/planner-service.ts`
- `prisma/schema.prisma`
- `app/(app)/athlete/activity/page.tsx`
- `app/(app)/athlete/session/[sessionId]/SessionDetailClient.tsx`

## Design

Create a deep module at:

```text
lib/athlete-completion-service.ts
```

Recommended interface:

```ts
completeSession(athleteId, sessionId, { notes })
reopenSession(athleteId, sessionId, { notes })
```

The module owns ownership checks, command validation, note normalization,
metric-source semantics, transaction boundaries, idempotency, and domain
errors. The route should only authenticate, parse route/body input, call the
module, and serialize the result.

Use `Session.status` as the canonical lifecycle state and `Activity` as the
outcome record. For the current MVP, manual completion has no measured
performance. Recommended schema semantics:

- Add `Session.athleteNotes String?` so notes survive reopening.
- Add `Activity.metricsSource String` with a value such as `manual-planned`.
- Make `Activity.compliancePct` nullable, or introduce an explicit unavailable
  representation; never infer 100% from a completion click.
- Keep planned and performed values separate in athlete/coach read models.
- Make coach update/delete reject sessions with Activity using `409`, unless a
  later design adds immutable completed-session snapshots.
- Backfill seeded/current rows so Session status and Activity agree.

Do not add telemetry in this task. The system may retain planned duration/TSS as
an explicitly labeled estimate.

## Implementation Steps

1. Add failing service tests for ownership, strict commands, idempotent complete,
   reopen, note retention, no fabricated compliance, and transaction behavior.
2. Add a strict request parser that requires boolean `isDone` or exposes
   explicit complete/reopen commands, accepts only bounded string notes, and
   maps malformed JSON/fields to `400`.
3. Implement `athlete-completion-service.ts` with injected DB dependencies.
4. Apply the schema/data semantics and update seed data/read types.
5. Move all completion Prisma business logic out of the route.
6. Update `athlete-service.ts` and `coach-service.ts` to expose distinct planned
   and performed values and stable Activity segments.
7. Reject active and compatibility planner edits/deletes for completed sessions
   according to the chosen immutable policy.
8. Update the Session detail and Activity UI to label estimates and unavailable
   compliance accurately.
9. Update feature, coverage, compatibility, architecture, decision, and history records.

## Acceptance Criteria

- Malformed JSON, missing/non-boolean `isDone`, invalid notes, and invalid IDs return `400`.
- A non-owner receives `404` and cannot mutate another athlete's session.
- Completion is idempotent and never creates duplicate Activity rows.
- Manual completion does not create 100% compliance without performed data.
- Reopening follows the documented note-retention policy.
- Session status and Activity existence cannot disagree in normal writes.
- Completed sessions cannot be silently rewritten underneath Activity history.
- Activity history uses stored outcome data or explicitly labeled estimates rather than current mutable plan blocks.
- The completion route contains no direct Prisma business logic.
- Focused tests cross the completion module interface instead of only matching source strings.

## Verification

```bash
pnpm test -- --test-name-pattern="completion|activity|immutable|reopen"
pnpm lint
pnpm build
```

For schema changes, use the repository reset flow deliberately:

```bash
pnpm db:push
pnpm db:seed
pnpm test
pnpm lint
pnpm build
```
