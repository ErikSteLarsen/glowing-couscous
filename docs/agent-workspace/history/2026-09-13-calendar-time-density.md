# Calendar time density — 2026-09-13

## What changed

- Removed assignment times from visible workout rows in the athlete Calendar
  week and month views.
- Kept time data available to the session detail surface and unchanged on Home
  and Workouts.

## Files

- `app/(app)/athlete/calendar/page.tsx`
- `app/(app)/athlete/calendar/AthleteCalendarWeekScroller.tsx`
- `components/tempo/SessionRow.tsx`
- `docs/agent-workspace/features/athlete.md`
- `docs/agent-workspace/tasks/2026-09-08-week-at-a-glance-redesign.md`
- `docs/agent-workspace/WORK-INDEX.md`

## Verification

- `node --experimental-strip-types --test tests/athlete-calendar.test.ts` — 8
  passing.
- `pnpm lint` — pass.
- `git diff --check` — pass.
- Focused Impeccable detector for the changed Calendar and SessionRow targets —
  `[]`.

## Follow-up

- No follow-up is required for this scoped Calendar simplification.
