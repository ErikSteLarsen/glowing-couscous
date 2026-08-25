# Session Adjustments Planning

- **Date:** 2026-08-25
- **Task:** [session adjustments design](../tasks/2026-08-25-session-adjustments-design.md)
- **Feature:** [session adjustments](../features/session-adjustments.md)
- **Decision:** [0010 session adjustments and actual outcomes](../decisions/0010-session-adjustments-and-actual-outcomes.md)

## Outcome

The interactive grill defined a planned session as an independent assignment
instance, not a live template reference. The first implementation will create a
new canonical editor module and use it for coach creation, template editing,
athlete planned adjustment, and actual-outcome correction.

The accepted lifecycle is:

- latest coach-authored content is the baseline;
- pre-completion athlete edits affect only the scheduled instance;
- pre-completion coach edits overwrite the current plan and baseline;
- completed current content represents the latest actual;
- either role can correct the completed actual directly and metrics are
  recomputed;
- both roles can toggle between baseline and actual from session detail and
  Activity in a simple dialog.

## Files

- `docs/agent-workspace/decisions/0010-session-adjustments-and-actual-outcomes.md`
- `docs/agent-workspace/features/session-adjustments.md`
- `docs/agent-workspace/tasks/2026-08-25-canonical-session-editor.md`
- `docs/agent-workspace/tasks/2026-08-25-editor-migration.md`
- `docs/agent-workspace/tasks/2026-08-25-session-snapshots.md`
- `docs/agent-workspace/tasks/2026-08-25-planned-session-adjustments.md`
- `docs/agent-workspace/tasks/2026-08-25-actual-outcome-editing.md`
- `docs/agent-workspace/tasks/2026-08-25-baseline-actual-comparison.md`

## Verification

- Product grill completed one multiple-choice decision at a time.
- Existing route, service, schema, and workspace records inspected.
- No source implementation changed; `pnpm test`, `pnpm lint`, and `pnpm build`
  were not run.

## Follow-up

Claim `SESSION-EDIT-001` first. The task briefs are planned, dependency-ordered,
and intentionally leave browser E2E coverage as a later follow-up where focused
route/component tests are insufficient.
