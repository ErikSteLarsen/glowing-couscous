# Task: Implement Source-Copy Assignment

- **Status:** `completed`
- **Agent:** `opencode-assignment-2026-08-21`
- **Started:** `2026-08-21`
- **Updated:** `2026-08-21`
- **Feature IDs:** `ASSIGN-001`, `PLAN-001`, `LIB-001`, `TPLAN-001`, `TEMPLATE-001`, `COVERAGE-001`
- **Related records:** [planned task](2026-08-21-source-copy-assignment.md), [planner](../features/planner.md), [templates](../features/templates.md), [lineage decision](../decisions/0007-source-copy-lineage.md)

## Goal

Provide one coach-owned source-copy assignment command for templates, standalone
library sessions, and reusable training plans with ownership, snapshot, and
idempotency guarantees.

## Starting Context

- Current behavior: Templates can be assigned through `assignment-service`; library
  sessions and training plans have authoring CRUD but no copy-to-athlete command.
- Existing owner/service: `lib/assignment-service.ts`; source authoring remains in
  coach planner, library, and training-plan services.
- Related active or transitional work: `WORKFLOW-001` depends on this command
  contract; compatibility planner code must not gain source-copy behavior.

## Plan

- [x] Add explicit source lineage and training-plan parent schema relations.
- [x] Add focused tests for each source, ownership, snapshot independence, and idempotency.
- [x] Implement the unified assignment service command and route contract.
- [x] Verify schema reset/seed and repository gates.
- [x] Update workspace records and commit the completed task.

## Progress Log

### 2026-08-21

- What changed: Claimed `ASSIGN-001` after completion integrity shipped.
- Decision or discovery: Existing `Assignment` can carry explicit library source
  session and target-date lineage; training plans need a unique parent assignment
  model with child Assignment rows.
- Files touched: This progress record and `WORK-INDEX.md`.
- Verification: Prior baseline gates pass; assignment implementation not started.
- Blocker or next step: Add schema relations and inspect generated Prisma contracts.

### 2026-08-21

- What changed: Added `Assignment` source-session/target-date lineage,
  `TrainingPlanAssignment` parent records, unified source dispatch, library
  snapshots, training-plan weekday copies, and source-union API parsing.
- Decision or discovery: Source copies are snapshots with explicit foreign-key
  lineage under [decision 0007](../decisions/0007-source-copy-lineage.md).
- Files touched: `prisma/schema.prisma`, `lib/assignment-service.ts`, assignment
  route, source tests, seed/schema records, and workspace documentation.
- Verification: Focused source tests pass; schema reset/seed, full tests (106),
  lint, build, and diff checks pass. Build retains the existing middleware warning.
- Blocker or next step: None for `ASSIGN-001`; UI exposure is `WORKFLOW-001`.

## Verification

- `pnpm exec prisma validate` — pass on 2026-08-21.
- `pnpm db:push --force-reset` — pass on disposable local SQLite.
- `pnpm db:seed` — pass on 2026-08-21.
- `pnpm test` — pass, 106 tests, on 2026-08-21.
- `pnpm lint` — pass on 2026-08-21.
- `pnpm build` — pass on 2026-08-21; existing middleware deprecation warning.
- `git diff --check` — pass on 2026-08-21.

## Handoff / Completion

- **Final status:** `completed`
- **History record:** [2026-08-21 source-copy assignment](../history/2026-08-21-source-copy-assignment.md)
- **Feature records updated:** [planner](../features/planner.md), [current status](../CURRENT-STATUS.md), [architecture](../../../ARCHITECTURE.md), [handoff](../../AI-HANDOFF.md)
- **Remaining work:** Expose library/training-plan sources in the planner UI under `WORKFLOW-001`.
