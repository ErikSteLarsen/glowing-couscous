# Incompleteness Audit And Task Backlog

- **Date:** `2026-08-21`
- **Agent:** `OpenCode`
- **Base commit:** `dd74bb4` (`docs: add agent workspace and project status`)
- **Related task:** [audit task](../tasks/2026-08-21-incompleteness-audit.md)

## Findings

- Live execution is a static outline with no execution state or controls.
- Manual completion writes planned metrics as performed-looking data and always
  records 100% compliance.
- Activity history reads current mutable Session blocks, so planner edits can
  change historical presentation and conflict with Activity/Session status.
- Library sessions and training plans have authoring CRUD but no copy-to-athlete
  workflow; template assignment semantics are split between active and orphaned
  paths.
- Template create/edit APIs have no live editor.
- Google OAuth creation is inconsistent with the required Prisma user contract,
  and role setup can change an already assigned role.
- Coach requests do not enforce all eligibility/concurrency invariants.
- API route/body validation and behavior-level auth tests are incomplete.
- The compatibility planner path and architecture docs contain misleading
  ownership/test assumptions.

## Task Records Created

- [Athlete live execution](../tasks/2026-08-21-athlete-live-execution.md)
- [Completion integrity](../tasks/2026-08-21-completion-integrity.md)
- [Source-copy assignment](../tasks/2026-08-21-source-copy-assignment.md)
- [Planner/template workflows](../tasks/2026-08-21-planner-template-workflows.md)
- [Auth and role setup](../tasks/2026-08-21-auth-role-setup.md)
- [Coach-request invariants](../tasks/2026-08-21-coach-request-invariants.md)
- [API auth and validation](../tasks/2026-08-21-api-auth-validation.md)
- [Compatibility and documentation](../tasks/2026-08-21-compatibility-docs.md)

## Design Principles Applied

- Put state transitions behind pure modules or deep injected modules rather
  than route/component implementations.
- Keep source authoring separate from source-to-athlete copying.
- Preserve copy semantics for reusable content; assigned sessions are snapshots.
- Make lifecycle state, metric provenance, ownership, and idempotency explicit.
- Treat source-only tests as insufficient evidence for route and UI completion.

## Verification

The existing repository baseline remains:

- `pnpm test` — 84 passing tests.
- `pnpm lint` — pass.
- `pnpm build` — pass with the known middleware deprecation warning.

No application source was changed by the audit.
