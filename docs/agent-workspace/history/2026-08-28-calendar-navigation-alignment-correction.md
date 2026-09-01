# Calendar Navigation Alignment Correction

- **Date:** `2026-08-28`
- **Agent:** `OpenCode`
- **Feature IDs:** `ATHLETE-001`

## Changed Files

- `app/(app)/athlete/calendar/page.tsx`
- Athlete feature and work-index records

## Behavior

- Corrected the month header layout so the month label remains on the left and
  Previous/Next controls are anchored on the right.
- The controls remain stable when the displayed month name changes length.

## Verification

- `pnpm test` — 147 tests passed on 2026-08-28.
- `pnpm lint` — passed on 2026-08-28.
- `git diff --check` — passed on 2026-08-28.
