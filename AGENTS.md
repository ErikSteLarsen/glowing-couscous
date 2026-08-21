# Agent Operating Guide

Before changing code, read `docs/agent-workspace/README.md`, then read
`docs/agent-workspace/CURRENT-STATUS.md`, `docs/agent-workspace/WORK-INDEX.md`,
and the feature records related to the task. Read `CLAUDE.md`,
`ARCHITECTURE.md`, and `docs/AI-HANDOFF.md` when the task touches project
architecture, routes, services, Prisma, or authentication.

## Work Tracking

- Treat `docs/agent-workspace/` as the operational coordination area for agents.
- Before non-trivial work, create a dated file in `docs/agent-workspace/tasks/`
  from `TEMPLATE.md` and mark the related work-index item `in-progress`.
- Research existing feature records and task files before creating a new
  service, route, data model, or parallel implementation.
- After meaningful progress, update the task record while the work is active.
- Before finishing, update the relevant feature record, `WORK-INDEX.md`, and
  add an entry to `history/` with the date, files, behavior, verification, and
  follow-up work.
- Record architectural or product choices in `decisions/` with an ISO date.
- Never mark work `shipped` without recording verification evidence. Keep
  incomplete, blocked, and transitional work visible.

The workspace is a coordination record, not a replacement for source code.
When documentation and code disagree, inspect the code and tests, then record
the correction in the workspace.
