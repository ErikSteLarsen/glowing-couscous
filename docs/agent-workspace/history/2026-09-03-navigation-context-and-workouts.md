# Navigation Context And Workouts

- **Date:** `2026-09-03`
- **Agent:** `OpenCode`
- **Feature IDs:** `SHELL-001`, `ATHLETE-001`

## Changed Files

- `lib/app-navigation.ts`
- `lib/athlete-service.ts`
- `components/AppSidebar.tsx`
- `components/AppProfileMenu.tsx`
- `app/(app)/athlete/workouts/page.tsx`
- `app/(app)/athlete/page.tsx`
- `app/(app)/athlete/calendar/page.tsx`
- `app/(app)/athlete/calendar/AthleteCalendarWeekScroller.tsx`
- `app/(app)/athlete/activity/page.tsx`
- `app/(app)/athlete/session/[sessionId]/page.tsx`
- `app/(app)/athlete/live/[sessionId]/page.tsx`
- Navigation/architecture tests and workspace records

## Behavior

- Added a Workouts page that lists all scheduled sessions and links each card to
  its specific detail route.
- Home, Calendar, Activity, and Workouts pass their origin into session detail;
  detail and Live return through that origin, while direct links default to
  Calendar.
- Month calendar sessions are independently linked, including multiple sessions
  on the same day.
- Removed Settings from primary navigation. Profile and Settings remain together
  in the profile section, with the current action highlighted and marked current.
- Workouts is highlighted for Workouts, session detail, and Live routes.

## Verification

- `pnpm exec node --test tests/app-shell-navigation.test.mjs tests/athlete-calendar.test.ts` — passed on 2026-09-03.
- `pnpm test` — 170 tests passed on 2026-09-03.
- `pnpm lint` — passed on 2026-09-03.
- `pnpm build` — passed on 2026-09-03; the existing middleware deprecation warning remains.
- `git diff --check` — passed on 2026-09-03.
