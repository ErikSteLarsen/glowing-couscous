# Week-at-a-glance shared system extraction

- **Status:** `in-progress`
- **Direction:** The Training Calendar Wall
- **Source inventory:** `app/globals.css`, `components/ui.tsx`,
  `components/AppShell.tsx`, `components/AppSidebar.tsx`, `components/tempo/*`

## Existing reusable seams

- Global semantic tokens already exist for page, surface, field, border, text,
  brand, status, navigation, shadows, and workout-zone presentation.
- `PageShell`, `TopBar`, `ActionLink`, `Surface`, `StatTile`, `Badge`,
  `EmptyState`, form classes, segmented choices, and action variants are the
  shared composition layer.
- `AppShell` and `AppSidebar` own responsive role-aware navigation.
- `StatusBadge`, `MetricText`, `SessionBlockBar`, `Stepper`, and `Toggle` are
  domain-specific Tempo primitives.

## Target extraction plan

1. Replace the incumbent color/radius/shadow vocabulary with semantic
   week-first tokens while preserving zone data and status semantics.
2. Make `PageShell`, `TopBar`, `Surface`, and action variants express one
   consistent week-aware density and focus treatment.
3. Add only repeated patterns that appear across at least three families:
   week header/navigation, session row, status marker, metric cluster, and
   empty/error feedback.
4. Migrate shared shell and athlete weekly surfaces first; leave route-specific
   composition local until its family critique identifies a repeated pattern.

## Extraction guardrails

- Do not create a generic card abstraction for every bordered region.
- Do not change service reads, API contracts, session links, or persistence.
- Keep 44px interaction targets, visible keyboard focus, non-color state cues,
  and readable dense-data typography.
- Verify populated, empty, loading, error, success, permission, desktop, and
  mobile states per family.
