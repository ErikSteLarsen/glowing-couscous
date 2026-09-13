# Calendar status density — 2026-09-13

## What changed

- Removed visible planned/completed status badges from workout rows in the
  athlete Calendar week and month views.
- Completed workouts are subtly muted so incomplete work stands out without
  changing the status treatment on Home or Workouts.
- Preserved status in accessible session labels for non-visual users.

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
- `pnpm exec tsc --noEmit` — existing unrelated test fixture errors remain in
  coach planner/assignment and session comparison tests; no errors were
  reported in the changed Calendar or SessionRow source.

## Follow-up

- No follow-up is required for this scoped Calendar simplification.
