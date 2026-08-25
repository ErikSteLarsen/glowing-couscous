# Decision 0009: Keep the active UI on one Tempo surface

- **Date:** `2026-08-22`
- **Status:** `accepted`
- **Related work:** [interactive color and contrast audit](../tasks/2026-08-22-interactive-color-contrast.md), [compatibility cleanup](../features/compatibility.md)

## Context

The active App Router screens use the light Tempo shell and shared primitives,
but several pre-convergence athlete components remained unreferenced in
`components/`. Those components used a separate dark visual system, including
white text on light `Surface` containers and an undefined `--brand-strong`
button background. Keeping them increases the chance of reintroducing an
invisible control when an old component is copied into a live route.

## Decision

Keep the active route tree on the shared light Tempo UI. Remove the unreferenced
pre-convergence athlete component chain after confirming there are no source or
test imports. Keep the current shared button primitives as the only source for
primary, secondary, and danger action styling, including focus and disabled
states.

## Alternatives considered

- Restyle the unused components in place: rejected because it preserves dead
  duplicate architecture and creates another surface to maintain.
- Change the entire active palette away from the dark primary action: rejected
  because the existing dark background with white text is high contrast and is
  intentional; the issue was not a palette-wide failure.

## Consequences

- Active screens have one light-theme component vocabulary and shared action
  states.
- The old athlete week/session component chain is no longer available as an
  accidental alternative entry point; future work should extend the active
  route-local components and `components/ui.tsx`.
- Historical plan documents may still mention the removed components; they are
  preserved as historical records and are not live imports.
