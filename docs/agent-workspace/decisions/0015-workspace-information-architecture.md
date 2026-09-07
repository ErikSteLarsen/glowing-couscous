# Decision: Separate workout authoring, scheduling, and reusable planning

- **Date:** `2026-09-07`
- **Status:** accepted
- **Feature IDs:** `SHELL-001`, `PLAN-001`, `LIB-001`, `TPLAN-001`, `TEMPLATE-001`, `ATHLETE-001`

## Context

The previous shell exposed Planner and Templates, but Planner combined standalone
workout authoring, training-plan editing, athlete scheduling, and source
assignment. Athlete Workouts showed scheduled sessions rather than a reusable
workout library. Users had to infer whether a page changed workout content or
changed a calendar.

## Decision

- Use the same core workspace jobs for coaches and athletes:
  **Workouts** creates and manages standalone workouts, **Planner** places work
  on dates, and **Templates** describes reusable day/week/month structure and
  hands finished content into Planner.
- Keep role-specific context outside those jobs: coach Athletes remains the
  roster entry point, while athlete Home, Calendar, and Activity remain
  overview/read surfaces.
- Store standalone athlete workouts as owner-scoped Sessions with no date,
  plan, or training plan. Coaches get the same standalone library surface while
  retaining roster-aware assignment controls in Planner.
- Preserve the existing light Tempo visual language and use short purpose
  descriptions in the sidebar and workspace headers instead of adding decorative
  navigation layers.

## Consequences

- The former coach library path remains available as compatibility code, but new
  authoring belongs at `/coach/workouts` and new scheduling belongs at
  `/coach/planner`.
- Athlete Workouts now contains private unassigned workouts plus a clearly
  separated view of already scheduled sessions.
- Template cadence is persisted as `day`, `week`, or `month`. The current
  assignment UI fully supports the existing day and week planner seams; month
  setup is explicitly guided until a month-level source model is introduced.
- Existing browser verification of the new standalone workout authoring flow is
  still a follow-up because no browser-capable tool is available in this repo.
