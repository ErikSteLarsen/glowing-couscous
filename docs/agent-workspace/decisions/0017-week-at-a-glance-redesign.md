# Decision: Replace the split-board world with a week-at-a-glance system

- **Date:** `2026-09-08`
- **Status:** accepted
- **Feature IDs:** `SHELL-001`, `ATHLETE-001`, `COACH-001`, `PLAN-001`, `TEMPLATE-001`
- **Supersedes:** [0016-tempo-navy-split-board](0016-tempo-navy-split-board.md)

## Context

The product owner requested a page-by-page redesign of the authenticated app,
with efficiency and density as the primary outcomes. The existing navy
split-board system is coherent and verified, but it is now the incumbent to
replace rather than the target to polish.

## Decision

- Make the Monday-first training week the primary organizing object across the
  authenticated athlete and coach surfaces.
- Use a familiar week-at-a-glance planner grammar for the new visual world:
  clear day/session grouping, explicit status, strong current/next action,
  compact metadata, and responsive reflow from parallel desktop columns to a
  focused mobile sequence.
- Preserve product truth, route topology, role ownership, workout structure,
  completion semantics, state coverage, accessibility, and responsive behavior.
- Work in bounded family batches: shared shell/primitives, athlete weekly loop,
  athlete execution/history, athlete planning/reuse, coach oversight, and coach
  authoring/assignment.

## Consequences

- The shared shell and primitives will be reworked before page-family migration;
  route-local styling must not invent competing patterns.
- Calendar and Home become the first athlete family because they establish the
  week grammar that later surfaces inherit.
- The final `DESIGN.md` must describe the shipped system, not merely this intent;
  it will be refreshed after the built world is reviewed.
- Existing navy split-board records remain historical evidence; this decision is
  the active visual direction for the redesign.
