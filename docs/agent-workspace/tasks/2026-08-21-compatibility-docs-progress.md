# Task: Harden Compatibility Boundary And Align Documentation

- **Status:** `completed`
- **Agent:** `opencode-compat-2026-08-21`
- **Started:** `2026-08-21`
- **Updated:** `2026-08-21`
- **Feature IDs:** `COMPAT-002`, `COMPAT-001`, `CLEANUP-001`, `COVERAGE-001`, `OPS-001`
- **Related records:** [planned task](2026-08-21-compatibility-docs.md), [compatibility](../features/compatibility.md), [decision](../decisions/0008-compatibility-cross-week-and-builder-cleanup.md)

## Goal

Keep the legacy coach-session adapter explicitly transitional, consistent with
completion/API semantics, and free of misleading dead-builder references.

## Plan

- [x] Record cross-week, template ownership, and builder cleanup policy.
- [x] Add compatibility and redirect regression assertions.
- [x] Implement cross-week Plan reassignment, template ownership, and completed-session guards.
- [x] Run full repository gates and update records.
- [x] Commit the completed task.

## Progress Log

### 2026-08-21

- What changed: Claimed `COMPAT-002`; removed unreferenced `BuilderClient`,
  replaced comment-based assertions, and hardened `planner-service`.
- Decision or discovery: Legacy updates now select the target draft week Plan;
  foreign templates and Activity-backed sessions are rejected.
- Files touched: `lib/planner-service.ts`, builder redirect/tests, and this record.
- Verification: Compatibility-focused tests, lint, and build pass.
- Blocker or next step: None for `COMPAT-002`.

## Verification

- Focused compatibility tests — pass on 2026-08-21.
- `pnpm lint` — pass on 2026-08-21.
- `pnpm build` — pass on 2026-08-21; existing middleware deprecation warning.
- `pnpm test` — pass, 113 tests, on 2026-08-21.

## Handoff / Completion

- **Final status:** `completed`
- **History record:** [2026-08-21 compatibility docs](../history/2026-08-21-compatibility-docs.md)
- **Feature records updated:** [compatibility](../features/compatibility.md), [current status](../CURRENT-STATUS.md), [architecture](../../../ARCHITECTURE.md), [handoff](../../AI-HANDOFF.md)
- **Remaining work:** Old planner helper cleanup remains separate and requires reference analysis.
