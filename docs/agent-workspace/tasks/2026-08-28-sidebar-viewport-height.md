# Task: Keep desktop sidebar viewport-bounded

- **Status:** `completed`
- **Agent:** `OpenCode`
- **Started:** `2026-08-28`
- **Updated:** `2026-08-28`
- **Feature IDs:** `SHELL-001`
- **Related records:** [shell](../features/shell.md)

## Goal

Keep the desktop sidebar at the viewport height instead of allowing main-page
content to stretch it, while keeping the profile footer at the bottom whenever
the navigation content fits.

## Starting Context

- Current behavior: the desktop sidebar is a static grid item with a full-height
  child, so a long main page can make the sidebar extend beyond the viewport.
- Existing owner/service: `components/AppSidebar.tsx` and the signed-in shell.
- Related active or transitional work: no active task overlaps the shell.

## Plan

- [x] Bound the desktop sidebar to the viewport and keep overflow local to it.
- [x] Add a regression assertion and run repository checks.
- [x] Update shell workspace records with verification evidence.

## Progress Log

### 2026-08-28

- What changed: Task registered before changing the shell layout.
- Decision or discovery: Use a desktop sticky viewport-height sidebar with an
  internally scrollable overflow path; retain the existing mobile fixed drawer.
- Files touched: Workspace task record and work index.
- Verification: Not run; implementation has not started.
- Blocker or next step: Update `AppSidebar.tsx` and the shell navigation tests.

### 2026-08-28

- What changed: Desktop sidebar now uses viewport-height sticky positioning and
  local vertical overflow; its inner flex column preserves bottom footer
  placement when content fits.
- Decision or discovery: The mobile fixed drawer remains unchanged in behavior;
  the same local overflow also prevents tall mobile menu content from escaping
  the drawer viewport.
- Files touched: `components/AppSidebar.tsx`,
  `tests/app-shell-navigation.test.mjs`, and shell workspace records.
- Verification: `pnpm test` (147 pass), `pnpm lint`, `pnpm build`, and
  `git diff --check` passed on 2026-08-28.
- Blocker or next step: Manual browser viewport inspection remains follow-up.

## Verification

- `pnpm test` — 147 tests pass, 2026-08-28
- `pnpm lint` — pass, 2026-08-28
- `pnpm build` — pass, 2026-08-28
- `git diff --check` — pass, 2026-08-28

## Handoff / Completion

- **Final status:** `completed`
- **History record:** [sidebar viewport height](../history/2026-08-28-sidebar-viewport-height.md)
- **Feature records updated:** [shell](../features/shell.md)
- **Remaining work:** Manual browser viewport inspection.
