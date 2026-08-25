# Session Snapshots

- **Date:** 2026-08-25
- **Task:** `SESSION-SNAPSHOT-001`
- **Status:** shipped

## Behavior

- Added `Session.coachBaselineJson`, `Session.coachNotes`, and `Session.rpe`.
- Added `Activity.actualSnapshotJson` and `Activity.rpe`.
- Added `lib/session-snapshot-service.ts` for canonical payload serialization,
  bounded validation, latest-value replacement, loading, and baseline/actual
  equality projection.
- Initialized independent coach baselines for template, library-session, and
  training-plan copies in `assignment-service` and for active coach planner saves.
- Completion now stores the complete latest actual payload on Activity on both
  first completion and idempotent replacement.
- No source/template synchronization or actual-version history was introduced.

## Files

- `prisma/schema.prisma`
- `lib/session-snapshot-service.ts`
- `lib/assignment-service.ts`
- `lib/coach-planner-service.ts`
- `lib/athlete-completion-service.ts`
- `tests/session-snapshot.test.ts`
- `tests/athlete-completion-service.test.ts`
- `tests/coach-builder-assignment.test.ts`
- `tests/coach-planner-service.test.ts`
- `tests/source-copy-assignment.test.ts`

## Verification

- `node --experimental-strip-types --test tests/session-snapshot.test.ts tests/athlete-completion-service.test.ts tests/coach-builder-assignment.test.ts tests/coach-planner-service.test.ts tests/source-copy-assignment.test.ts` — 28 passing tests.
- `pnpm test` — 134 passing tests.
- `pnpm db:push --force-reset && pnpm db:seed` — pass.
- `pnpm exec prisma validate` — pass.
- `pnpm lint` — pass.
- `pnpm build` — pass; existing middleware deprecation warning remains.

## Follow-up

- `SESSION-PLAN-ADJUST-001` must consume this persistence contract for planned
  coach/athlete ownership, adjusted status, and schedule rules.
- Browser viewport and keyboard/focus inspection was not performed in this task;
  no UI surface changed.
