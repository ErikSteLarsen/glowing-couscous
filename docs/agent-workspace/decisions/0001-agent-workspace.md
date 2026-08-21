# Decision 0001: Use A Shared Agent Workspace

- **Recorded:** `2026-08-21`
- **Status:** `accepted`
- **Scope:** Agent coordination and project history
- **Related:** [workspace](../features/workspace.md), [history](../history/2026-08-21-baseline.md)

## Context

The repository already had architecture, product, handoff, and dated design
documents, but no single place told a new agent what was active, what was
transitional, what was in progress, or what had been verified recently.

## Decision

Use `docs/agent-workspace/` as the operational index. Keep current status and
feature contracts separate from append-only history. Use dated task files for
active multi-step work and dated decision records for rationale.

## Alternatives Rejected

- Put all updates into `docs/AI-HANDOFF.md`: too easy to grow stale and mixes onboarding with history.
- Use only git history: it does not expose in-progress or planned work and is expensive to search by feature.
- Create one journal file: efficient to append but poor for routing an agent to a specific capability.

## Consequences

- Agents have a predictable read path before editing and a predictable update
  path after editing.
- The workspace adds maintenance work; every behavior-changing task must record
  verification and follow-up status.
- Historical records remain useful because current files can change without
  erasing how the project arrived there.
