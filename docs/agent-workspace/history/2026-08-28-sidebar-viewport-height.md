# Sidebar Viewport Height

- **Date:** `2026-08-28`
- **Agent:** `OpenCode`
- **Feature IDs:** `SHELL-001`
- **Task:** [sidebar viewport height](../tasks/2026-08-28-sidebar-viewport-height.md)

## Changed Files

- `components/AppSidebar.tsx`
- `tests/app-shell-navigation.test.mjs`
- Shell workspace records under `docs/agent-workspace/`

## Behavior

- Desktop sidebar is sticky, exactly viewport-high, and aligned to the top of
  the grid rather than stretching with main-page content.
- Sidebar vertical overflow is local to the sidebar, so long menu content does
  not extend the overall sidebar beyond the viewport.
- The inner sidebar column has a minimum viewport height, keeping the profile
  footer at the bottom whenever all navigation content fits.
- Mobile drawer behavior remains fixed to the viewport and now also handles
  overflowing menu content locally.

## Verification

- `pnpm test` — 147 tests passed on 2026-08-28.
- `pnpm lint` — passed on 2026-08-28.
- `pnpm build` — passed on 2026-08-28; existing middleware deprecation warning
  remains.
- `git diff --check` — passed on 2026-08-28.

## Follow-up

- Manually inspect representative desktop and narrow viewports to confirm the
  footer position and sidebar scroll affordance visually.
