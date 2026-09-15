---
version: 1
slug: "workout-flow-previews"
primary_target: "components/design/WorkoutFlowPreviews.tsx"
related_targets: ["app/design/workout-flow/flowline/page.tsx", "app/design/workout-flow/workbench/page.tsx", "app/design/workout-flow/trail/page.tsx", "app/globals.css"]
---

THESIS: The workout builder should explain the shape of a session while it is
being made. These previews refuse the opaque editor-first arrangement and put
sequence, intent, and next action in the same field.

OWN-WORLD: Keep Tempo's warm paper, indigo action ink, blue-gray flow lines,
semantic zone colors, Schibsted Grotesk, fine rules, square controls, and quiet
inset depth. The three previews differ in topology and pacing, not brand.

STORY: A coach can see what to do first, add a familiar block without learning
the data model, move or edit a block without relying on a pointer, and understand
how the finished workout reads before saving it. The routes are sample-data
previews, never connected to account persistence.

FIRST VIEWPORT: Each route opens with a concise comparison bar and a decisive
authoring surface. Flowline makes the sequence a connected horizontal journey,
Workbench puts library, sequence, and inspector in one focused split, and Trail
turns creation into four named stages with a persistent summary and next action.
On mobile the composition becomes a readable vertical sequence with the primary
action and reorder controls still reachable.

FORM: The surface round's three dealt structures are Flowline (seed f2a373e6,
lead), Workbench, and Trail. All three carry sample blocks, clickable presets,
selection, inspector edits, and explicit earlier/later controls. Dragging is a
durable accelerator rather than the only ordering mechanism.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
