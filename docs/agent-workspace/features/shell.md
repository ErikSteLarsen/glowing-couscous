# Feature: Tempo Application Shell

- **ID:** `SHELL-001`
- **Status:** `shipped`
- **Last verified:** `2026-08-28`
- **Owner:** `components/AppShell.tsx`, `components/AppSidebar.tsx`, `lib/app-navigation.ts`, `app/globals.css`
- **Related work:** [architecture](../../../ARCHITECTURE.md), [baseline](../history/2026-08-21-baseline.md), [desktop UI sizing](../history/2026-08-28-desktop-ui-sizing.md), [sidebar viewport height](../history/2026-08-28-sidebar-viewport-height.md), [sizing decision](../decisions/0011-desktop-first-ui-sizing.md)

## Contract

Signed-in users get a responsive light Tempo shell. Desktop uses a viewport-high
sidebar with its own overflow; mobile uses a drawer plus bottom navigation.
Navigation is role-aware and marks the most specific route active.

## Live Path

- **Routes/UI:** `app/(app)/layout.tsx`, `components/AppShell.tsx`, `AppSidebar.tsx`.
- **Services:** `lib/app-navigation.ts`, `lib/auth-session.ts`.
- **Data:** current authenticated user and active-coach state.
- **Shared helpers/components:** `components/ui.tsx`, Tempo primitives, global CSS tokens.

## Behavior Already Implemented

- Coach navigation exposes Athletes, Planner, and Templates.
- Athlete navigation exposes Home, Calendar, Activity, optional Coach discovery,
  and Settings.
- Nested routes prefer the most specific matching navigation item.
- The desktop sidebar stays viewport-bounded when main-page content grows. Its
  footer remains at the bottom when the navigation fits and scrolls with the
  sidebar content when it does not.
- Page shells provide narrow/default/wide width tiers; planner and calendar use wide layouts.
- Global tokens define paper, surface, border, sage brand, zones, status colors,
  focus styles, tabular metrics, and pointer behavior. Shared primary,
  secondary, and danger actions also define consistent focus and disabled
  states.
- Shared action primitives now include explicit compact variants for dense
  desktop lists, editors, navigation, and segmented controls; standard controls
  remain the touch-friendly default.

## Verification

- `pnpm test` — 147 tests pass, including shell, navigation, accessibility,
  theme, layout, and sizing-contract assertions on 2026-08-28.
- `pnpm lint` — pass on 2026-08-28.
- `pnpm build` — pass on 2026-08-28; the existing middleware-to-proxy deprecation
  warning remains.
- `git diff --check` — pass on 2026-08-28.

## Known Gaps

- Mobile bottom navigation only shows the first four role navigation items.
- The shell has no notification or messaging surface; discovery labels messaging as coming soon.
- Manual browser viewport inspection of the revised desktop/narrow density and
  sidebar overflow remains a follow-up item.

## Extension Rules

- Add role navigation in `lib/app-navigation.ts` before changing shell rendering.
- Reuse `PageShell`, `TopBar`, `Surface`, and form tokens from `components/ui.tsx`.
- Keep auth pages outside the signed-in shell.
