# Task: Implement Planned Session Adjustments

- **Status:** `planned`
- **Agent:** `unclaimed`
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

- [ ] Add a service command for authorized coach/athlete edits to an assigned
  session, including all session fields and full block structure.
- [ ] Mark athlete changes as adjusted; make a pre-completion coach edit the
  current plan and latest coach baseline, replacing the athlete adjustment.
- [ ] Move the current session assignment when its date changes without making a
  copy or changing the source/template/other assignments.
- [ ] Expose coach/athlete edit entry points and visible adjusted status on
  session/calendar surfaces.
- [ ] Add ownership, completed-session, date-move, source-isolation, and
  concurrent-save regression tests.

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

- **Final status:** `planned`
- **History record:** not applicable until implementation
- **Feature records updated:** [session adjustments](../features/session-adjustments.md), [planner](../features/planner.md), [athlete](../features/athlete.md)
- **Remaining work:** Completion/outcome editing depends on this session access contract.
