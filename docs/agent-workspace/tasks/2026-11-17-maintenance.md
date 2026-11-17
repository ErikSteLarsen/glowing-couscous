# Task: Independently revertible maintenance steps

- **Status:** `in-progress`
- **Owner:** Codex with structure, dead-code and dependency audit agents
- **Started / updated:** 2026-11-17 / 2026-11-17
- **Capabilities:** UI-001, SESSION-001, LIB-001

## Goal and scope

Reduce obsolete code and unnecessary indirection, improve module ownership and
refresh useful dependencies. Preserve the personal training loop, coach API
boundaries and stored data. Each significant step starts from a committed state
and ends with its own verified commit. No deployment or push is required.

## Next steps

- [x] Checkpoint existing SDK integration (`0dcd519`).
- [ ] Audit caller graph, module structure and dependency versions.
- [ ] Implement and verify bounded cleanup steps separately.
- [ ] Record final verification and remove this brief.

## Current evidence and blockers

Baseline from SDK integration: 439 database-enabled tests and 2 isolated browser
checks passed, lint/type checking and production build passed. Audits are read-only
and implementations will be assigned nonoverlapping files.
