---
version: 1
slug: "components-stravaactivitynotifications-tsx"
primary_target: "components/StravaActivityNotifications.tsx"
related_targets: ["components/StravaImportPanel.tsx", "components/AppShell.tsx"]
---

Mode: Operate. Extend the existing Monolith training workspace.

## Direction contract

THESIS: Review a newly recorded activity in context, with one activity at a time
and explicit completion, matching, or recoverable discard.

OWN-WORLD: Inherit semantic surface, text, border, overlay, and field tokens.
Use shared 40px/44px actions and fields, a native focus-managed modal, and the
established 20px dialog radius. No new global visual rules.

STORY: Return to training, see the recorded date, category and duration, then
choose a planned session or add a completed session. Discard hides notification
state only; Import remains the recovery surface. Review later acknowledges
the displayed batch without creating training outcomes.

FIRST VIEWPORT: A centered, bounded 40rem dialog presents a heading and review
count, the activity summary, editable name/category and match selector, then
discard beside one forward action. Narrow screens wrap actions and scroll
naturally. Pending and failure feedback stay with the operation.

FORM: Precisely specified local extension, code-led; no concept-seed required.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
