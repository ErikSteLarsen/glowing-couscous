# Task: Complete Planner And Template User Workflows

- **Status:** `completed`
- **Agent:** `opencode-workflow-2026-08-21`
- **Created:** `2026-08-21`
- **Task ID:** `WORKFLOW-001`
- **Feature IDs:** `PLAN-001`, `LIB-001`, `TPLAN-001`, `TEMPLATE-001`
- **Related records:** [planner](../features/planner.md), [templates](../features/templates.md), [source assignment](2026-08-21-source-copy-assignment.md), [audit](2026-08-21-incompleteness-audit.md)
- **Dependencies:** Depends on the source-copy assignment command contract. Can proceed after its service interface is available.
- **Completed:** 2026-08-21
- **Completion record:** [progress and verification](2026-08-21-planner-template-workflows-progress.md)

## Problem

The active `/coach/planner` has authoring modes but no “assign library
session,” “assign training plan,” or target-date/week preview. `/coach/templates`
has list/duplicate/delete but no live create/edit editor even though its APIs
exist. `/coach/builder` redirects to the planner, so its old assignment client
is not a real user path.

Relevant files:

- `app/(app)/coach/planner/page.tsx`
- `app/(app)/coach/planner/PlannerClient.tsx`
- `app/(app)/coach/templates/page.tsx`
- `app/(app)/coach/templates/CoachTemplatesClient.tsx`
- `app/(app)/coach/builder/page.tsx`
- `app/(app)/coach/builder/BuilderClient.tsx`
- `lib/planner-draft.ts`
- `components/WorkoutBlocksEditor.tsx`

## Design

Keep `PlannerClient` as the workspace shell, but extract a reusable
`SessionComposer` for the active Tempo block draft. Add small presentational
modules for source cards and an assignment panel. The assignment panel should
accept the source union from the source-copy task and expose only the required
target controls:

- template/library source: roster athlete plus date;
- training plan source: roster athlete plus target Monday week;
- preview of the resulting dates and session titles.

Make mode changes explicit. A loaded source draft must either be preserved with
an explicit ownership conversion or be reset with confirmation; silently
replacing it with a new blank draft is not acceptable. Changing the selected
training plan must clear incompatible session state.

Build a live template editor using the canonical Tempo block contract from
`planner-draft.ts`; do not reuse the old legacy `WorkoutBlocksEditor` contract
without an explicit adapter. The editor should call the existing template
create/update APIs and support load-to-planner.

Either delete `BuilderClient.tsx` after reference analysis or make the builder
redirect a documented, tested compatibility route. Do not retain tests that
pass because a comment mentions `BuilderClient`.

## Implementation Steps

1. Add failing source/interaction tests for assignment controls, target preview,
   mode-switch safety, template create/edit, and builder redirect behavior.
2. Extract the shared active Tempo session composer without changing its draft contract.
3. Add source cards and assignment panel wired to the source-copy service route.
4. Add live template create/edit UI and refresh behavior.
5. Replace misleading builder source assertions with route/behavior assertions.
6. Remove or document dead builder client references.
7. Update planner/template feature records, architecture docs, work index, and history.

## Acceptance Criteria

- A coach can assign a template, standalone library session, and training plan
  from the active UI without manually rebuilding content.
- Training-plan assignment previews Monday-based target dates before saving.
- Repeat assignment reports reused content rather than creating duplicates.
- Source content remains unchanged after assignment.
- Template create and edit are available from `/coach/templates` or a clearly
  routed editor entry point.
- Planner mode switches do not silently lose or misroute a loaded draft.
- `/coach/builder` preserves supported query parameters and has a real redirect test.
- No active UI calls the orphaned legacy assignment path.

## Verification

```bash
pnpm test -- --test-name-pattern="planner|template|assignment|builder"
pnpm lint
pnpm build
```
