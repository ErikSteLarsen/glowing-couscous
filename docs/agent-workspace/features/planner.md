# Feature: Coach Planner, Session Library, And Training Plans

- **IDs:** `PLAN-001`, `LIB-001`, `TPLAN-001`
- **Status:** `shipped`
- **Last verified:** `2026-08-28`
- **Owners:** `lib/coach-planner-service.ts`, `lib/coach-session-library-service.ts`, `lib/coach-training-plan-service.ts`, `lib/session-editor-adapters.ts`, `components/SessionComposer.tsx`
- **Related work:** [architecture](../../../ARCHITECTURE.md), [baseline](../history/2026-08-21-baseline.md), [planner history](../../../docs/superpowers/plans/2026-06-23-coach-planner.md), [source assignment task](../tasks/2026-08-21-source-copy-assignment.md), [workflow task](../tasks/2026-08-21-planner-template-workflows.md), [editor migration](../tasks/2026-08-25-editor-migration.md), [concise UI copy](../history/2026-08-28-concise-ui-copy.md), [shared session creator](../history/2026-08-28-shared-session-creator.md)

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
- The active planner exposes source assignment with athlete/date or Monday-week
  targets, previews resulting dates, and confirms before resetting loaded drafts.
- The templates route exposes live create/edit controls using Tempo block fields.
- The active planner now uses `SessionComposer` with the canonical session draft;
  ownership modes and source-template context are retained by
  `session-editor-adapters`.
- Planner modes, source/session lists, training-plan actions, and delete/editor
  utilities use compact shared controls so the desktop workspace stays dense
  without changing the standard save/form sizing.
- Assigned athlete sessions persist a complete latest coach baseline payload;
  source copies remain independent from reusable source records.
- Coach edits to planned athlete sessions clear adjusted status, replace the
  baseline, preserve source ownership, and move the existing Assignment target
  date rather than creating another Session.
- Athletes have a private Planner path using the same canonical editor; selecting
  multiple dates creates independent scheduled sessions.
- Planner helper copy is concise; visible day and mode controls are not restated
  in explanatory text.

## Verification

- Planner, draft, library, training-plan, assignment, route/source, and editor
  migration tests pass in `pnpm test` on 2026-08-25.
- `pnpm lint && pnpm build` — pass on 2026-08-21.
- `pnpm test` — 134 passing tests on 2026-08-25, including workflow source and
  snapshot assertions.
- Planned adjustment/coach overwrite tests pass on 2026-08-25.
- `pnpm test`, `pnpm lint`, and `pnpm build` pass after the desktop-first sizing
  polish on 2026-08-28.
- `pnpm test`, `pnpm lint`, `pnpm build`, and `git diff --check` pass after the
  concise UI copy audit on 2026-08-28.
- `pnpm test` — 150 passing tests after the shared session creator on 2026-08-28.
- `pnpm lint`, `pnpm build`, and `git diff --check` — pass on 2026-08-28.
- `pnpm db:push --force-reset && pnpm db:seed` — pass on the disposable local
  SQLite database on 2026-08-21.

## Known Gaps

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
