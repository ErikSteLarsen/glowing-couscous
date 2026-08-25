# Task: Add Baseline And Actual Comparison

- **Status:** `in-progress`
- **Agent:** `OpenCode`
- **Started:** `2026-08-25`
- **Updated:** `2026-08-25`
- **Task ID:** `SESSION-COMPARE-001`
- **Feature IDs:** `SESSION-ADJUST-001`, `ATHLETE-001`, `COMPLETE-001`
- **Dependencies:** `SESSION-ACTUAL-001`
- **Related records:** [session adjustments](../features/session-adjustments.md), [athlete](../features/athlete.md), [decision 0010](../decisions/0010-session-adjustments-and-actual-outcomes.md)

## Goal

Give coaches and athletes a simple dialog to inspect the latest coach baseline
and latest athlete actual from session detail and Activity history.

## Starting Context

- Current behavior: athlete session detail and Activity show one current workout
  view; there is no baseline/actual comparison control.
- Existing owner/service: `lib/athlete-service.ts`, athlete session/activity
  routes and clients, shared Tempo surfaces.
- Related active or transitional work: Use stored snapshots for history; do not
  calculate old Activity views from mutable current Session blocks.

## Plan

- [ ] Add a read model exposing baseline and actual snapshots with role-scoped
  access for the athlete and roster coach.
- [ ] Add a dialog reachable from athlete/coach session detail and Activity
  entries with a toggle between complete “Coach baseline” and “Athlete actual”
  views.
- [ ] Show a single view when no block or schedule difference exists; do not add
  automatic block-level diff highlighting in the first release.
- [ ] Add responsive and accessible UI tests for both roles, missing baseline,
   equal versions, skipped blocks, and actual corrections.

## Progress Log

### 2026-08-25

- What changed: Claimed `SESSION-COMPARE-001` after actual outcome editing
  shipped.
- Decision or discovery: Comparison will authorize the session before reading
  existing baseline/actual payloads, reuse the snapshot difference identity, and
  expose one reusable dialog to athlete session detail, Activity entries, and
  coach athlete detail cards.
- Files touched: This task and `WORK-INDEX.md`.
- Verification: Red tests not run yet; comparison read-model tests are next.
- Blocker or next step: Define the role-scoped comparison result and dialog
  loading/error/empty states before implementation.

## Acceptance Criteria

- Both coach and athlete can open the comparison only for an authorized session.
- The dialog presents the two full versions separately, not a merged or inferred
  diff.
- Session detail and Activity history use the same stored actual snapshot.
- The UI works on desktop and mobile without exposing source/template sessions.

## Verification

- `pnpm test -- --test-name-pattern="comparison|activity|session detail|athlete"`
- `pnpm lint`
- `pnpm build`

## Handoff / Completion

- **Final status:** `in-progress`
- **History record:** not applicable until implementation
- **Feature records updated:** [session adjustments](../features/session-adjustments.md), [athlete](../features/athlete.md)
- **Remaining work:** Browser E2E remains a follow-up if route-level tests do not cover the dialog.
