# Feature: Coach Templates And Assignment

- **ID:** `TEMPLATE-001`
- **Status:** `transitional`
- **Last verified:** `2026-08-21`
- **Owners:** `lib/template-service.ts`, `lib/assignment-service.ts`
- **Related work:** [baseline](../history/2026-08-21-baseline.md), [product scope](../../../SPEC.md), [workflow task](../tasks/2026-08-21-planner-template-workflows.md), [assignment task](../tasks/2026-08-21-source-copy-assignment.md)

## Contract

Coaches own private structured workout templates. The service/API supports
create, edit, duplicate, delete, filter, and load-to-planner behavior; the live
UI currently exposes filtering, duplication, deletion, and loading but still
needs a create/edit editor. A template can be assigned by the existing service
to a roster athlete on a date without creating duplicate matching sessions.

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
- Assignment validates athlete roster ownership, template ownership, date, and
  week plan; repeated matching assignment reuses the existing session.

## Verification

- `tests/template-service.test.ts` and `tests/coach-builder-assignment.test.ts` pass on 2026-08-21.
- `pnpm lint && pnpm build` — pass on 2026-08-21.

## Known Gaps

- Template service still contains normalization compatibility for older block
  names; do not remove it without checking persisted data and migration needs.
- The live UI has no create/edit editor even though the service and APIs support
  those operations.
- The old template assignment client is unreachable and active planner template
  reuse bypasses the dedicated assignment service.
- Assignment behavior has focused tests but no end-to-end browser test.

## Extension Rules

- Start template persistence in `lib/template-service.ts`.
- Start assignment and duplicate-prevention behavior in `lib/assignment-service.ts`.
- Preserve private owner checks and the `Assignment` unique key.
