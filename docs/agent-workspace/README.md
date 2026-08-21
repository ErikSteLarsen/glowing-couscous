# Agent Workspace

This folder is the shared operational memory for agents working on Workout
Planner. It answers four questions quickly:

1. What is implemented and verified now?
2. What work is active, planned, blocked, deferred, or transitional?
3. Where does a feature belong in the codebase?
4. Why did the project end up with its current behavior?

The source code and tests remain authoritative for behavior. This workspace
is the coordination index and historical record around them.

## Start Here

Read these files in order for any non-trivial task:

1. `CURRENT-STATUS.md` — the latest verified project snapshot.
2. `WORK-INDEX.md` — feature statuses, owners, entry points, tests, and related records.
3. `features/<feature>.md` — the detailed contract and known gaps for the feature.
4. `tasks/` — active work and recent handoffs that may overlap the task.
5. `decisions/` — recorded choices and constraints that should not be rediscovered.
6. `history/` — dated implementation records and superseded context.

For architecture-sensitive work, also read `ARCHITECTURE.md`,
`docs/AI-HANDOFF.md`, and `.copilot/skills/project-architecture/`.

## Status Vocabulary

Use exactly one primary status in the index and feature records:

| Status | Meaning |
|---|---|
| `shipped` | Implemented in the live path and backed by recorded verification. |
| `in-progress` | Work is actively being changed by an agent. |
| `planned` | Agreed work exists but has not started. |
| `blocked` | Work cannot proceed until a named dependency or decision is resolved. |
| `deferred` | Intentionally postponed; do not start without a new reason. |
| `transitional` | Still live or required for compatibility, but not the preferred path for new work. |
| `unknown` | The current state has not been verified yet. Investigate before editing. |

`shipped` describes implementation state, not product perfection. Record known
gaps beside it rather than hiding them.

## Agent Workflow

### Before editing

1. Read the start-here files that relate to the task.
2. Search the index and task records for overlapping work.
3. Identify the feature owner and existing service boundary.
4. For work larger than a small local edit, copy `tasks/TEMPLATE.md` to a new
   file named `YYYY-MM-DD-short-description.md`.
5. Mark the related index item `in-progress`, including the task-file link and
   agent identifier if one is available.

### While editing

- Keep the task record focused on intent, decisions, changed files, and current
  blockers. Do not paste whole source files into it.
- Add a dated progress entry when a boundary, data contract, or approach
  changes, or when verification produces important evidence.
- Read any existing `in-progress` task touching the same feature before making
  a parallel change. Coordinate by updating that record instead of silently
  creating a competing implementation.

### Before finishing

1. Run the relevant tests and repository gates.
2. Update the feature record with the new behavior, entry points, tests, and
   remaining gaps.
3. Update `WORK-INDEX.md` to the true final status.
4. Add a dated file under `history/` describing the change, files, evidence,
   and follow-up work. History records are append-only; correct old facts with
   a new dated entry.
5. Add or update a decision record when the work changes an architectural,
   data-model, product-scope, or workflow choice.
6. Mark the task record `completed`, `blocked`, or `deferred`, and link the
   resulting history entry.

Small changes may skip a task file, but they still update the relevant feature
record and add a history entry when they change behavior or project status.

## Record Rules

- Use ISO dates: `YYYY-MM-DD`.
- Include the agent name or session identifier when available.
- Include exact paths and verification commands; use `not run` with a reason
  when verification was not possible.
- Link to source, tests, plans, and decisions rather than duplicating their
  full contents.
- Treat old `docs/superpowers/plans/` checkboxes as historical plan evidence,
  not as the current task board. Confirm status against live code and tests.
- Never write secrets, tokens, private credentials, or copied `.env` values.
- Keep records concise enough that an incoming agent can scan them in one pass.

## Folder Map

| Path | Role |
|---|---|
| `CURRENT-STATUS.md` | Current verified snapshot; replace the snapshot when it is stale. |
| `WORK-INDEX.md` | Stable feature IDs and coordination status. |
| `features/` | One focused record per product or architecture capability. |
| `tasks/` | Active task briefs, progress, verification, and handoffs. |
| `decisions/` | Dated rationale for choices and constraints. |
| `history/` | Append-only dated implementation and status records. |

When a feature has no record, create one from `features/TEMPLATE.md` before
starting implementation. When a new capability is introduced, add its stable
ID to `WORK-INDEX.md` in the same change.
