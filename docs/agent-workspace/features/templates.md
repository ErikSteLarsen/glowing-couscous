# Feature: Coach Templates And Assignment

- **ID:** `TEMPLATE-001`
- **Status:** `shipped`
- **Last verified:** `2026-08-25`
- **Owners:** `lib/template-service.ts`, `lib/assignment-service.ts`, `lib/session-editor-adapters.ts`, `components/SessionComposer.tsx`
- **Related work:** [baseline](../history/2026-08-21-baseline.md), [product scope](../../../SPEC.md), [workflow task](../tasks/2026-08-21-planner-template-workflows.md), [assignment task](../tasks/2026-08-21-source-copy-assignment.md), [editor migration](../tasks/2026-08-25-editor-migration.md)

## Contract

Coaches own private structured workout templates. The service/API and live UI
support create, edit, duplicate, delete, filter, and load-to-planner behavior. A
template can be assigned through the source-copy command to a roster athlete on
a date without creating duplicate matching sessions.

## Live Path

- **Routes/UI:** `/coach/templates`, `/api/coach/templates/*`,
  `/api/coach/assignments`.
- **Services:** `templateService`, `assignmentService`.
- **Data:** `Template`, `Block`, `Plan`, `Session`, `Assignment`.
- **Shared helpers/components:** `SessionBlockBar`, `MetricText`, `session-math`, `sport`.

## Behavior Already Implemented

- Template reads and writes are owner-scoped.
- Blocks are normalized and persisted in sort order with Tempo fields.
- Duplicate creates a private copy with copied blocks.
- The live editor creates and updates canonical Tempo block fields.
- The live editor uses `SessionComposer` and initializes/serializes through the
  canonical session editor contract.
- Assignment validates athlete roster ownership, template ownership, date, and
  week plan; repeated matching assignment reuses the existing session.
- Template assignments persist a coach baseline payload on the copied Session;
  later template edits do not synchronize into that payload.

## Verification

- `tests/template-service.test.ts` and `tests/coach-builder-assignment.test.ts` pass on 2026-08-21.
- `pnpm test` — 134 passing tests on 2026-08-25, including planner/template
  workflow, migration, and snapshot assertions.
- `pnpm lint && pnpm build` — pass on 2026-08-21.

## Known Gaps

- Template service still contains normalization compatibility for older block
  names; do not remove it without checking persisted data and migration needs.
- Existing template persistence ignores canonical fields not represented by the
  current schema, including skipped state, RPE, and separate coach/athlete notes.
- Assignment behavior has focused tests but no end-to-end browser test.

## Extension Rules

- Start template persistence in `lib/template-service.ts`.
- Start assignment and duplicate-prevention behavior in `lib/assignment-service.ts`.
- Preserve private owner checks and the `Assignment` unique key.
