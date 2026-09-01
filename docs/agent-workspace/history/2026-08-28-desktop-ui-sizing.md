# Desktop UI Sizing And Typography Polish

- **Date:** `2026-08-28`
- **Agent:** `OpenCode`
- **Feature IDs:** `SHELL-001`, `ATHLETE-001`, `PLAN-001`, `TEMPLATE-001`
- **Task:** [desktop UI sizing](../tasks/2026-08-28-desktop-ui-sizing.md)
- **Decision:** [desktop-first contextual sizing](../decisions/0011-desktop-first-ui-sizing.md)

## Changed Files

- `components/ui.tsx`, `SignOutButton.tsx`, `AppProfileMenu.tsx`, `AppSidebar.tsx`
- `components/CoachRequestsPanel.tsx`, `SessionComparisonDialog.tsx`,
  `SessionComposer.tsx`, `components/tempo/Stepper.tsx`, `Toggle.tsx`
- Coach planner/template clients and athlete calendar, home, activity,
  discovery, session, and settings clients
- `tests/theme-accessibility.test.mjs`

## Behavior

- Added compact primary, secondary, danger, list, and segmented-control variants
  for dense desktop surfaces while preserving standard 44px controls.
- Reduced planner mode/list/editor utility controls, template card actions,
  calendar navigation, comparison controls, request actions, and profile signout.
- Made coach discovery and request actions stack safely on narrow screens.
- Raised selected dense session metadata from 11-12px to 12-14px where it carries
  workout information.
- Kept the toggle interaction target large while reducing the visible track to
  a compact 28px control and added an explicit focus ring.
- Changed ghost links to use a smaller, quieter inline footprint.

## Verification

- `pnpm test` — 146 tests passed on 2026-08-28.
- `pnpm lint` — passed on 2026-08-28.
- `pnpm build` — passed on 2026-08-28.
- `git diff --check` — passed on 2026-08-28.

The build continues to report the pre-existing Next.js warning that
`middleware.ts` is deprecated in favor of `proxy.ts`. No browser viewport
inspection was run in this environment.

## Follow-up

- Manually inspect representative desktop and narrow viewports for visual
  balance and any remaining long-label wrapping issues.
