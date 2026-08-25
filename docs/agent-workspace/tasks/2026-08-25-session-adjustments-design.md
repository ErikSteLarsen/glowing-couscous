# Task: Define Session Adjustment And Actualization Work

- **Status:** `completed`
- **Agent:** `opencode-grill-2026-08-25`
- **Started:** `2026-08-25`
- **Updated:** `2026-08-25`
- **Feature IDs:** `SESSION-ADJUST-001`, `DOMAIN-001`, `PLAN-001`, `TEMPLATE-001`, `ATHLETE-001`, `COMPLETE-001`
- **Related records:** [session adjustments](../features/session-adjustments.md), [decision 0010](../decisions/0010-session-adjustments-and-actual-outcomes.md)

## Goal

Turn the product grill into small, dependency-ordered implementation briefs for
one canonical session editor, per-session coach/athlete adjustments, performed
outcomes, and baseline comparison.

## Starting Context

- Current behavior: `/coach/planner` contains the active Tempo editor; `/coach/templates` contains the template library/editor; `/coach/builder` redirects to the planner. Completed sessions are currently immutable through planner paths, and completion derives metrics from current session blocks.
- Existing owner/service: `PlannerClient`, `lib/planner-draft.ts`, `lib/template-service.ts`, `lib/assignment-service.ts`, `lib/athlete-completion-service.ts`.
- Related active or transitional work: `COMPAT-001` remains transitional; source assignments are snapshots and templates do not synchronize into existing athlete sessions.

## Plan

- [x] Grill the planned-versus-actual lifecycle, permissions, source-copy behavior, and comparison scope.
- [x] Record the product/data decisions and canonical terminology.
- [x] Create small implementation task briefs with explicit dependencies and acceptance criteria.
- [ ] Have an implementation agent claim the first task and update the work index.

## Progress Log

### 2026-08-25

- What changed: Defined the canonical editor, latest coach baseline, latest actual version, direct completed-outcome correction, RPE, skipped blocks, calendar movement, and comparison behavior.
- Decision or discovery: The active editor is inline in `PlannerClient.tsx`; `components/WorkoutBlocksEditor.tsx` is a legacy contract and should not become the new source of truth.
- Files touched: This task, decision 0010, feature `session-adjustments`, and six planned task briefs.
- Verification: Product decisions reviewed interactively; implementation verification not run because no source behavior changed.
- Blocker or next step: Implement task `SESSION-EDIT-001` first; no implementation agent has claimed it yet.

## Verification

- Product grill — complete 2026-08-25
- Source/coordination review — complete 2026-08-25
- `pnpm test` — not run; planning-only change

## Handoff / Completion

- **Final status:** `completed`
- **History record:** [2026-08-25 session adjustments planning](../history/2026-08-25-session-adjustments-planning.md)
- **Feature records updated:** [session adjustments](../features/session-adjustments.md), [work index](../WORK-INDEX.md)
- **Remaining work:** Implementation tasks listed in `WORK-INDEX.md` are planned and must be claimed in dependency order.
