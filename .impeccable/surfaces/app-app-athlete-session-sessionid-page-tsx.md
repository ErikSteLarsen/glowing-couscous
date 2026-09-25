---
version: 1
slug: "app-app-athlete-session-sessionid-page-tsx"
primary_target: "app/(app)/athlete/session/[sessionId]/page.tsx"
related_targets: ["app/(app)/athlete/session/[sessionId]/SessionDetailClient.tsx","app/(app)/athlete/live/[sessionId]/page.tsx","app/(app)/athlete/live/[sessionId]/LiveSessionClient.tsx","components/WorkoutLibraryClient.tsx","lib/athlete-service.ts"]
---

SCOPE: The authenticated athlete session detail route. Mode: Operate. The athlete needs to understand the scheduled copy, inspect its full block sequence, and choose the next action without mistaking it for the reusable workout definition.

AUDIENCE AND TASK: An athlete opens a calendar session to understand its structure, timing, target, and status, then starts it or follows a source-workout link when one is safely editable. The detail view is read-only; live completion remains an explicit action in the live flow. Preserve ownership boundaries and the established Tempo shell.

THESIS: The scheduled session is a readable score, not an inline editor. It rejects editable forms on the dated copy and puts the full workout sequence ahead of metadata.

OWN-WORLD: Extend Tempo's Ink Is Movement system: warm paper, indigo action ink, blue-gray focus/flow, restrained status and zone colors, fine rules, shared controls, and continuous duration-proportional session bars. Reuse the WorkoutCanvasEditor visual vocabulary without its editing tools.

STORY: Read the plan at a glance, scan every block and its target, then start live execution. Completed sessions expose their saved outcome note and comparison without inline correction controls. An athlete-owned reusable source may be opened in Workouts; that action must explain that the scheduled copy stays independent.

FIRST VIEWPORT: Keep the shared page heading and contextual date/status row aligned with the shell. The session score dominates the content: full-width interval canvas, planned duration and load, then a numbered block list. A compact side rail carries the next action, source-workout link, and read-only outcome context; on mobile, stack this after the score and preserve the primary live action near the heading.

FORM: Extend the existing authenticated session surface and WorkoutCanvasEditor language. The route remains an Operate surface inside Ink Is Movement; chart segments retain zone-height and duration-width semantics, while explicit labels keep pauses and skipped blocks legible. No new visual tokens or authoring surface.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
