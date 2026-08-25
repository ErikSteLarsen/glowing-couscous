# Feature: Session Adjustments And Actual Outcomes

- **ID:** `SESSION-ADJUST-001`
- **Status:** `in-progress`
- **Last verified:** `2026-08-25` (canonical editor and durable snapshots implemented and verified)
- **Owners:** `lib/session-editor.ts`, `lib/session-snapshot-service.ts`, planned session adjustment service, and completion/outcome service
- **Related work:** [canonical editor task](../tasks/2026-08-25-canonical-session-editor.md), [snapshot task](../tasks/2026-08-25-session-snapshots.md), [decision 0010](../decisions/0010-session-adjustments-and-actual-outcomes.md), [planner](planner.md), [templates](templates.md), [athlete](athlete.md), [workout domain](workout-domain.md)

## Contract

Each assigned athlete session is an independent snapshot of its source. A coach
baseline is the latest coach-authored version for that session. Before
completion, an athlete may adjust only that scheduled session and a coach may
overwrite its plan. After completion, the current session is the latest actual
version and either role may correct it directly. The template/source and other
assigned sessions are never changed by these edits.

The canonical editor supports create, planned, and actual modes with all session
fields, full block structure, skipped blocks, separate coach/athlete notes, and
optional 1-10 RPE. Planned saves and completion are separate. Completed actual
corrections save immediately and recompute derived metrics.

## Planned Live Path

- **Coach editor:** `/coach/planner` and `/coach/templates`
- **Athlete editor:** `/athlete/session/[sessionId]` and Activity entries
- **Services:** planned mutation service, `lib/athlete-completion-service.ts`, and source-copy `lib/assignment-service.ts`
- **Data:** `Session`, `Block`, `Activity`, `Assignment`, and durable coach/actual snapshots
- **Comparison:** session detail and Activity dialog for both coach and athlete

## Current Gaps

- The active coach planner and template editors now share
  `components/SessionComposer.tsx` and canonical draft adapters; athlete
  editing remains future work.
- `components/WorkoutBlocksEditor.tsx` uses a legacy block contract.
- `Session` and `Activity` now retain the latest baseline/actual payloads, but
  completed actuals cannot currently be edited directly.
- Completed sessions are currently immutable through planner paths, and the
  current reopen flow deletes the Activity outcome.

## Implemented Contract

- `lib/session-editor.ts` supports `create`, `planned`, and `actual` modes,
  empty or persisted initialization, all current session metadata, separate
  coach/athlete notes, optional integer RPE, schedule editing, and immutable
  block operations.
- Blocks use the active Tempo `kind`, zone, duration, repetitions, nested target,
  note, and explicit `skipped` fields. Serialization flattens targets into the
  existing persistence shape and preserves skipped blocks.
- Skipped blocks are excluded from `deriveSessionEditorMetrics`; status is
  retained by field, schedule, and block operations.
- `hasBaselineActualDifference` compares only schedule and block content. Title,
  sport, summary, notes, sport metrics, and RPE alone do not create a difference.
- `SESSION-EDITOR-MIGRATION-001` wires the canonical contract into the coach
  planner and template flows without changing route/service ownership rules.
- `SESSION-SNAPSHOT-001` stores the complete latest coach baseline on the
  assigned Session and the complete latest actual on Activity, with explicit
  RPE/note columns and no actual-version history.

## Verification

- `tests/session-editor.test.ts`, `tests/session-snapshot.test.ts`, and the
  assignment/completion service tests cover the editor and snapshot boundaries.
- `pnpm test` — 134 passing tests on 2026-08-25.
- `pnpm db:push --force-reset && pnpm db:seed`, `pnpm lint`, and `pnpm build`
  pass on 2026-08-25; build retains the existing middleware deprecation warning.

## Extension Rules

- Do not add synchronization from templates or reusable source sessions into
  existing athlete assignments.
- Keep current source-copy lineage and one-session assignment semantics.
- Keep baseline/actual persistence separate from mutable source content and
  recompute outcome metrics from the latest actual blocks.
- Keep API handlers thin; ownership and lifecycle rules belong in services.
