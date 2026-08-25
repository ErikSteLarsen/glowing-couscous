# Task: Persist Coach Baseline And Actual Snapshots

- **Status:** `completed`
- **Agent:** `OpenCode`
- **Started:** `2026-08-25`
- **Updated:** `2026-08-25`
- **Task ID:** `SESSION-SNAPSHOT-001`
- **Feature IDs:** `SESSION-ADJUST-001`, `DOMAIN-001`, `COMPLETE-001`
- **Dependencies:** `SESSION-EDIT-001`
- **Related records:** [decision 0010](../decisions/0010-session-adjustments-and-actual-outcomes.md), [session adjustments](../features/session-adjustments.md), [schema](../../../prisma/schema.prisma)

## Goal

Add durable persistence for the latest coach baseline and latest actual block
snapshot, plus coach/athlete notes and RPE, while keeping source assignments
independent.

## Starting Context

- Current behavior: `Session.blocks` is mutable planned content; `Activity`
  stores derived metrics, notes, and segments but not RPE or performed blocks.
- Existing owner/service: Prisma `Session`, `Block`, `Activity`,
  `lib/assignment-service.ts`.
- Related active or transitional work: `COMPLETION-002` currently treats
  completed session content as immutable; this task implements the explicit
  outcome-edit exception from decision 0010.

## Plan

- [x] Choose and document a durable schema representation for latest coach
  baseline and latest actual snapshots; keep it scoped to the assigned session.
- [x] Add RPE, separate coach/athlete notes, skipped-block state, and actual
  snapshot fields with bounded validation.
- [x] Ensure source/template IDs and other assignments do not create live sync
  behavior.
- [x] Add schema/service tests covering one-version equality, baseline changes,
  actual replacement, and template/source isolation.

## Progress Log

### 2026-08-25

- What changed: Claimed `SESSION-SNAPSHOT-001` after the canonical editor and
  editor migration checkpoints.
- Decision or discovery: Snapshot persistence must be scoped to the assigned
  `Session`; mutable planned blocks and completed Activity history must not be
  used as a live synchronization path for templates or source sessions.
- Files touched: This task and `WORK-INDEX.md`.
- Verification: Red tests not run yet; contract tests are next.
- Blocker or next step: Define the snapshot service boundary and schema contract
  in failing tests before implementing persistence.

### 2026-08-25

- What changed: Added latest-value coach baseline and actual snapshot persistence,
  source-copy baseline initialization, active coach planner baseline updates, and
  completion Activity actual payloads.
- Decision or discovery: `Session.coachBaselineJson` and
  `Activity.actualSnapshotJson` store complete canonical editor payloads. The
  explicit `rpe` and note columns support bounded access without introducing
  actual-version history in the first release.
- Files touched: `prisma/schema.prisma`, `lib/session-snapshot-service.ts`,
  `lib/assignment-service.ts`, `lib/coach-planner-service.ts`,
  `lib/athlete-completion-service.ts`, and focused service tests.
- Verification: Snapshot/assignment/completion focused tests passed (28 tests);
  `pnpm test` passed (134 tests); `pnpm db:push --force-reset && pnpm db:seed`,
  `pnpm exec prisma validate`, `pnpm lint`, and `pnpm build` passed. Build retains
  the existing middleware deprecation warning.
- Blocker or next step: Planned coach/athlete adjustment ownership and schedule
  semantics remain in `SESSION-PLAN-ADJUST-001`.

## Acceptance Criteria

- A session can show the latest coach baseline and latest actual independently.
- If no block or schedule difference exists, no second actual version is exposed.
- Replacing an actual updates the latest snapshot rather than creating actual
  history rows in the first release.
- Existing Activity history retains stored outcome values and does not derive
  old results from mutable current blocks.

## Verification

- `pnpm test -- --test-name-pattern="snapshot|activity|completion|assignment|template"`
- `pnpm db:push --force-reset && pnpm db:seed`
- `pnpm lint`
- `pnpm build`

## Handoff / Completion

- **Final status:** `completed`
- **History record:** [session snapshots](../history/2026-08-25-session-snapshots.md)
- **Feature records updated:** [session adjustments](../features/session-adjustments.md), [athlete](../features/athlete.md)
- **Remaining work:** Planned mutation and completion-edit services consume this
  persistence contract in the dependent tasks.
