---
version: 1
slug: "app-app-athlete-live-sessionid-page-tsx"
primary_target: "app/(app)/athlete/live/[sessionId]/page.tsx"
related_targets: ["app/(app)/athlete/live/[sessionId]/LiveSessionClient.tsx","app/(app)/athlete/session/[sessionId]/page.tsx","components/SessionPlanCanvas.tsx","lib/athlete-execution.ts"]
---

SCOPE: The authenticated athlete live execution route. Mode: Operate. The athlete needs to start and follow a scheduled workout accurately, primarily by reading the current block countdown, while controlling the whole session.

AUDIENCE AND TASK: An athlete uses the screen during training from a phone or desktop. Start, pause/resume, go back, finish a block early, skip a block, restart, and explicitly save completion. Block progress stays local; only completion is persisted. The final countdown offers a finish action and never completes the session without consent.

THESIS: Live mode is a working timer, not a static checklist. The current block owns the visual focus while a quieter session-remaining clock and complete workout score preserve orientation.

OWN-WORLD: Extend Tempo's Ink Is Movement system and workout-canvas grammar: paper and surface layers, indigo primary control, restrained zone colors, fine rules, continuous duration-weighted block bars, tabular numerals, and shared button/focus states. Avoid a dark fitness dashboard or gamified progress treatment.

STORY: Begin with a ready state and a prominent Start workout action. During execution the athlete sees the current block, target, note, large stable countdown, remaining-session time, and progress. Timed blocks advance automatically; manual next and skip are distinct. Pausing is reliable, going previous rewinds safely, and the final block stops at zero and offers completion. Refresh behavior is stated plainly.

FIRST VIEWPORT: On desktop, place the large current-block countdown and controls in the primary column, with the full session score and ordered upcoming blocks alongside. On mobile, show current block and large countdown first, a much smaller session countdown and progress next, then full-width touch controls above the secondary sequence. Start/pause and skip targets are generous; previous and next remain visible and labeled.

FORM: Extend the current authenticated shell and WorkoutCanvasEditor system in code. The experience remains familiar and quiet while the timer makes the current block unmistakable. Keep density responsive and the current block above the fold on a phone; reduced motion must not remove state information.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
