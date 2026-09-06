# Decision: Contextual athlete navigation

- **Date:** `2026-09-03`
- **Status:** accepted
- **Feature IDs:** `SHELL-001`, `ATHLETE-001`

## Context

Home, Calendar, and Activity all opened the same session detail route, but the
detail page always returned to Calendar. The month calendar also made the whole
day a link to only its first session. Settings was exposed in both primary and
profile navigation, and profile actions had no active state.

## Decision

- Add `/athlete/workouts` as the canonical list of scheduled athlete sessions.
- Treat Workouts as the active sidebar context for the Workouts list, session
  detail, and live execution routes.
- Add a small validated `from` query to session links. Session detail and Live
  use it for their return links; direct or unknown origins fall back to Calendar.
- Keep Profile and Settings together in the sidebar profile section. Highlight
  the currently viewed action and expose `aria-current="page"`.
- Make month-calendar session cards individual links rather than linking the
  entire day to its first session.

## Alternatives considered

- Rely on browser history for a generic Back action. Rejected because it is
  inconsistent for direct links, refreshes, and multi-step Live navigation.
- Keep a top-level Settings item and a profile Settings item. Rejected because
  the two entries describe the same destination and compete for attention.
- Keep the month day as one link. Rejected because it hides which workout opens
  when a day contains multiple sessions.

## Consequences

- Athlete navigation now has an explicit workout context and predictable return
  destinations without a new persistence model.
- New session entry points should use one of the known `from` values rather than
  hard-coding a detail-page back target.
- The Workouts list currently shows all scheduled sessions; filtering and
  pagination can be added later behind `athleteService` if the dataset grows.
