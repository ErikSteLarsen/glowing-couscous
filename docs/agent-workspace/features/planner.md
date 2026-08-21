# Feature: Coach Planner, Session Library, And Training Plans

- **IDs:** `PLAN-001`, `LIB-001`, `TPLAN-001`
- **Status:** `shipped`
- **Last verified:** `2026-08-21`
- **Owners:** `lib/coach-planner-service.ts`, `lib/coach-session-library-service.ts`, `lib/coach-training-plan-service.ts`
- **Related work:** [architecture](../../../ARCHITECTURE.md), [baseline](../history/2026-08-21-baseline.md), [planner history](../../../docs/superpowers/plans/2026-06-23-coach-planner.md), [source assignment task](../tasks/2026-08-21-source-copy-assignment.md), [workflow task](../tasks/2026-08-21-planner-template-workflows.md)

## Contract

Coaches use one planner workspace to create or edit athlete sessions, create
standalone coach-owned sessions, create reusable weekday training plans, and
load shared templates into drafts. Athlete sessions are date-based; training
plan sessions are weekday-based; standalone library sessions are date-based
and have no athlete.

## Live Path

- **Routes/UI:** `/coach/planner`, compatibility redirect `/coach/builder`,
  `/api/coach/planner/sessions/*`, `/api/coach/planner/library-sessions/*`,
  `/api/coach/planner/training-plans/*`.
- **Services:** `coachPlannerService`, `coachSessionLibraryService`,
  `coachTrainingPlanService`.
- **Data:** `Session` ownership fields, `TrainingPlan`, `Plan`, `Block`, `Assignment`.
- **Shared helpers/components:** `planner-draft`, `session-math`, `SessionBlockBar`,
  `WorkoutBlocksEditor` only for the older draft shape.

## Behavior Already Implemented

- Workspace loads athletes, templates, library sessions, training plans, and a
  Monday-first visible athlete week in parallel.
- Planner supports library, training-plan, and athlete modes.
- Draft validation handles ownership mode, dates/weekdays, sport, title, blocks,
  durations, and target ranges.
- Coach ownership is checked for every command; update/delete paths return 404
  for records outside that ownership boundary.
- Session block replacement uses a transaction that deletes old blocks and writes the new ordered set.
- Athlete scheduling creates or reuses a week `Plan` and upserts an `Assignment`.
- `assignmentService.assignSourceToAthlete` snapshots templates, standalone
  library sessions, and training plans through one coach-owned command.
- Library copies retain explicit source Session/target-date lineage; training
  plan copies retain a unique source/athlete/Monday-week parent and child rows.
- Repeated source assignment reuses the existing lineage rather than creating
  duplicate athlete sessions.

## Verification

- Planner, draft, library, training-plan, assignment, and route/source tests pass in `pnpm test` on 2026-08-21.
- `pnpm lint && pnpm build` — pass on 2026-08-21.
- `pnpm db:push --force-reset && pnpm db:seed` — pass on the disposable local
  SQLite database on 2026-08-21.

## Known Gaps

- The active template UI has no create/edit editor, and the old builder client
  is unreachable behind a redirect.
- The active planner/template UI does not yet expose all source kinds; that is
  tracked by `WORKFLOW-001`.
- Several planner API handlers parse numeric IDs with `Number()` without a
  shared positive-integer helper; preserve the existing behavior unless fixing it deliberately.
- Runtime validation accepts any non-null `planWeekday` value from untrusted
  JSON; a future hardening change should enforce the 1-7 range at the service boundary.
- Do not assume a checked item in an old plan means the current implementation
  is incomplete; verify live code first.

## Extension Rules

- Start new athlete planner behavior in `coach-planner-service.ts`.
- Start standalone-library behavior in `coach-session-library-service.ts`.
- Start reusable-plan behavior in `coach-training-plan-service.ts`.
- Start source copying in `assignment-service.ts`; source authoring services
  should not duplicate copy logic.
- Reuse `planner-draft.ts`, `workout-spec` only for the compatibility shape,
  and `session-math.ts`; keep API routes thin.
- Preserve Monday week boundaries and distinct ownership modes.
