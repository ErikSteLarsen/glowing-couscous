# Decision: Desktop-first contextual control sizing

- **Date:** `2026-08-28`
- **Status:** `accepted`
- **Feature IDs:** `SHELL-001`, `ATHLETE-001`, `PLAN-001`, `TEMPLATE-001`

## Context

The application is primarily used in a desktop browser, but the existing
44px action contract was used for both important standalone actions and dense
planner/editor utilities. This made desktop cards, navigation, and editing
surfaces unnecessarily tall while reducing hierarchy between primary and
secondary actions.

## Decision

Keep the standard 44px contract for form fields, important standalone actions,
authentication, completion, and live execution controls. Add explicit compact
variants for dense desktop surfaces: 36px actions, lighter secondary weight,
compact segmented controls, and compact list buttons. Preserve responsive
stacking for narrow coach discovery and request actions. Keep the visible
toggle track compact while retaining its larger interaction target.

## Alternatives Considered

- Reduce every shared button globally: rejected because it would make fields,
  live controls, and important mobile actions less comfortable.
- Continue with route-local utility classes: rejected because it preserves the
  inconsistent sizing system found in the review.
- Build a separate desktop-only component tree: rejected because contextual
  size variants are sufficient and avoid duplicating behavior.

## Consequences

- New dense controls should use the compact shared variants instead of adding
  one-off padding and font-size classes.
- Standard controls remain intentionally touch-friendly.
- Browser viewport inspection remains useful follow-up work because automated
  tests verify source contracts rather than rendered dimensions.
