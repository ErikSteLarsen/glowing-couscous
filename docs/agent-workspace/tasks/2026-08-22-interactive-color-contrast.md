# Task: Interactive color and contrast audit

- **Status:** `completed`
- **Agent:** `OpenCode`
- **Started:** `2026-08-22`
- **Updated:** `2026-08-22`
- **Feature IDs:** `SHELL-001`, `ATHLETE-001`, `COACH-001`, `CLEANUP-001`
- **Related records:** [shell](../features/shell.md), [athlete](../features/athlete.md), [coach](../features/coach.md), [decision 0009](../decisions/0009-active-tempo-ui-only.md), [history](../history/2026-08-22-interactive-color-contrast.md)

## Goal

Ensure buttons, links, controls, and their states remain legible and usable across the signed-in coach and athlete surfaces, especially the athlete "Start live" action, without changing unrelated visual styling.

## Starting Context

- Current behavior: The app has shared light Tempo primitives alongside older dark athlete UI classes. A reported "Start live" action is not visibly legible.
- Existing owner/service: Shared UI classes live in `components/ui.tsx` and `app/globals.css`; route-specific controls are colocated with their screens.
- Related active or transitional work: No active task was recorded. This is UI-only and does not change domain/service boundaries.

## Plan

- [x] Inventory rendered interactive controls and identify actual foreground/background contrast failures.
- [x] Apply the smallest shared or local class changes that fix those failures and simplify duplicate styling where safe.
- [x] Verify tests, lint, and production build; update feature, decision, and history records with evidence.

## Progress Log

### 2026-08-22

- What changed: Registered the task and began a source-level color audit.
- Decision or discovery: The repository contains both light token-driven controls and legacy dark athlete controls; fixes must be targeted to avoid flattening intentional status colors.
- Files touched: `docs/agent-workspace/tasks/2026-08-22-interactive-color-contrast.md`
- Verification: Not run; implementation has not started.
- Blocker or next step: Trace all button/link call sites and fix confirmed contrast failures.

### 2026-08-22

- What changed: Centralized primary, secondary, danger, sign-out, and coach-request action styling; added visible focus/disabled states; removed the unreferenced pre-Tempo athlete week/session component chain.
- Decision or discovery: The active `Start live` action already has a deliberate high-contrast dark/white pairing. The actual undefined color token was in the dead `AthleteCompletionCard` path, so deleting that chain is safer than maintaining a second visual system.
- Files touched: `components/ui.tsx`, `components/SignOutButton.tsx`, `components/CoachRequestsPanel.tsx`, `app/(app)/coach/templates/CoachTemplatesClient.tsx`, `tests/theme-accessibility.test.mjs`, and the removed files listed in [decision 0009](../decisions/0009-active-tempo-ui-only.md).
- Verification: Targeted test updates are in place; full verification is next.
- Blocker or next step: Run the full test suite, lint, and production build, then record results.

### 2026-08-22

- What changed: Completed the full test, lint, build, and diff verification; updated feature/index/status records and added the append-only history record.
- Decision or discovery: The active `Start live` contrast defect was later reproduced from the rendered markup: unlayered `a { color: inherit; }` in `app/globals.css` overrode the `text-white` utility. The stale unreferenced dark athlete chain was removed rather than restyled.
- Files touched: `docs/agent-workspace/CURRENT-STATUS.md`, `WORK-INDEX.md`, feature records, decision 0009, and history 2026-08-22.
- Verification: The focused regression was red before the fix and green afterward; `pnpm test` passed 115 tests; `pnpm lint`, `pnpm build`, and `git diff --check` passed on 2026-08-22.
- Blocker or next step: None for this task. Browser E2E visual coverage remains a separate follow-up.

### 2026-08-22 follow-up

- What changed: Moved the global anchor color inheritance rule into `@layer base`, allowing Tailwind text utilities on links such as `Start live` to win the cascade.
- Decision or discovery: The user-provided rendered class was the minimal reproduction. The issue was CSS cascade order, not the `ActionLink` color pair or missing Tailwind output.
- Files touched: `app/globals.css`, `tests/theme-accessibility.test.mjs`, and this task record.
- Verification: `node --test tests/theme-accessibility.test.mjs` failed before the CSS fix and passed after it; full `pnpm test` passed 115 tests; lint, build, and diff check passed.
- Blocker or next step: None.

## Verification

- `pnpm test` — pass, 115 tests, 2026-08-22
- `pnpm lint` — pass, 2026-08-22
- `pnpm build` — pass, 2026-08-22; existing Next.js middleware deprecation warning
- `git diff --check` — pass, 2026-08-22

## Handoff / Completion

- **Final status:** `completed`
- **History record:** [interactive color and contrast audit](../history/2026-08-22-interactive-color-contrast.md), [anchor cascade follow-up](../history/2026-08-22-interactive-color-cascade-fix.md)
- **Feature records updated:** [shell](../features/shell.md), [athlete](../features/athlete.md), [coach](../features/coach.md), [compatibility](../features/compatibility.md)
- **Remaining work:** Browser E2E visual coverage is not configured; remaining transitional planner helpers need separate cleanup analysis.
