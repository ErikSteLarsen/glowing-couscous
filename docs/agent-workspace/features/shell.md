# Feature: Tempo Application Shell

- **ID:** `SHELL-001`
- **Status:** `in-progress`
- **Last verified:** `2026-09-08`
- **Owner:** `components/AppShell.tsx`, `components/AppSidebar.tsx`, `lib/app-navigation.ts`, `app/globals.css`
- **Related work:** [architecture](../../../ARCHITECTURE.md), [baseline](../history/2026-08-21-baseline.md), [desktop UI sizing](../history/2026-08-28-desktop-ui-sizing.md), [sidebar viewport height](../history/2026-08-28-sidebar-viewport-height.md), [navigation context and workouts](../history/2026-09-03-navigation-context-and-workouts.md), [sizing decision](../decisions/0011-desktop-first-ui-sizing.md), [navigation decision](../decisions/0014-contextual-athlete-navigation.md)

## Contract

Signed-in users get a responsive light week-first Tempo shell. Desktop uses a viewport-high
sidebar with its own overflow; mobile uses a drawer plus bottom navigation.
Navigation is role-aware and marks the most specific route active.

## Live Path

- **Routes/UI:** `app/(app)/layout.tsx`, `components/AppShell.tsx`, `AppSidebar.tsx`.
- **Services:** `lib/app-navigation.ts`, `lib/auth-session.ts`.
- **Data:** current authenticated user and active-coach state.
- **Shared helpers/components:** `components/ui.tsx`, Tempo primitives, global CSS tokens.

## Behavior Already Implemented

- Coach navigation exposes Athletes, Workouts, Planner, and Templates.
- Athlete navigation exposes Home, Workouts, Planner, Templates, Calendar,
  Activity, and optional Coach discovery.
- The sidebar labels the purpose of Workouts (author), Planner (place), and
  Templates (reuse); pages do not duplicate the workspace menu.
- Nested routes prefer the most specific matching navigation item.
- Workouts is the active sidebar context for the Workouts list, session detail,
  and live execution routes.
- Profile and Settings remain in the sidebar profile section, and the currently
  viewed profile action is highlighted with `aria-current="page"`.
- The desktop sidebar stays viewport-bounded when main-page content grows. Its
  footer remains at the bottom when the navigation fits and scrolls with the
  sidebar content when it does not.
- Page shells provide narrow/default/wide/wall width tiers; planner and calendar use wide layouts.
- Global tokens define a light week-first work surface, a blue action signal,
  muted zone presentation, semantic status colors,
  focus styles, tabular metrics, and pointer behavior. Shared primary,
  secondary, and danger actions also define consistent focus and disabled
  states.
- Shared action primitives now include explicit compact variants for dense
  desktop lists, editors, navigation, and segmented controls; standard controls
  remain the touch-friendly default.
- Workspace navigation cards retain a minimum touch-sized target and expose
  `aria-current` for the active job.

## Verification

- `pnpm test` — 147 tests pass, including shell, navigation, accessibility,
  theme, layout, and sizing-contract assertions on 2026-08-28.
- `pnpm lint` — pass on 2026-08-28.
- `pnpm build` — pass on 2026-08-28; the existing middleware-to-proxy deprecation
  warning remains.
- `git diff --check` — pass on 2026-08-28.
- `pnpm test` — 170 passing tests on 2026-09-03, including origin-aware session
  navigation, Workouts route, and profile active-state assertions.
- `pnpm lint`, `pnpm build`, and `git diff --check` — pass on 2026-09-03; the
  existing middleware-to-proxy deprecation warning remains.
- `pnpm test` — 175 passing tests on 2026-09-07 after the workspace IA audit;
  `pnpm lint`, `pnpm build`, `git diff --check`, and the Impeccable detector pass.
- 2026-09-08 headed Chrome acceptance — authenticated shell and role-aware
  navigation loaded at 390×844, 1280×900, 1440×1000, and 1920×1080 with no
  horizontal overflow, runtime exceptions, or console errors. Mobile drawer
  focus stayed contained for ten Tab cycles; Escape recovery and focus
  restoration passed. The OpenCode desktop-browser bridge remained disconnected,
  while local headed Chrome supplied real pointer media and screenshots.
- 2026-09-09 continuation — the connected desktop-browser bridge was checked
  again after restart and remains unavailable; no new visual acceptance is
  claimed. `pnpm test` (175), `pnpm lint`, `pnpm build`, `git diff --check`, and
  the focused Impeccable detector (`[]`) pass.

## Known Gaps

- Mobile bottom navigation only shows the first four role navigation items.
- The shell has no notification or messaging surface; discovery labels messaging as coming soon.
- Bridge-backed desktop browser automation is unavailable; local headed Chrome
  supplied the responsive viewport and interaction evidence for this redesign.
- A public visual direction comparison remains available at `/design/tempo-split`
  and `/design/tempo-field`; those previews are historical evidence. The active
  production shell is the week-at-a-glance Training Calendar Wall.

## Visual Direction Work

- 2026-09-08: Added two isolated, responsive athlete dashboard previews to
  compare a high-signal split-board system with a warmer field-notes system.
  Both use the same Tempo content and interaction states. See
  [task](../tasks/2026-09-08-tempo-design-directions.md) and
  [history](../history/2026-09-08-tempo-design-directions.md).

- 2026-09-08: The split-board direction was selected and refined into a
  restrained navy/cool-white system. The production shell, shared primitives,
  forms, planner, calendar, session, activity, and sharing surfaces now use the
  selected tokens. See [decision](../decisions/0016-tempo-navy-split-board.md)
  and [history](../history/2026-09-08-tempo-navy-split-board.md).

- 2026-09-08: A bounded surface review removed remaining old-theme color drift,
  aligned mobile navigation state semantics, and tightened auth/settings/live
  feedback. See [history](../history/2026-09-08-tempo-surface-review.md).

- 2026-09-08: The product owner selected a replacement week-at-a-glance world;
  shared tokens, mobile destinations, and athlete Home/Calendar foundations are
  being migrated in bounded batches. See [task](../tasks/2026-09-08-week-at-a-glance-redesign.md).

- 2026-09-08: Local headed Chrome acceptance completed the authenticated shell
  review. The week-at-a-glance system is the shipped production direction; the
  earlier split-board comparison remains historical rather than active.

## Extension Rules

- Add role navigation in `lib/app-navigation.ts` before changing shell rendering.
- Reuse `PageShell`, `TopBar`, `Surface`, and form tokens from `components/ui.tsx`.
- Keep auth pages outside the signed-in shell.
