# Product

## Purpose

Workout Planner is an athlete-led endurance training planner. It turns a
coach-backed weekly plan into clear sessions an athlete can understand, execute,
complete, and review later.

The application is branded `Tempo` in its runtime metadata while the repository
and working product description use `Workout Planner`.

## Users

- **Athletes** discover or connect with a coach, follow scheduled sessions, use the local live stepper, and record notes and actual outcomes.
- **Coaches** manage a roster, author reusable workouts, templates, and training plans, and assign independent copies to athletes.

## Product Model

- Training weeks begin on Monday.
- A `Session` is structured content made from ordered workout blocks.
- Blocks provide sport, targets, duration, repetitions, notes, skipped state, and zone information.
- Duration, training load, zones, and timelines are derived from structured blocks.
- `Workouts` stores private reusable definitions without dates or assignments.
- `Planner` places independent copies of reusable content onto selected athlete dates or training-plan weekdays. Workouts can target multiple dates; day, week, and month templates use exact cadence-length date ranges.
- `Templates` stores reusable coach-owned day, week, or month cadence structures whose assignment span is validated by Planner.
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
