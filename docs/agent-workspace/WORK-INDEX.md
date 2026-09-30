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
| `AUTH-001` | Authentication and dormant role compatibility | `shipped` | `auth.ts`, `middleware.ts`, `lib/auth-session.ts`, `lib/api-auth.ts`, `lib/password-reset-service.ts` | `/login`, `/signup`, `/setup`, `/forgot-password`, `/reset-password`, `/api/auth/*` |
| `SHELL-001` | Unified personal shell, saved theme, and navigation | `shipped` | `components/AppShell.tsx`, `components/AppSidebar.tsx`, `components/ui.tsx` (`TopBar`, `BackControl`), `app/globals.css`, `lib/app-navigation.ts` | Authenticated `(app)` layout and `/athlete/*` |
| `DESIGN-001` | Monolith design-system rollout | `shipped` | `DESIGN.md`, `app/globals.css`, `app/monolith.css`, `components/FocusHome.tsx`, `components/FocusWorkouts.tsx` | Shared authenticated shell and route families; accepted browser coverage limits are in `CURRENT-STATUS.md` |
| `HOME-001` | Personal Home overview | `shipped` | `app/(app)/athlete/page.tsx`, `components/FocusHome.tsx`, `components/AthleteHomeContent.tsx` (prior composition), `lib/athlete-service.ts` | `/athlete`; current day, week, and overview readouts |
| `COACH-001` | Dormant coach roster and requests | `transitional` | `lib/coach-service.ts`, `lib/coach-request-service.ts` | Hidden pending a later collaboration release |
| PLAN-001 | Personal planning and secondary coach planning | shipped | app/(app)/athlete/calendar/AthleteCalendarWeekScroller.tsx, components/PlannerDesk.tsx, components/tempo/SessionRow.tsx, components/tempo/SessionIntensitySwatch.tsx, lib/session-intensity.ts, lib/coach-planner-service.ts, lib/athlete-planner-service.ts, lib/assignment-service.ts | /coach/planner, /athlete/planner, /athlete/calendar |
| `LIB-001` | Owner-scoped workout libraries | `shipped` | `lib/workout-library-service.ts`, `lib/coach-session-library-service.ts`, `components/WorkoutLibraryClient.tsx`, `components/FocusWorkouts.tsx` | `/coach/workouts`, `/athlete/workouts` |
| `AI-WORKOUT-001` | Guided athlete workout creator | `in-progress` | `lib/guided-workout.ts`, `lib/guided-workout-service.ts`, `lib/workout-llm.ts`, `components/GuidedWorkoutForm.tsx`, `components/WorkoutLibraryClient.tsx` | `/athlete/workouts`, `/api/athlete/workouts/generate`, `/api/athlete/workouts/ai-status`; validated model-authored drafts, shared provider health cache, and keyless fallback work; live model and authenticated browser acceptance remain |
| `TEMPLATE-001` | Templates and training plans | `in-progress` | `lib/template-service.ts`, `lib/coach-training-plan-service.ts` | `/coach/templates`, `/athlete/templates` |
| SESSION-001 | Canonical editor and outcomes | in-progress | lib/session-editor.ts, lib/athlete-execution.ts, lib/athlete-service.ts, lib/workout-canvas-drop.ts, lib/workout-pattern.ts, lib/workout-zone-intensity.ts, lib/intensity-color.ts, lib/profile-training-zones.ts, lib/performance-profile.ts, lib/account-service.ts, components/WorkoutBuilder.tsx, components/WorkoutCanvasEditor.tsx, components/SessionPlanCanvas.tsx, components/tempo/SessionBlockBar.tsx, components/WorkoutLibraryClient.tsx, lib/session-snapshot-service.ts, lib/athlete-completion-service.ts | Profile, read-only session detail, timed live execution, workout canvas, outcome APIs; profile-backed zones, target adjustments, and continuous five-color intensity ramp |
| `ACTIVITY-001` | Activity import, removal, filtered history, and outcome review | `in-progress` | `lib/activity-file-parser.ts`, `lib/activity-import-service.ts`, `lib/activity-series.ts`, `components/tempo/ActivityIntensityBars.tsx`, `components/ImportedActivityMeasurements.tsx`, `components/ActivityImportClient.tsx`, `components/ActivityHistoryOverview.tsx`, `components/tempo/SessionRow.tsx`, `lib/athlete-service.ts`, athlete session detail page, `app/(app)/athlete/activity/page.tsx` | `/athlete/activity` week/month summaries and sport-filtered completed-work history; shared `/athlete/import` page (legacy `/athlete/imported-activities` redirects) and `/api/activity-imports`; imported activity measurements and single-column no-plan detail in athlete Calendar/session detail |
| `STRAVA-001` | Automatic Strava API sync | `in-progress` | `lib/strava-service.ts`, `app/api/strava/*`, `components/StravaImportPanel.tsx` | OAuth, activity review/import, webhooks, and disconnect cleanup are implemented; external setup and live verification remain |
| `SHARE-001` | Sanitized workout sharing | `in-progress` | `lib/share-link.ts`, `lib/share-link-service.ts` | `/share/[token]`, share APIs |
| `COMPAT-001` | Older coach session adapter | `transitional` | `lib/planner-service.ts` | `/api/coach/sessions/[sessionId]` |

