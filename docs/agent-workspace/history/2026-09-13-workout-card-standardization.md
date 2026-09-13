# Workout card standardization

- **Date:** 2026-09-13
- **Feature:** `ATHLETE-001`
- **Behavior:** Home week cards, Calendar week cards, Calendar month workout
  tiles, and scheduled Workouts cards now use one `SessionRow` workout-card
  component with `default`, `compact`, and `month` variants. The month view no
  longer carries a second route-local workout-card implementation. The default
  card uses a dedicated card-sized block bar; compact/month layouts preserve the
  existing calendar density decisions.
- **Files:** `components/tempo/SessionRow.tsx`,
  `components/tempo/SessionBlockBar.tsx`, `app/(app)/athlete/page.tsx`,
  `app/(app)/athlete/calendar/page.tsx`,
  `app/(app)/athlete/calendar/AthleteCalendarWeekScroller.tsx`,
  `app/(app)/athlete/workouts/page.tsx`, `DESIGN.md`, and workspace records.
- **Verification:** `pnpm test` (175 passing), `pnpm lint`, `pnpm build`,
  `git diff --check`, and Impeccable detector (`[]`). Build retains the existing
  middleware-to-proxy deprecation warning. Browser inspection was not run because
  the desktop browser bridge is disconnected.
- **Follow-up:** Review the variants at 390px, intermediate desktop, and wall
  widths when browser access is available; keep new workout lists on `SessionRow`.
