# Workspace information architecture

- **Date:** `2026-09-07`
- **Task:** [workspace information architecture](../tasks/2026-09-07-workspace-information-architecture.md)
- **Feature IDs:** `SHELL-001`, `PLAN-001`, `LIB-001`, `TPLAN-001`, `TEMPLATE-001`, `ATHLETE-001`

## Changed

- Added `/coach/workouts` and a shared standalone Workout Library client for
  coaches and athletes.
- Added owner-scoped workout library API routes for both roles. Standalone
  workouts persist without a date, Plan, or TrainingPlan and can be edited or
  deleted within the owner boundary.
- Connected athlete saved workouts to Planner so selecting a library workout
  creates dated copies while leaving the unassigned source intact.
- Reordered and clarified the role-aware sidebar around Workouts, Planner, and
  Templates. Mobile navigation now prioritizes those core jobs.
- Added purpose labels to the sidebar so the three authoring/scheduling
  destinations and athlete Calendar relationship are visible without duplicating
  navigation inside each page.
- Refocused coach Planner copy and mode presentation on athlete/date assignment;
  the compatibility multi-mode workspace remains available in the component but
  is no longer the primary entry point.
- Added template cadence persistence and UI labels for single-day, week, and
  month structures, plus a guided path from Workouts into Templates and from
  Templates into Planner.
- Clarified athlete Workouts by separating private unassigned workouts from
  already scheduled sessions, and clarified Calendar and Activity descriptions.

## Files

- `lib/app-navigation.ts`, `components/AppSidebar.tsx`
- `components/WorkoutLibraryClient.tsx`, `lib/workout-library-service.ts`,
  `lib/template-cadence.ts`
- `app/(app)/coach/workouts/page.tsx`, athlete/coach workspace pages, and new
  workout API routes
- `prisma/schema.prisma`, `lib/template-service.ts`

## Verification

- `pnpm test` — 170 passing tests on 2026-09-07.
- `pnpm lint` — pass on 2026-09-07.
- `pnpm build` — pass on 2026-09-07; existing middleware deprecation warning remains.
- `git diff --check` — pass on 2026-09-07.
- Impeccable detector — no findings on the changed UI targets.

## Follow-up

- Add browser acceptance coverage for standalone workout creation/edit/delete,
  template cadence assignment, and narrow/wide layouts.
- Introduce a first-class month-level source/assignment model before presenting
  month cadence as a fully automated assignment workflow.
