# Task: Polish athlete month calendar layout

- **Status:** `completed`
- **Agent:** `OpenCode`
- **Started:** `2026-08-22`
- **Updated:** `2026-08-22`
- **Feature IDs:** `ATHLETE-001`
- **Related records:** [athlete feature](../features/athlete.md)

## Goal

Make the athlete month calendar easier to scan by placing month navigation next
to the month it controls and improving spacing and small-screen readability.

## Starting Context

- Current behavior: Month navigation sits in the page header and wraps into a
  separate row at common desktop widths; the month grid has fixed cell sizing
  that becomes cramped on narrow screens.
- Existing owner/service: `app/(app)/athlete/calendar/page.tsx` renders the
  month view; `lib/athlete-service.ts` owns calendar data.
- Related active or transitional work: None found.

## Plan

- [x] Move previous/next month controls into the month overview header.
- [x] Refine calendar spacing and preserve readable cells on narrow screens.
- [x] Run lint/tests/build and record the result.

## Progress Log

### 2026-08-22

- What changed: Registered the calendar month layout polish task.
- Decision or discovery: The page header should retain only view-level actions;
  month navigation belongs with the month label in the calendar surface.
- Files touched: This task record and `WORK-INDEX.md`.
- Verification: Not run; implementation has not started.
- Blocker or next step: Update the calendar page and verify repository gates.

### 2026-08-22

- What changed: Moved month navigation into the month card, refined the month
  header and grid spacing, and added narrow-screen overflow handling.
- Decision or discovery: Full previous/next labels remain visible beside the
  directional icons so the controls are understandable without relying on
  icon recognition.
- Files touched: `app/(app)/athlete/calendar/page.tsx`.
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
- **History record:** [calendar month polish](../history/2026-08-22-calendar-month-polish.md)
- **Feature records updated:** [athlete](../features/athlete.md), [work index](../WORK-INDEX.md)
- **Remaining work:** None for this task.
