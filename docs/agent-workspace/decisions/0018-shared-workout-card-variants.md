# Decision 0018: Shared workout card variants

- **Date:** 2026-09-13
- **Status:** accepted
- **Scope:** Athlete Home, Calendar week/month, and Workouts presentation

## Decision

Keep `SessionRow` as the single workout-card primitive and expose three named
space variants: `default`, `compact`, and `month`. The card owns its repeated
title, sport/time context, block structure, metrics, status accessibility, and
focus/hover treatment. Calendar callers may still opt into density policies such
as hiding visible status/time or muting completed work, but they do not recreate
the card markup.

`SessionBlockBar` also exposes a `card` size so the roomy card can use a stronger
structure signal without changing the full-detail bar used by session and editor
surfaces.

## Why

Home, Calendar week, and Workouts already shared most of their workout grammar,
while Calendar month had a separate title/sport-only tile. Keeping those as
route-local implementations made visual drift likely and made accessibility
labels inconsistent. Named variants express the real layout constraint without
turning each route into a bespoke card.

## Consequences

- New workout lists should use `SessionRow` and select the closest variant rather
  than add a new workout tile.
- The month variant intentionally hides the structure bar and visible metrics to
  preserve a readable seven-column grid; its accessible link name still carries
  duration, TSS, and status.
- Existing `compact` props remain accepted as compatibility aliases, but new
  callers should use `variant`/`size` names.
