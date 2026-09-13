# Calendar empty summary removal — 2026-09-13

## What changed

- Removed the standalone “No sessions this week” / “Assigned sessions will
  appear here” section from the athlete Calendar route.
- Kept empty days represented directly inside the week or month calendar view,
  so Calendar now ends with the calendar surface instead of a duplicate workout
  summary.

## Files

- `app/(app)/athlete/calendar/page.tsx`
- `docs/agent-workspace/features/athlete.md`
- `docs/agent-workspace/tasks/2026-09-08-week-at-a-glance-redesign.md`
- `docs/agent-workspace/WORK-INDEX.md`

## Verification

- `node --experimental-strip-types --test tests/athlete-calendar.test.ts` — 8
  passing.
- `pnpm lint` — pass.
- `git diff --check` — pass.
- Focused Impeccable detector for `app/(app)/athlete/calendar/page.tsx` — `[]`.
- `pnpm test` — not completed; the suite exceeded the available timeout with
  171 tests passed and one unrelated long-running test pending.
- `pnpm build` — not completed; compilation and TypeScript passed, but the
  command exceeded the available timeout during page-data collection.

## Follow-up

- No follow-up is required for this scoped Calendar simplification.
