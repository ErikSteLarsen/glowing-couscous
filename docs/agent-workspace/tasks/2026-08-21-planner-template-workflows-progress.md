# Task: Complete Planner And Template User Workflows

- **Status:** `completed`
- **Agent:** `opencode-workflow-2026-08-21`
- **Started:** `2026-08-21`
- **Updated:** `2026-08-21`
- **Feature IDs:** `WORKFLOW-001`, `PLAN-001`, `LIB-001`, `TPLAN-001`, `TEMPLATE-001`
- **Related records:** [planned task](2026-08-21-planner-template-workflows.md), [planner](../features/planner.md), [source assignment](2026-08-21-source-copy-assignment.md)

## Goal

Expose source-copy assignment and live template creation/editing in the active
coach UI without duplicating backend assignment logic or silently discarding drafts.

## Starting Context

- Current behavior: The planner has authoring modes but no source assignment
  controls; templates list/duplicate/delete only; builder redirects to planner.
- Existing owner/service: `PlannerClient`, `CoachTemplatesClient`, and the shipped
  `assignmentService.assignSourceToAthlete` command.
- Related active or transitional work: `ASSIGN-001` shipped the source union;
  legacy builder remains a compatibility redirect.

## Plan

- [x] Add source assignment controls, target preview, and mode-switch safety.
- [x] Add live template create/edit UI using Tempo block fields.
- [x] Add focused workflow source assertions and preserve builder compatibility.
- [x] Run full repository gates and update workspace records.
- [x] Commit the completed workflow task.

## Progress Log

### 2026-08-21

- What changed: Claimed `WORKFLOW-001`; added `SourceAssignmentPanel`, planner
  reset confirmation, and template create/edit editor.
- Decision or discovery: The UI calls the existing source-union assignment route;
  no assignment logic is duplicated in client code. Template editor posts the
  canonical service draft shape (`name`, `sport`, `summary`, `blocks`).
- Files touched: Planner client/panel, template client, workflow tests, and this record.
- Verification: Full prior gates pass; final workflow gates pass below.
- Blocker or next step: None for `WORKFLOW-001`.

### 2026-08-21

- What changed: Added planner source assignment panel with date/Monday-week
  previews, loaded-draft reset confirmations, and live template create/edit UI.
- Decision or discovery: Client code calls the unified assignment API and does
  not duplicate source-copy behavior; builder remains a compatibility redirect.
- Files touched: `PlannerClient`, `SourceAssignmentPanel`,
  `CoachTemplatesClient`, workflow tests, and workspace records.
- Verification: `pnpm test` passed with 107 tests; `pnpm lint`, `pnpm build`, and
  `git diff --check` passed. Build retains the existing middleware warning.
- Blocker or next step: None for this task.

## Verification

- `pnpm test` — pass, 107 tests, on 2026-08-21.
- `pnpm lint` — pass on 2026-08-21.
- `pnpm build` — pass on 2026-08-21; existing middleware deprecation warning.
- `git diff --check` — pass on 2026-08-21.

## Handoff / Completion

- **Final status:** `completed`
- **History record:** [2026-08-21 planner/template workflows](../history/2026-08-21-planner-template-workflows.md)
- **Feature records updated:** [planner](../features/planner.md), [templates](../features/templates.md), [current status](../CURRENT-STATUS.md)
- **Remaining work:** Browser E2E coverage remains a future improvement.
