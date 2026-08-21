# Planner And Template Workflows

- **Date:** 2026-08-21
- **Task:** `WORKFLOW-001`
- **Status:** Shipped
- **Agent:** `opencode-workflow-2026-08-21`

## Changed

- Added `SourceAssignmentPanel` to the active planner for template, library, and
  training-plan assignment through the unified backend command.
- Added athlete/date and Monday-week target controls plus target session previews.
- Added confirmation before resetting loaded planner drafts during workspace or
  training-plan changes.
- Added live template create/edit UI with Tempo block kind, zone, duration, and
  note fields, using the existing template APIs.
- Preserved `/coach/builder` as a tested compatibility redirect and kept legacy
  assignment logic out of active UI paths.
- Updated planner/template records and workflow regression assertions.

## Verification

- `pnpm test` — pass, 107 tests.
- `pnpm lint` — pass.
- `pnpm build` — pass; existing Next.js middleware deprecation warning remains.
- `git diff --check` — pass.

## Follow-Up

- Add browser-level interaction tests for assignment reuse, editor validation,
  and mode-switch confirmation when the test harness supports them.
