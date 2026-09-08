# Decision: Refine Tempo around a restrained navy split-board system

- **Date:** `2026-09-08`
- **Status:** accepted
- **Feature IDs:** `SHELL-001`, `ATHLETE-001`

## Context

The visual direction comparison established the split-board layout as the
preferred Tempo structure. The original graphite/mint treatment was useful for
signal, but too colorful for a professional training tool when applied across
the full authenticated product.

## Decision

- Keep the split-board information architecture, component placement, compact
  metric hierarchy, and workout-block rails.
- Use dark navy navigation, cool white surfaces, blue-gray borders, and muted
  steel-blue brand accents as the dominant system.
- Reserve stronger color for functional states and workout-zone meaning. Zone
  data remains unchanged for metrics and sharing; the shared block-bar display
  is visually desaturated instead.
- Apply the system through global tokens, shell/navigation primitives, shared
  controls, forms, planner/calendar/session/activity surfaces, and the split
  direction preview.

## Consequences

- Tempo reads as a calmer, more professional instrument without losing the
  high-signal split-board structure.
- Existing workout serialization and shared-link snapshots remain compatible.
- Browser viewport acceptance is still required when a connected desktop
  browser is available.
