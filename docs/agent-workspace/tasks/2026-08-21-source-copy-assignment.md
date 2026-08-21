# Task: Implement Source-Copy Assignment

- **Status:** `planned`
- **Agent:** `<assigned agent>`
- **Created:** `2026-08-21`
- **Task ID:** `ASSIGN-001`
- **Feature IDs:** `PLAN-001`, `LIB-001`, `TPLAN-001`, `TEMPLATE-001`, `COVERAGE-001`
- **Related records:** [planner](../features/planner.md), [templates](../features/templates.md), [audit](2026-08-21-incompleteness-audit.md)
- **Dependencies:** None for the backend. The planner/template UI task depends on this task's command contract.

## Problem

The repository supports authoring templates, standalone library sessions, and
training plans, but only template assignment exists and its old UI is
unreachable. Library sessions and training plans cannot be copied into an
athlete schedule. The active planner can create athlete sessions directly but
does not provide one consistent source-copy command or deduplication policy.

Relevant files:

- `lib/assignment-service.ts`
- `lib/coach-planner-service.ts`
- `lib/coach-session-library-service.ts`
- `lib/coach-training-plan-service.ts`
- `app/api/coach/assignments/route.ts`
- `prisma/schema.prisma`
- `tests/coach-builder-assignment.test.ts`
- `tests/coach-session-library-service.test.ts`
- `tests/coach-training-plan-service.test.ts`

## Design

Deepen the assignment module behind one source union:

```ts
type AssignmentSource =
  | { kind: 'template'; templateId: number }
  | { kind: 'library-session'; sessionId: number }
  | { kind: 'training-plan'; trainingPlanId: number };

type AssignSourceCommand = {
  coachId: number;
  athleteId: number;
  source: AssignmentSource;
  scheduledDate?: string;
  weekStart?: string;
};
```

The module must verify coach ownership and roster membership, snapshot title,
summary, sport, metrics, and blocks, create/reuse the athlete week `Plan`, and
write resulting athlete `Session` and `Assignment` records in one transaction.
Sources are copied, never live-synced.

For training plans, add a first-class assignment record such as
`TrainingPlanAssignment` with `trainingPlanId`, `athleteId`, target Monday
`weekStart`, `assignedBy`, and `assignedAt`. Enforce uniqueness for the same
source, athlete, and target week. For library lineage, use an explicit nullable
foreign key or assignment-source record; do not use an unreferenced polymorphic
`sourceType/sourceId` pair that loses database integrity.

Preserve template assignment behavior, but make the active planner and API use
this same module so duplicate-prevention semantics do not diverge.

## Implementation Steps

1. Write failing tests for each source kind, ownership failure, source immutability,
   copy independence, idempotency, transaction writes, and training-plan weekday mapping.
2. Add the smallest explicit schema lineage/parent assignment model needed for
   idempotent library and training-plan assignment.
3. Implement a single source-copy command module with injected DB dependencies.
4. Keep existing service modules focused on authoring; adapt their source records
   into the assignment module rather than duplicating copy logic.
5. Add a coach-only route contract that accepts the source union and returns
   created/reused session IDs plus a summary.
6. Verify template ownership at the assignment boundary.
7. Update feature, schema, architecture, decision, and history records.

## Acceptance Criteria

- Template assignment preserves current behavior and deduplicates the same source/athlete/date.
- Library-session assignment validates standalone coach ownership, accepts an
  athlete and date, copies blocks, leaves the source unchanged, and is idempotent.
- Training-plan assignment accepts a Monday target week, maps weekday 1-7 to
  dates, copies every plan session, creates/reuses the athlete week Plan, and
  records a parent assignment plus per-session assignments.
- Copied sessions can be edited independently and source edits do not mutate them.
- All writes are transactional and all APIs use `requireCoach`.
- Foreign sources and foreign athletes cannot be assigned.
- No assignment logic is added to the old compatibility planner module.

## Verification

```bash
pnpm test -- --test-name-pattern="assignment|source|training plan|library"
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
