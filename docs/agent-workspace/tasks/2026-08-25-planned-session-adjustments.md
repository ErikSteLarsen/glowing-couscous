# Task: Implement Planned Session Adjustments

- **Status:** `completed`
- **Agent:** `OpenCode`
- **Started:** `2026-08-25`
- **Updated:** `2026-08-25`
- **Task ID:** `SESSION-PLAN-ADJUST-001`
- **Feature IDs:** `SESSION-ADJUST-001`, `PLAN-001`, `ATHLETE-001`
- **Dependencies:** `SESSION-EDIT-001`, `SESSION-SNAPSHOT-001`
- **Related records:** [planner](../features/planner.md), [athlete](../features/athlete.md), [session adjustments](../features/session-adjustments.md)

## Goal

Allow coaches and athletes to edit one scheduled session instance before
completion, with explicit baseline and adjusted behavior.

## Starting Context

- Current behavior: coach planner mutations own scheduled session edits;
  athlete routes have no session editor; completed sessions are guarded by
  immutable planner rules.
- Existing owner/service: `lib/coach-planner-service.ts`,
  `lib/athlete-service.ts`, `lib/assignment-service.ts`.
- Related active or transitional work: preserve `Assignment` uniqueness and
  source-copy lineage; do not extend the compatibility planner path.

## Plan

- [x] Add a service command for authorized coach/athlete edits to an assigned
   session, including all session fields and full block structure.
- [x] Mark athlete changes as adjusted; make a pre-completion coach edit the
   current plan and latest coach baseline, replacing the athlete adjustment.
- [x] Move the current session assignment when its date changes without making a
   copy or changing the source/template/other assignments.
- [x] Expose coach/athlete edit entry points and visible adjusted status on
   session/calendar surfaces.
- [x] Add ownership, completed-session, date-move, source-isolation, and
   concurrent-save regression tests.

## Progress Log

### 2026-08-25

- What changed: Claimed `SESSION-PLAN-ADJUST-001` after
  `SESSION-SNAPSHOT-001` completed and corrected its task-record status.
- Decision or discovery: Coach mutations remain in `coach-planner-service`; the
  athlete command needs a separate assigned-session service so the compatibility
  planner path is not extended. Both roles must mutate one Session instance,
  preserve source lineage, and use the snapshot service for baseline updates.
- Files touched: This task, the snapshot task status, and `WORK-INDEX.md`.
- Verification: Red tests not run yet; ownership and schedule contract tests are
  next.
- Blocker or next step: Define the authorized planned-edit command and its
  transaction semantics before implementation.

### 2026-08-25

- What changed: Added `athlete-session-adjustment-service`, the athlete planned
  session PATCH route, shared `SessionComposer` schedule controls, and coach
  overwrite behavior that clears adjusted state and updates the baseline.
- Decision or discovery: Planned edits update one existing Session, its ordered
  Blocks, its target Plan, and Assignment target date in one transaction. Source
  and ownership fields are preserved; skipped blocks now persist on `Block`.
- Files touched: `lib/athlete-session-adjustment-service.ts`,
  `lib/coach-planner-service.ts`, `lib/athlete-service.ts`,
  `components/SessionComposer.tsx`, athlete session route/client/page, schema,
  and focused service/source tests.
- Verification: Planned-adjustment/coach/assignment focused tests passed (18
  tests); `pnpm test` passed (140 tests); `pnpm db:push --force-reset && pnpm db:seed`,
  `pnpm exec prisma validate`, `pnpm lint`, and `pnpm build` passed. Build retains
  the existing middleware deprecation warning.
- Blocker or next step: Browser narrow/wide viewport, loading, empty, error,
  keyboard/focus, contrast, and responsive inspection was not available in this
  environment; automated source/component coverage passed. Actual-outcome editing
  remains `SESSION-ACTUAL-001`.

## Acceptance Criteria

- An athlete can edit only their assigned session, never the reusable source.
- A coach can edit roster-owned sessions and overwrite pre-completion athlete
  adjustments.
- Planned saves leave status planned; completion is a separate action.
- A planned edit cannot silently mutate another template-derived session.

## Verification

- `pnpm test -- --test-name-pattern="planned adjustment|planner|athlete session|assignment"`
- `pnpm lint`
- `pnpm build`

## Handoff / Completion

- **Final status:** `completed`
- **History record:** [planned session adjustments](../history/2026-08-25-planned-session-adjustments.md)
- **Feature records updated:** [session adjustments](../features/session-adjustments.md), [planner](../features/planner.md), [athlete](../features/athlete.md)
- **Remaining work:** Manual browser inspection remains a verification gap; comparison surfaces now consume the resulting snapshot/outcome contract.
