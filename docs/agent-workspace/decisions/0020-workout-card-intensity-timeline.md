# Decision 0020: Encode workout intensity in shared card bars

- **Date:** 2026-09-14
- **Status:** accepted
- **Scope:** `SessionRow` cards on athlete Home, Calendar, and Workouts
- **Refines:** [0018 shared workout card variants](0018-shared-workout-card-variants.md)

## Decision

Keep `SessionRow` as the shared workout-card primitive. At its `card` and
`compact` sizes, `SessionBlockBar` now uses colored, duration-proportional
segments whose height rises with Zone 1 through Zone 5. The graphic has a
transparent background, caps at `18rem`, and uses `32px`/`24px` card/compact
heights with square segment edges. The full-size detail bar remains a flat,
rounded structure timeline, and the month card remains title-only.

## Consequences

- Users can identify higher-intensity work from the card silhouette without
  giving up the existing zone colors or duration sequence.
- The 32px card and 24px compact treatments increase scanability while staying
  inside the existing card density budget; transparent space prevents the chart
  from reading as a heavy container.
- The accessible bar summary names each zone, segment label, and duration; the
  visual encoding is supplementary rather than the only source of meaning.
