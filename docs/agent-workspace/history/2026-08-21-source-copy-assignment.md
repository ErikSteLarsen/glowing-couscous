# Source-Copy Assignment

- **Date:** 2026-08-21
- **Task:** `ASSIGN-001`
- **Status:** Shipped
- **Agent:** `opencode-assignment-2026-08-21`

## Changed

- Added explicit Assignment lineage through `sourceSessionId` and `targetDate`.
- Added unique `TrainingPlanAssignment` parent records for source plan, athlete,
  and Monday target week, with child Assignment lineage.
- Added `assignmentService.assignSourceToAthlete` for template, standalone
  library-session, and training-plan snapshot copies.
- Added library source ownership checks, copy idempotency, block snapshots, and
  training-plan weekday-to-date mapping.
- Extended the coach assignment API with the source union while preserving the
  legacy template request shape.
- Added focused source-copy tests and updated architecture/planner records.

## Verification

- `pnpm exec prisma validate` — pass.
- `pnpm db:push --force-reset` — pass on disposable local SQLite.
- `pnpm db:seed` — pass.
- `pnpm test` — pass, 106 tests.
- `pnpm lint` — pass.
- `pnpm build` — pass; existing Next.js middleware deprecation warning remains.
- `git diff --check` — pass.

## Follow-Up

- Expose library and training-plan source selection in the planner/template UI
  under `WORKFLOW-001`.
- Keep copied sessions independent; no live source synchronization is planned.
