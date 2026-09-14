# Agent Workspace

This directory contains only current coordination for the repository. It is
deliberately small and is not an archive of plans, handoffs, decisions, or
completed implementation notes.

## Start Here

1. `CURRENT-STATUS.md` - latest verified implementation snapshot and known gaps.
2. `WORK-INDEX.md` - compact capability, owner, and verification map.
3. `ARCHITECTURE.md` - route, service, data, and extension rules.
4. `tasks/` - active multi-step work only.

The application source and tests are authoritative. If a document disagrees
with code, inspect the code and tests, then correct the current document.

## Updating the Workspace

- Keep status claims tied to an actual command or observable source behavior.
- Keep capability rows broad and stable. Do not create a row for every small UI change.
- Use `tasks/TEMPLATE.md` for active cross-cutting work and delete the brief when its result is reflected in current status and the index.
- Put durable rules in the root product, architecture, or design document instead of creating dated records.
- Never put secrets, credentials, or copied environment values in documentation.
