# Work Index

This is the small current map of product capabilities. It is not a backlog and
does not preserve completed implementation history.

## First MVP Priority

PRODUCT.md defines the release target: complete personal training without a
coach, using the unified personal workspace. Prioritize authentication and
onboarding, personal libraries/templates, planning, session completion, and
outcome review. Capability status below describes implementation evidence,
not release priority. Coach-only capabilities and training-plan expansion are
secondary; preserve their behavior and shared ownership boundaries.

## Status Vocabulary

- `shipped` - implemented and covered by current verification evidence.
- `in-progress` - live work still changing or missing an important acceptance gate.
- `transitional` - still required for compatibility but not the extension point for new work.

## Capabilities

| ID | Area | Status | Primary owners | Main entry points |
|---|---|---|---|---|
| `AUTH-001` | Authentication and dormant role compatibility | `shipped` | `auth.ts`, `middleware.ts`, `lib/auth-session.ts`, `lib/api-auth.ts` | `/login`, `/signup`, `/setup`, `/api/auth/*` |
| `SHELL-001` | Unified personal shell and navigation | `shipped` | `components/AppShell.tsx`, `components/AppSidebar.tsx`, `components/ui.tsx` (`TopBar`, `BackControl`), `app/globals.css`, `lib/app-navigation.ts` | Authenticated `(app)` layout and `/athlete/*` |
| `COACH-001` | Dormant coach roster and requests | `transitional` | `lib/coach-service.ts`, `lib/coach-request-service.ts` | Hidden pending a later collaboration release |
| PLAN-001 | Personal planning and secondary coach planning | shipped | components/PlannerDesk.tsx, lib/coach-planner-service.ts, lib/athlete-planner-service.ts, lib/assignment-service.ts | /coach/planner, /athlete/planner |
| `LIB-001` | Owner-scoped workout libraries | `shipped` | `lib/workout-library-service.ts`, `lib/coach-session-library-service.ts` | `/coach/workouts`, `/athlete/workouts` |
| `TEMPLATE-001` | Templates and training plans | `in-progress` | `lib/template-service.ts`, `lib/coach-training-plan-service.ts` | `/coach/templates`, `/athlete/templates` |
| SESSION-001 | Canonical editor and outcomes | in-progress | lib/session-editor.ts, lib/athlete-execution.ts, lib/athlete-service.ts, lib/workout-canvas-drop.ts, lib/workout-pattern.ts, lib/workout-zone-intensity.ts, lib/profile-training-zones.ts, lib/performance-profile.ts, lib/account-service.ts, components/WorkoutBuilder.tsx, components/WorkoutCanvasEditor.tsx, components/SessionPlanCanvas.tsx, components/WorkoutLibraryClient.tsx, lib/session-snapshot-service.ts, lib/athlete-completion-service.ts | Profile, read-only session detail, timed live execution, workout canvas, outcome APIs; profile-backed zones and target adjustments |
| `ACTIVITY-001` | Activity file review, import, and removal | `in-progress` | `lib/activity-file-parser.ts`, `lib/activity-import-service.ts`, `lib/activity-series.ts`, `components/tempo/ActivityIntensityBars.tsx`, `components/ImportedActivityMeasurements.tsx`, `components/ActivityImportClient.tsx`, `components/tempo/SessionRow.tsx`, `lib/athlete-service.ts`, athlete session detail page | Shared `/athlete/imported-activities` page and `/api/activity-imports`; imported activity measurements and no-plan overview in athlete Calendar/session detail |
| `STRAVA-001` | Automatic Strava API sync | `in-progress` | `lib/strava-service.ts`, `app/api/strava/*`, `components/StravaImportPanel.tsx` | OAuth, activity review/import, webhooks, and disconnect cleanup are implemented; external setup and live verification remain |
| `SHARE-001` | Sanitized workout sharing | `in-progress` | `lib/share-link.ts`, `lib/share-link-service.ts` | `/share/[token]`, share APIs |
| `COMPAT-001` | Older coach session adapter | `transitional` | `lib/planner-service.ts` | `/api/coach/sessions/[sessionId]` |

Current verification and gaps are in `CURRENT-STATUS.md`. When a capability
changes owner or state, update this row and the current status in the same
change.

The athlete Planning Desk distinguishes first-use empties from search misses,
offers creation actions for missing workout or template sources, and puts
selected-day details before the calendar on narrow screens. Calendar buttons
announce planned session names, and template ranges report chronological
endpoints in either selection direction.
Home, Calendar, and Planning Desk mark today with the shared
`calendar-day--today` full-cell treatment and `calendar-day-date--today` marker
in `app/globals.css`; date selection remains separate from the current date.
Page and nested-editor return controls use `TopBar` and `BackControl` in
`components/ui.tsx`; return targets live in `lib/app-navigation.ts` and retain
their originating route context.

## Design Context

`DESIGN.md` is the durable visual contract. Verify implementation details in
`app/globals.css`, then reuse the shared primitives before adding route-local
styles:

| Concern | Source of truth | Reusable owners |
|---|---|---|
| Tokens, type, layout, depth, and guardrails | `DESIGN.md`, `app/globals.css` | CSS custom properties and Tailwind theme tokens |
| Shell and responsive navigation | `components/AppShell.tsx`, `components/AppSidebar.tsx` | `lib/app-navigation.ts` |
| Page-level controls and surfaces | `components/ui.tsx` | `PageShell` (single workspace frame), `AuthPageShell`, `TopBar`, button, field, `Surface`, `Badge`, and `EmptyState` classes |
| Workout/session language | `components/tempo/*` | `SessionRow`, `SessionBlockBar`, `StatusBadge`, `MetricText`, `Stepper`, and `Toggle` |
| Authoring surface | `components/WorkoutBuilder.tsx`, `components/WorkoutCanvasEditor.tsx`, `components/design/workout-canvas.css` | Shared workout, template, and planned-session visual editor backed by canonical draft services |
| Visual experiments | `app/design/*`, `components/design/*` | Preview only; never copy their tokens into product screens without an explicit system decision |

`public/tempo-sports-loop.svg` owns the standalone triathlon mark proposal,
generated by `scripts/generate-tempo-sports.mjs`. It is not yet embedded into
authentication pages. Its twelve-second transparent swim/cycle/run loop has
rotating wheels, continuous leftward water/ground motion, a reduced-motion
still, and no runtime dependencies.

## Active Tasks



- `2026-09-26-strava-activity-import.md` - activity file and Strava review/import; integration is implemented, with external setup and database/browser verification remaining.
- `2026-09-25-target-intensity-adjustments.md` - zone presets, target adjustments, and responsive verification.


- `2026-09-15-workout-flow-previews.md` - three interactive workout authoring direction previews; routes live under `/design/workout-flow/*`.
- `2026-09-15-workbench-middle-experiments.md` - three Workbench middle-surface experiments; routes live under `/design/workout-flow/workbench/{terrain,ribbon,staging}`.


## Current Assessment

See [ASSESSMENT.md](ASSESSMENT.md) for the 2026-09-17 prioritized personal workflow findings and verification results.


## Completed Functional Repairs

[FUNCTIONAL-REPAIR-PLAN.md](FUNCTIONAL-REPAIR-PLAN.md) records the completed assessed functional fixes, drag-and-drop and operation-feedback improvements, and combined usability gates. Current evidence is in CURRENT-STATUS.md.
