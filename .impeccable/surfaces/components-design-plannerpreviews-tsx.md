# Planner Preview Directions

- **Mode:** Operate
- **Audience:** Athletes and coaches who need to place reusable workouts and templates on a future schedule.
- **Job:** Understand what is already assigned, choose a source, and place it on a day, week, or month without losing calendar context.
- **Primary action:** Drag or add a selected source to an explicit calendar target; keep an explicit button path for keyboard and touch users.
- **Proof/content:** A Monday-first week, a readable month overview, assigned session summaries, source types, cadence, and an immediate confirmation of the selected target.
- **Constraints:** Preview-only routes under `/design/*`; use synthetic sample data; do not change planner persistence; preserve Tempo's established visual system and accessible text states.

These are historical developer-only studies; their paper/indigo palette does
not override production Monolith in DESIGN.md.

## Direction contract

### THESIS
The planner is a placement surface, not a form with a calendar beside it. These previews refuse the category-default dashboard of equal cards by making the schedule the primary object and keeping source selection close to the exact drop target.

### OWN-WORLD
Warm paper, indigo ink, blue-gray connective rules, compact session marks, and a narrow source index carry the established Tempo studio. Calendar cells are quiet paper fields; only the active target and one forward action use signal ink. Status colors explain completion or adjustment without becoming decoration.

### STORY
The visitor sees the week or month, recognizes the already-planned rhythm, selects a reusable workout or template, and places it where it belongs. Dragging remains a shortcut in the week and dispatch directions; Atlas uses explicit date selection and one assignment action. Every placement leaves the calendar visibly changed.

### FIRST VIEWPORT
Each route opens with a restrained page heading and the assignment mechanism already at work below it. `Field` leads with a seven-column week wall and source dock. The revised Atlas directions lead with a compact month map, separate workout/template search tabs, multi-day workout selection, and a selected-day rail. `Dispatch` leads with a compact week timeline, a source queue, and a multi-day target strip. The main action stays beside the selected source, never below an unrelated form.

### FORM
Three compositions are shipped as equal preview routes: `Field` (calendar-first drop wall), `Atlas` (month overview plus three assignment directions), and `Dispatch` (queue-to-target placement). Atlas now compares `Select days` (multi-date workout selection), `Template range` (start/end duration validation), and `Planning desk` (source search, month, and selected-day detail in one view). They are translated into the existing Tempo palette rather than new visual identities. Seed key: `2a8cc394`.

### FINISH
unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Production relationship

Production uses components/PlannerDesk.tsx with explicit source/date placement.
Template ranges follow exact day/week/month cadence; broader recurrence is not
implemented. Deferred preview browser comparisons are listed in CURRENT-STATUS.md.
