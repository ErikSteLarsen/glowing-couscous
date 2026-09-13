# Decision 0019: Completed status is not a visible badge

- **Date:** 2026-09-13
- **Status:** accepted
- **Scope:** Shared workout cards and status-badge callers across athlete and
  coach read surfaces

## Decision

Completed sessions must not render a visible `StatusBadge` in any surface.
`StatusBadge` remains available for planned, adjusted, and missed states when
those states help the next decision. `SessionRow` never renders a status badge
and no longer accepts a `showStatus` prop.

Completed state remains available to domain/action logic, outcome/history
surfaces, accessible workout context, and the muted treatment used where dense
lists need completed work to recede.

## Why

The prior implementation made status visibility a per-caller concern. Home
forgot to opt out, while Calendar and Workouts carried redundant `showStatus`
overrides. Centralizing the completed-state rule prevents a new card variant or
route from accidentally reintroducing the completed badge.

## Consequences

- Shared workout cards have one stable visual grammar without status-badge
  branching.
- The completed badge styling is removed from `StatusBadge`; its component
  returns no visible element for the completed domain value.
- Planned, adjusted, and missed badges remain supported on detail and oversight
  surfaces where they are useful.
