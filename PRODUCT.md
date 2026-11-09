# Product

## Purpose

Workout Planner is a self-directed endurance training planner. It helps people
create, schedule, follow, complete, and review their own training. The first MVP
must be useful to an individual without a coach, roster, or assigned plan.

The application is branded `Tempo` in its runtime metadata while the repository
and working product description use `Workout Planner`.

## Users

- **Primary: people managing their own training.** They create workouts and reusable templates, plan their calendar, follow sessions, and record and review outcomes. The current implementation calls this role Athlete.
- **Secondary: coaches and coached athletes.** Existing collaboration supports rosters, reusable content, and assignments. Coach discovery and connection are optional extensions to personal use.

## First MVP Priorities and Acceptance

The release target is a complete personal training loop, starting with a fresh
account and no coach connection or seeded content:

1. Sign up and reach a useful personal workspace.
2. Create, edit, save, and reuse a structured workout or template.
3. Schedule personal content on selected dates and reliably review or remove planned sessions.
4. Open and follow a session, record completion, notes, and actual outcomes.
5. Review saved results in Activity and session detail after refreshing or signing in again.

Prioritize correctness, persistence, understandable empty/error states, and
usable desktop, mobile, and keyboard interactions across this loop. Verify
shared Planner source selection, date ranges, month navigation, and session
state handling before expanding scope. These are acceptance targets, not a
claim that all browser checks have passed.

Coach-only authoring, roster management, requests, and multi-athlete planning
are secondary work and do not define first-MVP completeness. Preserve existing
coach behavior and access boundaries when changing shared code. Fix shared
regressions and data/security issues regardless of role, but defer coach feature
expansion until personal use is complete or explicitly requested.

## Product Model

- Training weeks begin on Monday.
- A `Session` is structured content made from ordered workout blocks.
- Blocks provide sport, targets, duration, repetitions, notes, skipped state, and zone information.
- Duration, training load, zones, and timelines are derived from structured blocks.
- `Workouts` stores private reusable definitions without dates or assignments.
- `Planner` places independent copies of reusable content onto selected athlete dates or training-plan weekdays. Workouts can target multiple dates; day, week, and month templates use exact cadence-length date ranges.
- `Templates` stores owner-scoped personal or coach day, week, or month cadence content whose assignment span is validated by Planner.
- Completion stores performed metrics, notes, and the latest actual snapshot in `Activity`.

## Current Capabilities

- Credentials authentication, signup, first-login role setup, and optional Google OAuth.
- Coach roster, athlete detail, coach discovery, and request approval flows.
- Coach and athlete workout libraries with a shared visual editor.
- Coach planner, reusable training plans, templates, source-copy assignment, and athlete planner.
- Athlete Home, Calendar, Workouts, Session, Live, Activity, Profile, and Settings surfaces.
- Planned session adjustments, actual outcome editing, baseline/actual comparison, and completion.
- Public sanitized workout and template snapshots with explicit authenticated intake.

## Constraints and Non-goals

- Live execution is a local block stepper; it does not collect device or sensor telemetry.
- Messaging, multi-coach collaboration, shared business accounts, custom sports, and deep analytics are not implemented.
- Flexible recurring-session rules and month-level plan editing are outside the current product model; Planner supports exact day, week, and month cadence spans.
- Public sharing exposes only a sanitized workout definition; it never exposes ownership, relationship, private notes, or actual data.
