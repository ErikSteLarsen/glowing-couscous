# Workspace Information Architecture Audit

- **Date:** 2026-09-07
- **Feature IDs:** `SHELL-001`, `PLAN-001`, `LIB-001`, `TEMPLATE-001`, `ATHLETE-001`
- **Task:** [workspace information architecture](../tasks/2026-09-07-workspace-information-architecture.md)

## What changed

Audited the recent Workouts, Planner, Templates, and workspace navigation changes
and fixed the verified technical and UX gaps:

- Standalone workout queries and update/delete ownership checks now require a
  null date, Plan, and TrainingPlan, so scheduled records cannot masquerade as
  library sources.
- Workout library saves validate that a referenced template belongs to the same
  owner before writing the Session relation.
- Template cadence input rejects unsupported values while preserving the `day`
  fallback for legacy records.
- Workout and template destructive actions require confirmation; network errors
  now produce actionable status text.
- Workspace navigation links have touch-sized targets, template filtering and
  async feedback are announced accessibly, and the focused coach Planner shows a
  useful no-roster state instead of an unsaveable editor.
- Switching an athlete Planner from a saved workout back to a blank draft no
  longer discards the other selected dates.

## Files

- `lib/workout-library-service.ts`
- `lib/template-service.ts`
- `components/WorkoutLibraryClient.tsx`
- `components/WorkspaceNav.tsx`
- `app/(app)/athlete/planner/AthletePlannerClient.tsx`
- `app/(app)/athlete/workouts/page.tsx`
- `app/(app)/coach/planner/PlannerClient.tsx`
- `app/(app)/coach/templates/CoachTemplatesClient.tsx`
- `tests/workout-library-service.test.ts`
- `tests/template-service.test.ts`

## Verification

- `pnpm test` — 175 passing tests.
- `pnpm lint` — pass.
- `pnpm build` — pass; Next.js still reports the existing middleware-to-proxy
  deprecation warning.
- `git diff --check` — pass.
- Impeccable detector — no findings.

## Follow-up

Manual browser acceptance of create/edit/delete, responsive layouts, keyboard
focus, and the new empty/error states remains outstanding because no
browser-capable tool is available in this environment.
