# Calendar Month Navigation

- **Date:** `2026-08-28`
- **Agent:** `OpenCode`
- **Feature IDs:** `ATHLETE-001`

## Changed Files

- `app/(app)/athlete/calendar/page.tsx`
- Athlete feature and work-index records

## Behavior

- Removed the month-view sentence explaining the compact daily summaries.
- Placed Previous and Next controls in a fixed left column, independent of the
  month label width.

## Verification

- `pnpm test` — 147 tests passed on 2026-08-28.
- `pnpm lint` — passed on 2026-08-28.
- `pnpm build` — passed on 2026-08-28; existing middleware deprecation warning
  remains.
- `git diff --check` — passed on 2026-08-28.
