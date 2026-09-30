---
version: 1
slug: "app-app-layout-tsx"
primary_target: "app/(app)/layout.tsx"
related_targets: ["components/AppShell.tsx","components/AppSidebar.tsx","components/ui.tsx","app/globals.css"]
---

SCOPE: Authenticated shell. DESIGN.md is the sole production visual contract;
app/globals.css owns tokens and app/monolith.css owns Home/Workouts composition.

THESIS: Keep the next training action and Monday-first week legible in the
personal Monolith workspace. Neutral light/dark layers and contrasting primary
actions carry the work; cobalt is a restrained navigation/identity cue.

OWNERS: AppShell, AppSidebar, components/ui.tsx and lib/app-navigation.ts.
Desktop menu collapse releases its column and persists; sticky recovery restores
it. Mobile uses the focus-managed drawer and four grouped destinations. Preserve
focus return, inert content, scroll/resize cleanup, safe areas and reduced motion.

EVIDENCE: docs/agent-workspace/CURRENT-STATUS.md. Repeatable acceptance:
docs/VERIFICATION.md. This brief does not select a second theme.
