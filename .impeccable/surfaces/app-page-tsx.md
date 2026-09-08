---
version: 1
slug: "app-page-tsx"
primary_target: "app/page.tsx"
related_targets: []
---

# Tempo visual direction demos

## Scope and visitor mode

Operate: a public visual comparison board for an authenticated athlete dashboard.

## Audience, job, action, proof, constraints

Athletes need to find the next workout, understand its shape, and start without
sorting through a dashboard. The comparison must keep Tempo's real vocabulary
(`Today`, `Next up`, `This week`, workout blocks, zones, activity), use the same
synthetic demo data in both directions, stay responsive, and avoid changing
production behavior before the owner selects a system.

## Chosen direction and memorable moment

Direction A is a race split-board: compact, high-signal, and instrument-like.
Direction B is a tactile field notebook: warmer, calmer, and rhythm-led. The
memorable moment is the next workout card making the immediate action obvious in
one glance.

## Direction contract

THESIS: Tempo should feel like a training instrument, not a generic dashboard;
the demos refuse the stacked card-and-metric default.
OWN-WORLD: A uses a graphite track-board with a mint signal and hard grid rails;
B uses ink-blue paper, citrus marks, and notebook rules with rounded editorial
controls.
STORY: The athlete sees today's work, understands the week's load, and starts the
next session with confidence.
FIRST VIEWPORT: Persistent side rail, a wide today/next-up stage, then the week
strip and recent activity; the primary action sits inside the next-up surface.
FORM: Two parallel direction demos, derived from the athlete's operating scene;
seed key `57960a6a` (assigned index 3).
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Unresolved decisions

Select one direction before applying tokens to the authenticated shell and
shared primitives.
