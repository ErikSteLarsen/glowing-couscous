# Task: Migrate Planner And Template Editors

- **Status:** `completed`
- **Agent:** `OpenCode`
- **Started:** `2026-08-25`
- **Updated:** `2026-08-25`
- **Task ID:** `SESSION-EDITOR-MIGRATION-001`
- **Feature IDs:** `SESSION-ADJUST-001`, `PLAN-001`, `LIB-001`, `TPLAN-001`, `TEMPLATE-001`
- **Dependencies:** `SESSION-EDIT-001`
- **Related records:** [planner](../features/planner.md), [templates](../features/templates.md), [session adjustments](../features/session-adjustments.md)

## Goal

Adopt the canonical session editor in the active coach planner and template
library so create/edit behavior has one source of truth.

## Starting Context

- Current behavior: `/coach/planner` owns a large inline Tempo editor;
  `/coach/templates` has its own live template editing path; `/coach/builder`
  redirects to the planner.
- Existing owner/service: `PlannerClient`, `CoachTemplatesClient`,
  `lib/coach-planner-service.ts`, `lib/template-service.ts`.
- Related active or transitional work: `components/WorkoutBlocksEditor.tsx`
  is a legacy contract and must not become the canonical implementation.

## Plan

- [x] Extract a reusable `SessionComposer`/equivalent client component around
  the new contract without duplicating block controls.
- [x] Migrate planner library, training-plan, athlete, and template create/edit
  flows while preserving ownership modes and source assignment behavior.
- [x] Keep `/coach/builder` redirect behavior unchanged and remove only dead
  references proven unused.
- [x] Add UI/source tests for empty create, persisted edit initialization,
  skipped blocks, full block structure, and mode-switch draft safety.

## Progress Log

### 2026-08-25

- What changed: Claimed the migration task and added red boundary tests for planner ownership adapters, template serialization, and shared editor usage.
- Decision or discovery: `PlannerClient` retains ownership/workspace state in a small adapter wrapper; both live editors use the canonical `SessionEditorDraft` through `SessionComposer`. Existing service payloads remain compatibility shapes until persistence work adds skipped/RPE/note storage.
- Files touched: `lib/session-editor-adapters.ts`, `components/SessionComposer.tsx`, `tests/session-editor-migration.test.ts`, and the active planner/template clients.
- Verification: Adapter tests passed after the adapter implementation; source test initially failed until both clients were migrated.
- Blocker or next step: Finish the full test/lint/build verification and record the migration completion.

### 2026-08-25

- What changed: Added the shared `SessionComposer`, migrated `PlannerClient` and `CoachTemplatesClient` to canonical session drafts, and added planner/template compatibility adapters.
- Decision or discovery: Workspace ownership and source-template context remain outside the generic draft. Existing service payloads are produced by adapters, so route/service ownership and assignment behavior remain unchanged.
- Files touched: `components/SessionComposer.tsx`, `lib/session-editor-adapters.ts`, both live coach editor clients, migration tests, and workspace records.
- Verification: `pnpm test` passed with 127 tests; the requested planner/template/assignment/builder/session-editor command passed; `pnpm lint`, `pnpm build`, and `git diff --check` passed. Build retains the existing middleware deprecation warning.
- Blocker or next step: Snapshot/persistence work must add durable skipped-block, RPE, and separate coach/athlete note storage before those fields can round-trip through existing APIs.

## Acceptance Criteria

- Coach planner and template editor use the same editor component and draft
  normalization.
- Template edits remain private to the coach and never mutate assigned sessions.
- Existing source assignment, duplicate prevention, Monday-week behavior, and
  ownership checks still pass.
- No active route depends on the legacy `WorkoutBlocksEditor` contract.

## Verification

- `pnpm test -- --test-name-pattern="planner|template|assignment|builder|session editor"` — pass, 127 tests executed, 2026-08-25
- `pnpm test` — pass, 127 tests, 2026-08-25
- `pnpm lint` — pass, 2026-08-25
- `pnpm build` — pass; existing middleware deprecation warning, 2026-08-25
- `git diff --check` — pass, 2026-08-25

## Handoff / Completion

- **Final status:** `completed`
- **History record:** [editor migration](../history/2026-08-25-editor-migration.md)
- **Feature records updated:** [planner](../features/planner.md), [templates](../features/templates.md), [session adjustments](../features/session-adjustments.md)
- **Remaining work:** Durable snapshots and athlete mutation work are still required for actual mode persistence; existing APIs do not yet persist skipped blocks, RPE, or separate coach notes.