Current verification and gaps are in `CURRENT-STATUS.md`. When a capability
changes owner or state, update this row and the current status in the same
change.

For authenticated visual acceptance, see `VISUAL-VERIFICATION.md`. Local
credentials are intentionally kept in a gitignored file, not in this index.

The athlete Planning Desk distinguishes first-use empties from search misses,
offers creation actions for missing workout or template sources, and puts
selected-day details before the calendar on narrow screens. Calendar buttons
announce planned session names, and template ranges report chronological
endpoints in either selection direction.
Below 768px, the shared shell uses role-aware four-item navigation. Athlete
Plan groups Calendar and Planner; Workouts includes Templates; History includes
Import. The phone Planner adds a selected-date-aware week strip and compact
assignment action, the shared workout editor exposes tap controls, and History
adds compact totals/disclosures while preserving full data and desktop output.
Home and Calendar mark today with the shared `calendar-day--today` full-cell
treatment and `calendar-day-date--today` marker in `app/globals.css`. Planning
Desk marks today on its numeral, and selected dates use a separate tinted cell
and inset frame.
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
| Developer-only studies | `app/design/*`, `components/design/*` | Older workout and planning experiments; production Monolith composition is in `app/monolith.css` |

`components/FocusHome.tsx` and `components/FocusWorkouts.tsx` own the selected
production compositions; `app/monolith.css` owns their layout, and
`app/globals.css` owns production light/dark tokens. The temporary Focus,
actual-page, and color comparison routes and their selectors have been removed.

Home sizing follows content: Today and optional readouts share the primary
column beside the complete week ledger, with no week-panel scrollbar or empty
readout tracks. Workout library columns fit their panel width. Planner's source
result list owns desktop overflow; search and selected-day details remain
outside it. Shared canvas/panel/field tones and inset highlights own subtle
depth. Preferences uses the explicit `settings-preferences` reading measure.

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

See [ASSESSMENT.md](ASSESSMENT.md) for the 2026-09-17 prioritized personal workflow findings and verification results, and [MOBILE-READINESS-REVIEW.md](MOBILE-READINESS-REVIEW.md) for the 2026-09-27 route inventory, implemented phone-only changes, responsive evidence, and remaining physical-device/data acceptance gates.


## Completed Functional Repairs

[FUNCTIONAL-REPAIR-PLAN.md](FUNCTIONAL-REPAIR-PLAN.md) records the completed assessed functional fixes, drag-and-drop and operation-feedback improvements, and combined usability gates. Current evidence is in CURRENT-STATUS.md.
