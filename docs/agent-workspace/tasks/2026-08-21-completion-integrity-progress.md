# Task: Make Completion And Activity Semantics Consistent

- **Status:** `completed`
- **Agent:** `opencode-completion-2026-08-21`
- **Started:** `2026-08-21`
- **Updated:** `2026-08-21`
- **Feature IDs:** `COMPLETION-002`, `COMPLETE-001`, `ATHLETE-001`, `PLAN-001`, `COMPAT-001`, `COVERAGE-001`
- **Related records:** [planned task](2026-08-21-completion-integrity.md), [athlete](../features/athlete.md), [decision](../decisions/0006-immutable-completed-sessions.md)

## Goal

Move completion business behavior into an injected service, stop fabricating
manual compliance, retain notes across reopen, and protect Activity history from
planner mutations.

## Starting Context

- Current behavior: The completion route writes Prisma directly, derives planned
  metrics as 100% compliance, deletes Activity on undo, and planner edits can
  mutate sessions with Activity.
- Existing owner/service: completion route for writes; `athlete-service` and
  `coach-service` for reads; planner services for coach mutations.
- Related active or transitional work: `COMPAT-001` is transitional and must
  retain the immutable completed-session rule.

## Plan

- [x] Record the immutable completed-session and manual-estimate policy.
- [x] Add failing service/read/planner tests for completion invariants.
- [x] Implement schema and `lib/athlete-completion-service.ts`.
- [x] Update route, readers, planner mutations, and UI labels.
- [x] Run schema reset/seed and repository gates.
- [x] Update workspace records and commit the completed task.

## Progress Log

### 2026-08-21

- What changed: Claimed `COMPLETION-002` and recorded decision `0006`.
- Decision or discovery: Completed sessions are immutable through coach planner
  paths; reopen retains notes while removing the Activity outcome. Manual metrics
  use `manual-planned` and nullable compliance.
- Files touched: This progress record, `WORK-INDEX.md`, and the decision record.
- Verification: Prior baseline gates pass; implementation and focused tests are complete.
- Blocker or next step: None for `COMPLETION-002`.

### 2026-08-21

- What changed: Added `athlete-completion-service`, immutable planner guards,
  stored Activity segments/source, nullable compliance, Session note retention,
  route delegation, reader stability, and estimate labels.
- Decision or discovery: Manual completion is an explicit `manual-planned`
  estimate and cannot claim compliance without performed data.
- Files touched: Completion service/route, Prisma schema and seed, athlete/coach
  readers, planner services, athlete/coach UI, tests, and workspace records.
- Verification: Focused completion tests, `pnpm exec prisma validate`,
  `pnpm db:push --force-reset`, `pnpm db:seed`, `pnpm test` (103 passing),
  `pnpm lint`, `pnpm build`, and `git diff --check` pass. Build retains the
  existing Next.js middleware deprecation warning.
- Blocker or next step: None for this task.

## Verification

- `pnpm exec prisma validate` — pass on 2026-08-21.
- `pnpm db:push --force-reset` — pass on disposable local SQLite; existing rows
  required reset because `segmentsJson` is required.
- `pnpm db:seed` — pass on 2026-08-21.
- `pnpm test` — pass, 103 tests, on 2026-08-21.
- `pnpm lint` — pass on 2026-08-21.
- `pnpm build` — pass on 2026-08-21; existing middleware deprecation warning.
- `git diff --check` — pass on 2026-08-21.

## Handoff / Completion

- **Final status:** `completed`
- **History record:** [2026-08-21 completion integrity](../history/2026-08-21-completion-integrity.md)
- **Feature records updated:** [athlete](../features/athlete.md), [current status](../CURRENT-STATUS.md), [coverage](../features/coverage.md), [architecture](../../../ARCHITECTURE.md), [handoff](../../AI-HANDOFF.md)
- **Remaining work:** Add performed-metrics/device integration only if product scope later requires it.
