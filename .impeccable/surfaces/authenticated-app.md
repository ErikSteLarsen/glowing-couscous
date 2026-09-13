---
version: 1
slug: "authenticated-app"
primary_target: "app/(app)/layout.tsx"
related_targets:
  - "components/AppShell.tsx"
  - "components/AppSidebar.tsx"
  - "components/ui.tsx"
  - "app/globals.css"
  - "app/(app)/athlete/page.tsx"
  - "app/(app)/athlete/calendar/page.tsx"
  - "app/(app)/coach/page.tsx"
  - "app/(app)/coach/planner/page.tsx"
---

# Tempo authenticated app

## Scope and visitor mode

Operate: authenticated athlete and coach workspace, redesigned in bounded page
families. Auth/onboarding and public sharing remain outside the first pass.

## Audience, job, action, proof, constraints

Athletes and coaches need to plan, scan, execute, and review a structured
Monday-first endurance week. The product-specific proof is the preserved
relationship between workout blocks, planned sessions, completion outcomes, and
reusable coach-authored sources. Preserve routes, service boundaries, role
ownership, copy truth, structured metrics, state coverage, keyboard access,
responsive behavior, and existing save/completion semantics.

## Chosen direction and memorable moment

The Training Calendar Wall: the week is the primary organizing object, with
clear day/session grouping, explicit state, compact metadata, and a visible
current/next action. The memorable moment is understanding the whole week and
the next useful action without leaving the same operating context.

## Direction contract

THESIS: Tempo is a week-first training workspace; it refuses the incumbent dark split-board and generic card-grid default.
OWN-WORLD: A light high-contrast work surface uses aligned day/session groupings, restrained borders, one active-day signal, and status colors with clear non-color cues.
STORY: The athlete or coach sees the week, knows what matters now, acts, and can later compare planned work with what happened.
FIRST VIEWPORT: The shell frames a wide week-aware work surface; Home and Calendar lead with the current Monday week, today/next action, and visible session status before secondary history.
FORM: Week-at-a-glance planner, safer-register pick; seed key `c1410433`, reroll 1.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved decisions

Exact token values, responsive breakpoints, and family-specific compositions are
to be extracted from the shared implementation and resolved in bounded review
batches. No domain behavior or service ownership may be invented in UI work.
