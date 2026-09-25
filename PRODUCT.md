# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary: people managing their own training.** They create workouts and reusable templates, plan their calendar, follow sessions, and record and review outcomes. The current implementation calls this role Athlete.
- **Secondary: coaches and coached athletes.** Existing collaboration supports rosters, reusable content, and assignments. Coach discovery and connection are optional extensions to personal use.

## Product Purpose

Workout Planner is a self-directed endurance training planner. It helps people create, schedule, follow, complete, and review their own training. Success means a person can complete that full loop from a fresh account without a coach, roster, or assigned plan.

## Positioning

Workout Planner joins reusable structured workout authoring, Monday-first personal planning, guided session execution, and saved outcome review in one continuous self-directed workflow. Coach collaboration remains available without becoming a prerequisite for personal use.

## Operating Context

The first MVP is used as a recurring personal training workspace:

1. Sign up and enter the Athlete workspace.
2. Create, edit, save, and reuse a structured workout or template.
3. Schedule personal content on selected dates and review or remove planned sessions.
4. Open and follow a session, then record completion, notes, and actual outcomes.
5. Review persisted results in Activity and session detail after refreshing or signing in again.

Training weeks begin on Monday. Desktop, mobile, and keyboard workflows are all part of acceptance. The application is branded `Tempo` in runtime metadata while the repository and working product description use `Workout Planner`.

## First MVP Priorities and Acceptance

Prioritize correctness, persistence, understandable empty and error states, and usable desktop, mobile, and keyboard interactions across the personal training loop. Verify shared Planner source selection, date ranges, month navigation, and session state handling before expanding scope. These are acceptance targets, not a claim that every browser check has passed.

Coach-only authoring, roster management, requests, and multi-athlete planning are secondary work and do not define first-MVP completeness. Preserve existing coach behavior and access boundaries when changing shared code. Fix shared regressions and data or security issues regardless of role, but defer coach feature expansion until personal use is complete or explicitly requested.

## Product Model

- A `Session` is structured content made from ordered workout blocks.
- Blocks provide sport, targets, duration, repetitions, notes, skipped state, and zone information.
- New effort blocks use the selected zone's target preset. Profile-backed running pace starts at the midpoint of the user's editable zone range; Olympiatoppen heart-rate targets use the user's BPM range for that zone. Numeric adjustments can move effort into another zone, and choosing a zone resets its preset. Relative profile targets remain generic in stored workouts so each user resolves them against their own profile.
- The performance profile stores maximum heart rate for Olympiatoppen I-1–I-5 boundaries and a recent running race distance/time to seed five editable pace ranges. Pace defaults use Tempo's race-speed bands, not Olympiatoppen-published pace bands; profile users can set the fastest and slowest min/km for each zone.
- Short pause blocks sit between efforts or repeated sets. They count toward elapsed time but do not contribute training load.
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
- Personal maximum-heart-rate and race-based pace zones that resolve in workout creation.
- Planned session adjustments, actual outcome editing, baseline and actual comparison, and completion.
- Public sanitized workout and template snapshots with explicit authenticated intake.

## Capabilities and Constraints

- Live execution is a local block stepper; it does not collect device or sensor telemetry.
- Messaging, multi-coach collaboration, shared business accounts, custom sports, and deep analytics are not implemented.
- Flexible recurring-session rules and month-level plan editing are outside the current product model; Planner supports exact day, week, and month cadence spans.
- Public sharing exposes only a sanitized workout definition; it never exposes ownership, relationship, private notes, or actual data.

## Brand Commitments

The product uses the `Tempo` runtime name and direct task language. The established identity and visual commitments live in `DESIGN.md`; product documentation must not invent a competing brand or imply that coach involvement is required.

## Evidence on Hand

The repository contains implemented authenticated product routes, shared UI components, service-level tests, seeded demo accounts, and public design-direction previews. `README.md`, `ARCHITECTURE.md`, `DESIGN.md`, and `docs/agent-workspace/CURRENT-STATUS.md` describe the current implementation and verification boundaries. No testimonials, customer claims, pricing, external benchmarks, or production-usage evidence are established and future work must not fabricate them.

## Product Principles

- Complete the self-directed training loop before expanding coach-only features.
- Keep reusable definitions separate from independently scheduled copies.
- Make persisted state, ownership, and authorization boundaries explicit and reliable.
- Keep the next training action understandable without requiring a coach or seeded content.
- Preserve truthful outcome data and never imply telemetry the product did not collect.

## Accessibility & Inclusion

Primary workflows must remain usable on desktop and mobile and through keyboard interaction. State must remain understandable without color alone, controls need visible focus, and reduced-motion preferences must preserve feedback without unnecessary movement.
