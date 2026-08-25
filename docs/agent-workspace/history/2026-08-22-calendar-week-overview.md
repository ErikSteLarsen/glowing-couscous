# Calendar Week Overview

- **Date:** 2026-08-22
- **Feature IDs:** `ATHLETE-001`
- **Task:** [calendar week overview](../tasks/2026-08-22-calendar-week-overview.md)

## Change

- The week view now renders all seven days from Monday through Sunday.
- Day cards use a responsive one, two, or three-column layout, allowing the
  complete week to span multiple clean rows without making cards too narrow.
- `Back to today` moved from the page header into the week controls, before
  Earlier and Later, and is hidden whenever the current day is visible.
- Session summaries are now full-card links to session detail; the redundant
  `Open session` action was removed.
- Week copy now describes the complete weekly overview rather than a centered
  subset scroller.

## Files

- `app/(app)/athlete/calendar/page.tsx`
- `app/(app)/athlete/calendar/AthleteCalendarWeekScroller.tsx`
- `docs/agent-workspace/features/athlete.md`
- `docs/agent-workspace/WORK-INDEX.md`

## Verification

- `pnpm test` — 115 passing tests on 2026-08-22.
- `pnpm lint` — passed on 2026-08-22.
- `pnpm build` — passed on 2026-08-22; existing Next.js middleware deprecation
  warning remains.
- `git diff --check` — passed on 2026-08-22.
