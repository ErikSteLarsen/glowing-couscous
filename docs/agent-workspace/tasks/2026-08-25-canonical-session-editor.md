# Task: Build Canonical Session Editor Contract

- **Status:** `completed`
- **Agent:** `OpenCode`
- **Started:** `2026-08-25`
- **Updated:** `2026-08-25`
- **Task ID:** `SESSION-EDIT-001`
- **Feature IDs:** `SESSION-ADJUST-001`, `DOMAIN-001`
- **Dependencies:** None
- **Related records:** [session adjustments](../features/session-adjustments.md), [decision 0010](../decisions/0010-session-adjustments-and-actual-outcomes.md), [planner](../features/planner.md)

## Goal

Create a framework-independent canonical session draft/editor contract for
empty creation, planned edits, and actual-outcome edits. It must support all
session fields, full block structure, explicit skipped blocks, coach/athlete
notes, and optional 1-10 RPE without duplicating draft normalization logic.

## Starting Context

- Current behavior: Tempo draft shaping is in `lib/planner-draft.ts`; the active
  editor is embedded in `app/(app)/coach/planner/PlannerClient.tsx`; the older
  `components/WorkoutBlocksEditor.tsx` uses a legacy contract.
- Existing owner/service: `lib/planner-draft.ts`, `lib/session-math.ts`,
  `lib/tempo-blocks.ts`.
- Related active or transitional work: Do not extend `COMPAT-001` for this
  contract; preserve legacy adapters until reference analysis is complete.

## Plan

- [x] Define a new pure session-editor draft type with `create`, `planned`, and
  `actual` modes and explicit skipped-block representation.
- [x] Implement normalization, validation, serialization, block add/remove/
  reorder/update, and baseline-vs-actual comparison identity rules.
- [x] Add focused unit tests for empty drafts, all editable fields, skipped
  blocks, invalid durations/targets, schedule changes, RPE bounds, and the rule
  that only block or schedule changes create an actual-version difference.

## Progress Log

### 2026-08-25

- What changed: Claimed `SESSION-EDIT-001` and began the red test phase.
- Decision or discovery: The canonical module will be a pure `lib/session-editor.ts` boundary over Tempo blocks; planner and legacy drafts remain unchanged in this task.
- Files touched: This task record and `WORK-INDEX.md`.
- Verification: Tests not run yet; focused tests are next.
- Blocker or next step: Define the public draft, persisted-record, and operation seams in unit tests before implementation.

### 2026-08-25

- What changed: Added `lib/session-editor.ts` and focused contract tests covering initialization, field/schedule/block editing, skipped blocks, validation, serialization, Tempo metrics, and difference identity.
- Decision or discovery: Draft targets are nested for editor ergonomics and flattened to the existing persistence shape; skipped blocks remain in serialized content but are excluded from derived metrics. Status is preserved by every editor operation.
- Files touched: `lib/session-editor.ts`, `tests/session-editor.test.ts`, and the workspace records listed below.
- Verification: The requested focused-test command passed with 124 tests executed; `pnpm test` passed with 124 tests; `pnpm lint` passed; `pnpm build` passed with the existing middleware deprecation warning.
- Blocker or next step: Migrate active planner/template/athlete editors in `SESSION-EDITOR-MIGRATION-001`; persistence and outcome work remain separate tasks.

## Acceptance Criteria

- No React, Prisma, Next.js, or route imports in the pure contract module.
- The same draft contract can initialize from empty data or a persisted session.
- Existing `session-math` inputs remain compatible with non-skipped blocks.
- Planned and actual modes do not silently change status; callers decide when to
  save or complete.

## Verification

- `pnpm test -- --test-name-pattern="session editor|planner draft|session math"` — pass, 124 tests, 2026-08-25
- `pnpm lint` — pass, 2026-08-25
- `pnpm test` — pass, 124 tests, 2026-08-25
- `pnpm build` — pass; existing middleware deprecation warning, 2026-08-25

## Handoff / Completion

- **Final status:** `completed`
- **History record:** [canonical session editor](../history/2026-08-25-canonical-session-editor.md)
- **Feature records updated:** [session adjustments](../features/session-adjustments.md), [workout domain](../features/workout-domain.md)
- **Remaining work:** Migrate active planner/template/athlete UIs in `SESSION-EDITOR-MIGRATION-001`.
