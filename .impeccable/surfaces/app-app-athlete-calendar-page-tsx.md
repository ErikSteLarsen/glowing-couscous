---
version: 1
slug: "app-app-athlete-calendar-page-tsx"
primary_target: "app/(app)/athlete/calendar/page.tsx"
related_targets: ["app/(app)/athlete/calendar/TrainingCalendar.tsx","app/(app)/athlete/planner/page.tsx"]
---

# Calendar surface

Mode: Operate. Extend the existing Monolith system for personal planning.

## Direction contract

THESIS: One calendar owns both seeing training and placing independent copies.
OWN-WORLD: Existing neutral surfaces, Schibsted typography, semantic status and intensity colors.
STORY: Scan the week, select a day, open Add session, choose saved content and review dates before scheduling.
FIRST VIEWPORT: Heading and Add session above a compact period toolbar. Seven day columns on wide desktop; date strip and selected-day agenda on phones. Scheduling opens an inline right panel, above the agenda on phones.
FORM: Calendar with contextual composer; code-led extension. Signature interaction: day-specific Add session seeds the composer while keeping the calendar visible.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
