# Planner And Template Editor Migration

- **Date:** 2026-08-25
- **Agent:** OpenCode
- **Feature IDs:** `SESSION-EDITOR-MIGRATION-001`, `SESSION-ADJUST-001`, `PLAN-001`, `LIB-001`, `TPLAN-001`, `TEMPLATE-001`
- **Task:** [editor migration](../tasks/2026-08-25-editor-migration.md)

## Files

- `components/SessionComposer.tsx`
- `lib/session-editor-adapters.ts`
- `app/(app)/coach/planner/PlannerClient.tsx`
- `app/(app)/coach/templates/CoachTemplatesClient.tsx`
- `tests/session-editor-migration.test.ts`
- `tests/coach-planner-service.test.ts`

## Behavior

The active coach planner and template editor now use the canonical
`SessionEditorDraft` through a shared `SessionComposer`. The composer owns common
session fields, Tempo block editing, drag reorder, targets, repetitions, notes,
skipped state, block duplication/removal, and derived metrics. Planner adapters
retain workspace ownership modes, schedule semantics, and source-template
context while serializing the existing planner API payloads. Template adapters
map canonical title and blocks to the existing private template payload.

`/coach/builder` remains the existing redirect to `/coach/planner`, source
assignment and duplicate-prevention behavior remains service-owned, and the
legacy `WorkoutBlocksEditor` contract is not used by these active paths.

Current persistence APIs do not yet store skipped state, RPE, or separate
coach/athlete notes. Durable round-tripping for those fields remains part of the
snapshot/persistence work and was intentionally not added here.

## Verification

- `pnpm test -- --test-name-pattern="planner|template|assignment|builder|session editor"` — pass, 127 tests executed
- `pnpm test` — pass, 127 tests
- `pnpm lint` — pass
- `pnpm build` — pass; existing middleware deprecation warning remains
- `git diff --check` — pass

## Follow-Up

Implement `SESSION-SNAPSHOT-001` next. It can add durable coach-baseline and
actual snapshots without changing the shared editor boundary.
