# Completed status visibility cleanup

- **Date:** `2026-09-13`
- **Feature:** `ATHLETE-001`

## Behavior

- Completed sessions no longer render a visible `StatusBadge` anywhere a shared
  status badge is used.
- `SessionRow` no longer renders status badges and no longer accepts the
  `showStatus` prop.
- Calendar and Workouts no longer pass redundant status-visibility overrides.
- The Activity page no longer invokes a badge that was always for completed work.

## Files

- `components/tempo/SessionRow.tsx`
- `components/tempo/StatusBadge.tsx`
- `app/(app)/athlete/calendar/AthleteCalendarWeekScroller.tsx`
- `app/(app)/athlete/calendar/page.tsx`
- `app/(app)/athlete/workouts/page.tsx`
- `app/(app)/athlete/activity/page.tsx`
- `tests/architecture-boundaries.test.mjs`
- `DESIGN.md` and related agent-workspace records

## Verification

- Architecture regression was intentionally red before the implementation and
  passed afterward: 17 tests.
- `pnpm test` — 175 passing.
- `pnpm lint` — pass.
- `pnpm build` — pass; the existing middleware-to-proxy deprecation warning
  remains.
- `git diff --check` — pass.
