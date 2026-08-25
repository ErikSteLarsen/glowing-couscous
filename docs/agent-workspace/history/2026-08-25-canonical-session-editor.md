# Canonical Session Editor

- **Date:** 2026-08-25
- **Agent:** OpenCode
- **Feature IDs:** `SESSION-EDIT-001`, `SESSION-ADJUST-001`, `DOMAIN-001`
- **Task:** [canonical session editor](../tasks/2026-08-25-canonical-session-editor.md)

## Files

- `lib/session-editor.ts`
- `tests/session-editor.test.ts`
- `docs/agent-workspace/features/session-adjustments.md`
- `docs/agent-workspace/features/workout-domain.md`
- `docs/agent-workspace/decisions/0010-session-adjustments-and-actual-outcomes.md`
- `docs/agent-workspace/WORK-INDEX.md`

## Behavior

Added a framework-independent canonical session editor contract for `create`,
`planned`, and `actual` modes. It initializes empty or persisted sessions,
retains all current session metadata, supports separate coach/athlete notes and
optional 1-10 RPE, edits schedules, and provides immutable block add/update/
remove/reorder operations. Blocks carry Tempo kind, zone, duration, repetitions,
targets, notes, and an explicit skipped flag.

Normalization and validation cover session fields, dates, weekdays, durations,
repetitions, target ranges, and RPE. Serialization preserves skipped blocks and
flattens nested targets for the existing persistence shape. Tempo projections
exclude skipped blocks. Baseline/actual difference identity includes only ordered
block content and schedule; title, sport, summary, notes, sport metrics, and RPE
alone do not create a difference. Editor operations preserve session status.

## Verification

- `pnpm test -- --test-name-pattern="session editor|planner draft|session math"` — pass, 124 tests
- `pnpm test` — pass, 124 tests
- `pnpm lint` — pass
- `pnpm build` — pass; existing middleware deprecation warning remains
- `git diff --check` — pass

## Follow-Up

The active planner and template editors still use their existing draft shapes.
Migration, persistence snapshots, planned adjustments, actual-outcome editing,
and comparison UI remain in their dependency-ordered tasks.
