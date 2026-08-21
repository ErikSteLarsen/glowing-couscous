# Task: Audit Incomplete Functionality

- **Status:** `completed`
- **Agent:** `OpenCode`
- **Started:** `2026-08-21`
- **Updated:** `2026-08-21`
- **Feature IDs:** `AUTH-001`, `ONBOARD-001`, `PLAN-001`, `ATHLETE-001`, `COMPLETE-001`, `COMPAT-001`, `COVERAGE-001`
- **Related records:** [current status](../CURRENT-STATUS.md), [work index](../WORK-INDEX.md), [baseline](../history/2026-08-21-baseline.md)

## Goal

Investigate functionality that exists in source but is not complete as an
end-to-end user capability, identify the architectural cause, and publish
agent-ready implementation tasks with dependencies and verification criteria.

## Method

- Trace each candidate from UI to route, module, data model, and tests.
- Distinguish intentional non-goals from incomplete shipped-looking behavior.
- Prefer deep modules with small interfaces and injected dependencies.
- Record copy-vs-sync, lifecycle, ownership, and metric-provenance semantics explicitly.

## Confirmed Findings

- Live execution is a static server-rendered outline; it has no client execution state.
- Manual completion stores planned metrics as performed-looking values and always writes 100% compliance.
- Activity history is attached to mutable sessions and read models mix Activity and current Session block data.
- Reusable library sessions and training plans can be authored but not copied to athlete schedules.
- Template APIs exist without a live create/edit UI; the old assignment builder is unreachable.
- Google OAuth user creation is inconsistent with the required Prisma `User` fields and role setup state.
- `/setup` permits an already-roleful user to switch roles.
- Coach-request uniqueness is not safe across concurrent requests to different coaches.
- API route IDs and JSON bodies are inconsistently validated; focused route/guard tests are missing.
- The compatibility planner route and architecture documentation still contain misleading ownership/test assumptions.

## Published Tasks

- [Live execution](2026-08-21-athlete-live-execution.md)
- [Completion integrity](2026-08-21-completion-integrity.md)
- [Source-copy assignment](2026-08-21-source-copy-assignment.md)
- [Planner and template workflows](2026-08-21-planner-template-workflows.md)
- [Auth and role setup](2026-08-21-auth-role-setup.md)
- [Coach-request invariants](2026-08-21-coach-request-invariants.md)
- [API authorization and validation](2026-08-21-api-auth-validation.md)
- [Compatibility boundary and documentation](2026-08-21-compatibility-docs.md)

## Verification

- Source and test audit completed using the live repository at `dd74bb4` plus the previous implementation commit.
- Existing baseline remains `pnpm test` 84 passing, `pnpm lint` passing, and `pnpm build` passing with the middleware deprecation warning.

## Handoff

The implementation tasks are planned, not started. Agents should update their
feature record, work index, task progress, history, and any decision record as
they implement them. The suggested dependency order is recorded in
`WORK-INDEX.md`.
