# Task: Clarify workout, planner, and template workspaces

- **Status:** `completed`
- **Agent:** `OpenCode` (`ses_f85530e62ffejHQE1x3OolbDrg`)
- **Started:** `2026-09-07`
- **Updated:** `2026-09-07`
- **Feature IDs:** `SHELL-001`, `PLAN-001`, `LIB-001`, `TPLAN-001`, `TEMPLATE-001`, `ATHLETE-001`
- **Related records:** [shell](../features/shell.md), [planner](../features/planner.md), [templates](../features/templates.md), [athlete](../features/athlete.md)

## Goal

Make the signed-in app immediately explain where to author standalone workouts,
schedule work onto dates, build reusable templates with an explicit cadence,
and review completed activity. Coaches and athletes should share the same core
mental model while coaches retain roster-aware assignment controls.

## Starting Context

- Current behavior: coach Planner combines library authoring, training plans,
  athlete scheduling, and source assignment; athlete Workouts is a list of
  already scheduled sessions; Templates are reusable single-session sources.
- Existing owner/service: `lib/coach-planner-service.ts`,
  `lib/coach-session-library-service.ts`, `lib/coach-training-plan-service.ts`,
  `lib/template-service.ts`, `lib/assignment-service.ts`, and the shared
  `SessionComposer` flow.
- Related active or transitional work: universal sharing remains in progress;
  this task changes navigation and UI composition only unless existing service
  seams are required to make labels truthful.

## Plan

- [x] Map the current route/menu responsibilities and identify misleading overlap.
- [x] Separate authoring, scheduling, reusable-plan, and history entry points in the shell and page headers.
- [x] Make template cadence visible and guide users from templates into the right assignment flow.
- [x] Polish key empty states, labels, action hierarchy, and responsive layout without introducing decorative density.
- [x] Run tests, lint, build, diff checks, and the Impeccable detector.

## Progress Log

### 2026-09-07

- What changed: Confirmed the current IA collision: coach Planner is a three-column workspace that owns library authoring, training-plan editing, athlete scheduling, and source assignment; athlete Planner also owns session creation; athlete Workouts only lists dated sessions; Templates are only single-session sources.
- Decision or discovery: Use shared top-level jobs — Workouts, Planner, Templates, Calendar/Activity — with coach roster controls layered into Planner. Keep the light Tempo visual language and make the redesign calmer rather than more decorative or denser. Template cadence should be explicit for day/week/month; month can remain guided where current persistence does not yet model it.
- Files touched: task record only.
- Verification: not run; implementation has not started.
- Blocker or next step: Refactor navigation and the overlapping coach/athlete page compositions.

### 2026-09-07 — completion

- What changed: Shipped the shared standalone Workout Library, focused Planner entry points, explicit Template cadence UI, role-aware workspace navigation, and clearer Calendar/Activity copy.
- What changed: Connected the athlete flow end-to-end as well: a saved private workout can now be selected in Planner and copied onto one or more dates without changing the library source.
- Decision or discovery: Month cadence is stored and explained but remains a guided assignment path until a first-class month source model exists.
- Files touched: `components/WorkoutLibraryClient.tsx`, `components/AppSidebar.tsx`, `lib/workout-library-service.ts`, `lib/template-cadence.ts`, new workout routes, workspace pages, schema/service/docs records.
- Verification: `pnpm test` — 170 pass; `pnpm lint` — pass; `pnpm build` — pass; `git diff --check` — pass; Impeccable detector — no findings.
- Blocker or next step: Browser acceptance of the new create/edit/delete and responsive flows remains follow-up work because no browser-capable tool is available.

### 2026-09-07 — audit hardening

- What changed: Audited the new workout library, template cadence, focused planner, and sidebar navigation surfaces. Standalone library reads and mutations now require a null date/plan, template sources are owner-validated, invalid cadence values are rejected, destructive actions confirm, network failures surface recovery copy, and the focused coach Planner explains the no-roster state.
- Decision or discovery: The new library contract is stricter than the transitional planner library path; scheduled or training-plan sessions must not appear as standalone Workouts.
- Files touched: `lib/workout-library-service.ts`, `lib/template-service.ts`, `components/WorkoutLibraryClient.tsx`, `components/AppSidebar.tsx`, focused planner/template/athlete UI, and regression tests.
- Verification: `pnpm test` — 175 pass; `pnpm lint` — pass; `pnpm build` — pass; `git diff --check` — pass; Impeccable detector — no findings.
- Blocker or next step: Browser acceptance of the new create/edit/delete and responsive flows remains follow-up work because no browser-capable tool is available.

## Verification

- `pnpm test` — 175 passing tests on 2026-09-07
- `pnpm lint` — pass on 2026-09-07
- `pnpm build` — pass on 2026-09-07; existing middleware-to-proxy deprecation warning remains
- `git diff --check` — pass on 2026-09-07
- Impeccable detector — no findings on 2026-09-07

## Handoff / Completion

- **Final status:** `completed`
- **History record:** [workspace information architecture](../history/2026-09-07-workspace-information-architecture.md)
- **Feature records updated:** [shell](../features/shell.md), [planner](../features/planner.md), [templates](../features/templates.md), [athlete](../features/athlete.md)
- **Remaining work:** Add browser acceptance and a first-class month-level source model.
