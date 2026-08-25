# Task: Record And Correct Actual Outcomes

- **Status:** `in-progress`
- **Agent:** `OpenCode`
- **Started:** `2026-08-25`
- **Updated:** `2026-08-25`
- **Task ID:** `SESSION-ACTUAL-001`
- **Feature IDs:** `SESSION-ADJUST-001`, `COMPLETE-001`, `ATHLETE-001`
- **Dependencies:** `SESSION-EDIT-001`, `SESSION-SNAPSHOT-001`, `SESSION-PLAN-ADJUST-001`
- **Related records:** [athlete](../features/athlete.md), [decision 0010](../decisions/0010-session-adjustments-and-actual-outcomes.md), [completion integrity](2026-08-21-completion-integrity.md)

## Goal

Let either coach or athlete use the canonical editor to record what was
actually done and correct a completed actual directly.

## Starting Context

- Current behavior: completion accepts notes, derives metrics from current
  blocks, and creates/updates Activity; reopening deletes Activity and returns
  the session to planned.
- Existing owner/service: `lib/athlete-completion-service.ts`, completion API,
  `Activity`.
- Related active or transitional work: supersede only the explicit completed
  outcome-edit restriction; keep unrelated planner mutation guards.

## Plan

- [ ] Add actual save/complete commands that persist full actual blocks,
  skipped state, athlete notes, and optional 1-10 RPE.
- [ ] Recompute duration, TSS, zone distribution, and segments from latest actual
  blocks on first completion and every direct correction.
- [ ] Permit both coach and athlete authorized corrections to completed actuals;
  save immediately while retaining completed status and leaving coach baseline
  unchanged.
- [ ] Preserve separate coach notes and athlete notes; keep completion timestamps
  and stored Activity history coherent.
- [ ] Add service/API tests for completion, direct correction, permissions,
   invalid RPE/blocks, and idempotent metric updates.

## Progress Log

### 2026-08-25

- What changed: Claimed `SESSION-ACTUAL-001` after planned session adjustment
  ownership and schedule behavior shipped.
- Decision or discovery: Existing completion writes the latest actual snapshot
  but does not accept canonical actual blocks or directly correct a completed
  Session. Direct correction must remain in the completion/outcome boundary,
  preserve the coach baseline, and keep status completed.
- Files touched: This task and `WORK-INDEX.md`.
- Verification: Red tests not run yet; actual correction service tests are next.
- Blocker or next step: Define a single actual-save command usable by athlete and
  coach adapters before changing the completion route.

## Acceptance Criteria

- Saving an actual correction never requires reopen or a second completion step.
- The current session blocks and Activity outcome represent the latest actual.
- Activity metrics match the latest actual blocks and are labeled appropriately
  when no performed sensor data exists.
- Coach baseline remains available and unchanged when actual is corrected.

## Verification

- `pnpm test -- --test-name-pattern="completion|actual outcome|activity|session editor"`
- `pnpm db:push --force-reset && pnpm db:seed`
- `pnpm lint`
- `pnpm build`

## Handoff / Completion

- **Final status:** `in-progress`
- **History record:** not applicable until implementation
- **Feature records updated:** [athlete](../features/athlete.md), [session adjustments](../features/session-adjustments.md)
- **Remaining work:** Comparison dialog consumes the baseline and actual read model.
