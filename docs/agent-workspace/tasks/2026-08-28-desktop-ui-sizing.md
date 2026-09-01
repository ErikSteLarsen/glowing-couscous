# Task: Desktop-first UI sizing and typography polish

- **Status:** `completed`
- **Agent:** `OpenCode`
- **Started:** `2026-08-28`
- **Updated:** `2026-08-28`
- **Feature IDs:** `SHELL-001`, `ATHLETE-001`, `PLAN-001`, `TEMPLATE-001`
- **Related records:** [shell](../features/shell.md), [athlete](../features/athlete.md), [planner](../features/planner.md), [templates](../features/templates.md)

## Goal

Make the application feel deliberately sized for computer browser use without
reducing the touch-friendly sizing of fields, live controls, or important
standalone actions.

## Starting Context

- Current behavior: shared actions default to approximately 44px high, while
  dense planner/template controls use a mixture of shared and ad hoc sizes.
- Existing owner/service: `components/ui.tsx` owns shared UI class contracts;
  route components own contextual action groups.
- Related active or transitional work: no active task overlaps the UI layer.

## Plan

- [x] Add compact shared action and segmented-control variants.
- [x] Apply compact sizing to dense desktop planner, template, navigation, and
  editor actions while preserving standard primary actions.
- [x] Improve small content typography and the visible toggle track.
- [x] Run lint, tests, and production build.
- [x] Update feature/workspace records with verification evidence.

## Progress Log

### 2026-08-28

- What changed: Task created after the application-wide sizing review.
- Decision or discovery: Preserve the existing 44px baseline for fields and
  important actions; introduce explicit compact variants for dense surfaces.
- Files touched: Workspace task record only.
- Verification: Not run; implementation has not started.
- Blocker or next step: Implement shared variants and route-level adoption.

### 2026-08-28

- What changed: Added shared compact action/list/segmented variants and applied
  them to dense planner, template, calendar, request, comparison, profile, and
  session-editing surfaces. Improved dense content text and the visible toggle.
- Decision or discovery: Standard 44px sizing remains for fields and important
  standalone actions; compact sizing is now explicit rather than ad hoc.
- Files touched: `components/ui.tsx`, Tempo/UI components, affected coach and
  athlete clients, and `tests/theme-accessibility.test.mjs`.
- Verification: `pnpm test` (146 pass), `pnpm lint`, `pnpm build`, and
  `git diff --check` passed on 2026-08-28.
- Blocker or next step: Browser viewport inspection remains follow-up work.

## Verification

- `pnpm test` — 146 passing tests, 2026-08-28
- `pnpm lint` — pass, 2026-08-28
- `pnpm build` — pass, 2026-08-28
- `git diff --check` — pass, 2026-08-28

## Handoff / Completion

- **Final status:** `completed`
- **History record:** [desktop UI sizing](../history/2026-08-28-desktop-ui-sizing.md)
- **Feature records updated:** [shell](../features/shell.md), [athlete](../features/athlete.md), [planner](../features/planner.md), [templates](../features/templates.md)
- **Remaining work:** Manual browser viewport inspection.
