# Feature: Compatibility Planner Path And Cleanup

- **IDs:** `COMPAT-001`, `CLEANUP-001`
- **Status:** `transitional`
- **Last verified:** `2026-08-21`
- **Owner:** `/api/coach/sessions/[sessionId]`, `lib/planner-service.ts`, `lib/planner.ts`, `lib/workout-spec.ts`
- **Related work:** [architecture cleanup plan](../../../docs/superpowers/plans/2026-06-23-architecture-cleanup.md), [baseline](../history/2026-08-21-baseline.md), [decision](../decisions/0002-active-vs-compat-planner.md), [hardening task](../tasks/2026-08-21-compatibility-docs.md)

## Contract

The older coach-session API remains live for compatibility. It accepts the old
draft shape, maps legacy block types into Tempo `Block` rows, preserves an
existing session's `adjusted` state, and allows owner-scoped update/delete.

## Live Path

- `/api/coach/sessions/[sessionId]` calls `coachService.hasAthlete`, then
  `plannerService.forWeek(...).execute(...)`.
- `planner-service.ts` uses `normalizeSessionDraft` and `validateSessionDraft`.
- `planner.ts` uses `workout-editor.ts` and `workout-spec.ts`.
- `components/WorkoutBlocksEditor.tsx` and several old athlete components are
  present but are not part of the active Tempo planner path.

## Verification

- Architecture source tests assert the compatibility adapter, fallback block
  duration, and adjusted-state preservation on 2026-08-21.
- Full `pnpm test`, lint, and build pass on 2026-08-21.

## Known Gaps

- The boundary is easy to misunderstand because both planner generations use
  similar names and models.
- Cross-week legacy edits can use the old week Plan with a new session date.
- The compatibility path does not currently verify private template ownership.
- The old builder client and comment-based source assertions are misleading.
- `ARCHITECTURE.md` and `docs/AI-HANDOFF.md` still describe the old planner as
  the primary owner in places.
- Reference analysis is needed before deleting old helpers/components.

## Extension Rules

- New planner capabilities belong in the active planner services, not here.
- Touch this path only for compatibility fixes or an explicit migration.
- Before cleanup, search all imports, route tests, persisted-data assumptions,
  and external consumers; record the removal decision and verification.
