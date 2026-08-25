# Task: Show the complete athlete week overview

- **Status:** `completed`
- **Agent:** `OpenCode`
- **Started:** `2026-08-22`
- **Updated:** `2026-08-22`
- **Feature IDs:** `ATHLETE-001`
- **Related records:** [athlete feature](../features/athlete.md), [history](../history/2026-08-22-calendar-week-overview.md)

## Goal

Make the athlete week view show all seven Monday-to-Sunday day cards while
keeping the day navigation and today shortcut easy to understand.

## Starting Context

- Current behavior: The week surface centers and renders only a responsive
  subset of days, and the page header always shows `Back to today`.
- Existing owner/service: `AthleteCalendarWeekScroller` owns the client-side
  week navigation and `lib/athlete-service.ts` owns calendar reads.
- Related active or transitional work: Month calendar layout polish is complete.

## Plan

- [x] Render the active Monday-to-Sunday week in a responsive 1/2/3-column grid.
- [x] Move `Back to today` into the week controls and hide it when today is visible.
- [x] Run tests, lint, build, and diff checks.

## Progress Log

### 2026-08-22

- What changed: Replaced the centered subset window with the complete active
  week, arranged as one, two, or three columns by viewport width. Moved the
  today shortcut beside Earlier and Later and made it conditional on today
  being outside the visible week.
- Decision or discovery: Keeping Earlier/Later as day-by-day focus controls
  preserves the existing navigation model while the full week remains visible.
- Files touched: `app/(app)/athlete/calendar/page.tsx` and
  `app/(app)/athlete/calendar/AthleteCalendarWeekScroller.tsx`.
- Verification: `pnpm test` (115 passing), `pnpm lint`, `pnpm build`, and
  `git diff --check` passed on 2026-08-22.
- Blocker or next step: None.

## Verification

- `pnpm test` — 115 passing tests, 2026-08-22.
- `pnpm lint` — passed, 2026-08-22.
- `pnpm build` — passed, 2026-08-22; existing middleware deprecation warning.
- `git diff --check` — passed, 2026-08-22.

## Handoff / Completion

- **Final status:** `completed`
- **History record:** [calendar week overview](../history/2026-08-22-calendar-week-overview.md)
- **Feature records updated:** [athlete](../features/athlete.md), [work index](../WORK-INDEX.md)
- **Remaining work:** None for this task.
