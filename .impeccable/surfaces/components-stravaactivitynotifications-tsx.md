---
version: 1
slug: "components-stravaactivitynotifications-tsx"
primary_target: "components/StravaActivityNotifications.tsx"
related_targets: ["components/StravaImportPanel.tsx", "components/AppShell.tsx"]
---

Mode: Operate. Extend the existing Monolith training workspace.

## Direction contract

THESIS: Review new activities together when more than two arrive, with explicit
completion, individual planned-session matching, and recoverable dismissal.

OWN-WORLD: Inherit semantic surface, text, border, overlay, and field tokens.
Use shared 40px/44px actions and fields, a native focus-managed modal, and the
established 20px dialog radius. No new global visual rules.

STORY: Return to training, see the recorded date, category and duration, then
choose a planned session or add a completed session. Dismiss hides notification
state only; Import remains the recovery surface. Review later acknowledges
the displayed batch without creating training outcomes.

FIRST VIEWPORT: A centered, bounded 40rem dialog presents a heading and review
count. More than two activities open a scrollable selectable list with date,
category, duration and distance; bulk standalone add and dismissal stay together
in a footer. Individual Review opens editable name/category and matching in the
same dialog, with Back to list preserving drafts. The list remains as the batch
shrinks. One or two initial activities keep direct individual review. Imports run
sequentially with progress and stop on failure, preserving remaining selections.
Narrow screens wrap actions. Pending and failure feedback stay with the operation.

FORM: Precisely specified local extension, code-led; no concept-seed required.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
