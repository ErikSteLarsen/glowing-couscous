# Calendar Copy Polish

- **Date:** `2026-08-28`
- **Agent:** `OpenCode`
- **Feature IDs:** `ATHLETE-001`

## Changed Files

- `app/(app)/athlete/calendar/AthleteCalendarWeekScroller.tsx`
- Athlete feature and workspace status records

## Behavior

- Removed the idle helper text explaining that earlier and later weeks load as
  the user moves through the calendar.
- Loading feedback remains visible only while an adjacent week request is active.

## Verification

- `pnpm test` — 147 tests passed on 2026-08-28.
- `pnpm lint` — passed on 2026-08-28.
- `git diff --check` — passed on 2026-08-28.
