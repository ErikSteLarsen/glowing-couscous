# Work Index

This is the small current map of product capabilities. It is not a backlog and
does not preserve completed implementation history.

## First MVP Priority

PRODUCT.md defines the release target: complete personal training without a
coach, using the existing Athlete workspace. Prioritize authentication and
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
| `AUTH-001` | Authentication and role setup | `shipped` | `auth.ts`, `proxy.ts`, `lib/auth-session.ts`, `lib/api-auth.ts`, `lib/auth-role-service.ts` | `/login`, `/signup`, `/setup`, `/api/auth/*` |
| `SHELL-001` | App shell and navigation | `shipped` | `components/AppShell.tsx`, `components/AppSidebar.tsx`, `lib/app-navigation.ts` | Authenticated `(app)` layout |
| `COACH-001` | Coach roster and requests | `shipped` | `lib/coach-service.ts`, `lib/coach-request-service.ts` | `/coach`, `/coach/athletes/*`, request APIs |
| PLAN-001 | Personal planning and secondary coach planning | shipped | components/PlannerDesk.tsx, lib/coach-planner-service.ts, lib/athlete-planner-service.ts, lib/assignment-service.ts, lib/planner-source-selection.ts, app/(app)/athlete/planner/page.tsx, app/(app)/athlete/planner/AthletePlannerClient.tsx | /coach/planner, /athlete/planner |
| `CALENDAR-001` | Personal calendar and safe rescheduling | `shipped` | `lib/athlete-service.ts`, `lib/athlete-planner-service.ts`, `components/OverdueSessions.tsx`, `components/SessionRescheduleAction.tsx`, `lib/calendar-navigation.ts`, `app/(app)/athlete/calendar/AthleteCalendar.tsx`, `app/(app)/athlete/page.tsx` | `/athlete/calendar`, `/api/athlete/planner/sessions/*/schedule` |
| `LIB-001` | Owner-scoped workout libraries | `shipped` | `lib/workout-library-service.ts`, `lib/coach-session-library-service.ts`, `components/WorkoutLibraryClient.tsx`, `lib/api-response.ts` | `/coach/workouts`, `/athlete/workouts` |
| `TEMPLATE-001` | Personal and coach templates; secondary training plans | `shipped` | `lib/template-service.ts`, `app/(app)/coach/templates/CoachTemplatesClient.tsx`, `app/api/athlete/templates/route.ts`, `lib/coach-training-plan-service.ts` | `/coach/templates`, `/athlete/templates` |
| SESSION-001 | Canonical editor and outcomes | shipped | lib/session-editor.ts, lib/session-snapshot-service.ts, lib/athlete-completion-service.ts, lib/athlete-execution.ts, app/(app)/athlete/session/[sessionId]/page.tsx | Session detail, Live, WorkoutBuilder, outcome APIs |
| `ACTIVITY-001` | Searchable completed training history | `shipped` | `lib/athlete-service.ts`, `lib/activity-navigation.ts`, `app/(app)/athlete/activity/page.tsx` | `/athlete/activity` |
| `SHARE-001` | Sanitized workout sharing and private recipient copies | `shipped` | `lib/share-link.ts`, `lib/share-link-service.ts`, `lib/workout-library-service.ts`, `app/share/[token]/ShareLandingClient.tsx` | `/share/[token]`, share APIs |
| `COMPAT-001` | Older coach session adapter | `transitional` | `lib/planner-service.ts` | `/api/coach/sessions/[sessionId]` |

Current verification and gaps are in `CURRENT-STATUS.md`. When a capability
changes owner or state, update this row and the current status in the same
change.

## Design Context

`DESIGN.md` is the durable visual contract. Verify implementation details in
`app/globals.css`, then reuse the shared primitives before adding route-local
styles:

| Concern | Source of truth | Reusable owners |
|---|---|---|
| Tokens, type, layout, depth, and guardrails | `DESIGN.md`, `app/globals.css` | CSS custom properties and Tailwind theme tokens |
| Shell and responsive navigation | `components/AppShell.tsx`, `components/AppSidebar.tsx` | `lib/app-navigation.ts` |
| Page-level controls and surfaces | `components/ui.tsx` | `PageShell`, `TopBar`, button, field, `Surface`, `Badge`, and `EmptyState` classes |
| Workout/session language | `components/tempo/*` | `SessionRow`, `SessionBlockBar`, `StatusBadge`, `MetricText`, `Stepper`, and `Toggle` |
| Authoring surface | `components/WorkoutBuilder.tsx` | `WorkoutBuilder` and editor services |
| Visual experiments | `app/design/*`, `components/design/*` | Preview only; never copy their tokens into product screens without an explicit system decision |

## Active Tasks

- `2026-11-09-personal-planner-handoff.md` - library and template source handoff into the athlete Planner.
- `2026-09-15-workout-flow-previews.md` - three interactive workout authoring direction previews; routes live under `/design/workout-flow/*`.
- `2026-09-15-workbench-middle-experiments.md` - three Workbench middle-surface experiments; routes live under `/design/workout-flow/workbench/{terrain,ribbon,staging}`.


## Current Assessment

See [ASSESSMENT.md](ASSESSMENT.md) for the 2026-09-17 prioritized personal workflow findings and verification results.


## Completed Functional Repairs

[FUNCTIONAL-REPAIR-PLAN.md](FUNCTIONAL-REPAIR-PLAN.md) records the completed assessed functional fixes, drag-and-drop and operation-feedback improvements, and combined usability gates. Current evidence is in CURRENT-STATUS.md.
