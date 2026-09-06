# Task: Navigation context and workouts

- **Status:** `completed`
- **Agent:** `OpenCode`
- **Started:** `2026-09-03`
- **Updated:** `2026-09-03`
- **Feature IDs:** `SHELL-001`, `ATHLETE-001`
- **Related records:** [shell](../features/shell.md), [athlete](../features/athlete.md)

## Goal

Make athlete navigation predictable when moving between Home, Calendar, Activity,
Workouts, and session detail. The left navigation should show Workouts as the
active context for workout detail/live routes, and Settings should only appear
inside the profile section with its active state visible.

## Starting Context

- Current behavior: session detail always links back to Calendar, even when it
  was opened from Home or Activity; the month calendar links an entire day to
  only its first session; Settings appears in both primary and profile menus.
- Existing owner/service: `components/AppSidebar.tsx`,
  `components/AppProfileMenu.tsx`, `lib/app-navigation.ts`, and
  `lib/athlete-service.ts`.
- Related active or transitional work: the completed Home per-session navigation
  task and the shipped athlete/session surfaces.

## Plan

- [x] Add a Workouts route and active navigation context for workout detail.
- [x] Preserve the source page in session links and use it for the detail back action.
- [x] Move Settings out of primary navigation and highlight Profile/Settings links.
- [x] Run focused tests and repository gates, then update workspace records.

## Progress Log

### 2026-09-03

- What changed: Registered the navigation consistency task after tracing all
  athlete session entry points and the current shell matching behavior.
- Decision or discovery: A small origin query on session links avoids browser
  history-dependent back behavior while allowing direct session URLs to retain
  Calendar as the default fallback.
- Files touched: this task record and `WORK-INDEX.md`.
- Verification: Source inspection completed; implementation verification pending.
- Blocker or next step: Add the Workouts read model/page and update all session
  entry points and shell active-state rendering.

### 2026-09-03

- What changed: Added the Workouts route/read model, origin-aware Home/Calendar/
  Activity/Workouts session links, dynamic session back targets, independent
  month-cell workout links, and active profile navigation states.
- Decision or discovery: Workouts is the shared active context for session detail
  and live execution, while direct session URLs fall back to Calendar.
- Files touched: `lib/app-navigation.ts`, `lib/athlete-service.ts`,
  `components/AppSidebar.tsx`, `components/AppProfileMenu.tsx`, and athlete
  route pages under `app/(app)/athlete/`.
- Verification: Pending focused tests and repository gates.
- Blocker or next step: Verify JSX/types and update the shell/athlete records.

### 2026-09-03

- What changed: Completed the Workouts destination, origin-aware session/live
  navigation, independent month session links, and profile-owned Settings
  highlighting.
- Decision or discovery: Recorded the contextual navigation contract in
  `decisions/0014-contextual-athlete-navigation.md`.
- Files touched: Source, tests, route/architecture guidance, feature records,
  and the new history entry.
- Verification: `pnpm test` — 170 passing; `pnpm lint` — pass; `pnpm build` —
  pass with the existing middleware deprecation warning; `git diff --check` —
  pass after the final source diff.
- Blocker or next step: None.

## Verification

- `pnpm exec node --test tests/app-shell-navigation.test.mjs tests/athlete-calendar.test.ts` — passed on 2026-09-03.
- `pnpm test` — 170 passing on 2026-09-03.
- `pnpm lint` — passed on 2026-09-03.
- `pnpm build` — passed on 2026-09-03; existing middleware deprecation warning remains.
- `git diff --check` — passed on 2026-09-03.

## Handoff / Completion

- **Final status:** `completed`
- **History record:** [Navigation context and Workouts](../history/2026-09-03-navigation-context-and-workouts.md)
- **Feature records updated:** [shell](../features/shell.md), [athlete](../features/athlete.md), [work index](../WORK-INDEX.md)
- **Remaining work:** Manual browser viewport inspection remains a general shell gap.
