# Feature: Agent Coordination Workspace

- **ID:** `OPS-001`
- **Status:** `shipped`
- **Last verified:** `2026-09-06`
- **Owner:** `docs/agent-workspace/`, `AGENTS.md`, `CLAUDE.md`
- **Related work:** [workspace decision](../decisions/0001-agent-workspace.md), [baseline](../history/2026-08-21-baseline.md), [initialization task](../tasks/2026-08-21-agent-workspace-initialization.md), [product context task](../tasks/2026-09-06-product-context.md)

## Contract

Every agent can discover current status, related work, active tasks, decisions,
and history before editing, and knows exactly which records to update after
meaningful progress.

## Live Path

- `AGENTS.md` provides the cross-agent pointer and completion rules.
- `CLAUDE.md`, `README.md`, `docs/AI-HANDOFF.md`, and the architecture skill point into this workspace.
- `CURRENT-STATUS.md` is the verified snapshot.
- `WORK-INDEX.md` is the stable coordination board.
- `PRODUCT.md` records confirmed product truth for design and implementation
  work.
- `features/`, `tasks/`, `decisions/`, and `history/` provide progressive detail.

## Verification

- Documentation links and structure reviewed on 2026-08-21.
- `PRODUCT.md` initialized from repository evidence and user confirmation on
  2026-09-06; public product naming remains explicitly undecided.
- `pnpm test`, `pnpm lint`, and `pnpm build` pass on 2026-08-21.

## Maintenance Rules

- Keep the entrypoint short and procedural.
- Replace stale current snapshots; append history instead of rewriting historical records.
- Add a new stable feature ID when the product gains a new capability.
- Keep source-code details linked and current enough to route the next agent to the correct owner.
- Keep confirmed product truth available to design and implementation agents in
  the repository-level `PRODUCT.md` record.
