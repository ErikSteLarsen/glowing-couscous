# Task: Harden Compatibility Boundary And Align Documentation

- **Status:** `planned`
- **Agent:** `<assigned agent>`
- **Created:** `2026-08-21`
- **Task ID:** `COMPAT-002`
- **Feature IDs:** `COMPAT-001`, `CLEANUP-001`, `COVERAGE-001`, `OPS-001`
- **Related records:** [compatibility](../features/compatibility.md), [planner](../features/planner.md), [current status](../CURRENT-STATUS.md), [audit](2026-08-21-incompleteness-audit.md)
- **Dependencies:** Complete or coordinate with completion-integrity and API-validation work before changing shared session semantics.

## Problem

`/api/coach/sessions/[sessionId]` and `lib/planner-service.ts` remain live
compatibility code, but cross-week edits can attach a session to the old week
Plan while using a new date. The compatibility path does not verify template
ownership. Completed/activity behavior during edits is unspecified. The old
`BuilderClient` remains while `/coach/builder` only redirects, and a source test
passes because a comment mentions the client. `ARCHITECTURE.md` and
`docs/AI-HANDOFF.md` still describe the old planner as the active owner.

Relevant files:

- `app/api/coach/sessions/[sessionId]/route.ts`
- `lib/planner-service.ts`
- `lib/planner.ts`
- `lib/workout-spec.ts`
- `lib/workout-editor.ts`
- `app/(app)/coach/builder/page.tsx`
- `app/(app)/coach/builder/BuilderClient.tsx`
- `tests/app-shell-navigation.test.mjs`
- `tests/architecture-boundaries.test.mjs`
- `tests/coach-builder-assignment.test.ts`
- `ARCHITECTURE.md`
- `docs/AI-HANDOFF.md`

## Design

Keep the compatibility adapter small and explicitly bounded. New planner
behavior must remain in `coach-planner-service`,
`coach-session-library-service`, and `coach-training-plan-service`.

Choose and document one cross-week contract for legacy edits: reject them,
move/reassign the session to the new week Plan, or preserve the old date. The
recommended policy is to move/reassign using the active week-plan semantics.
Verify template ownership before persisting `sourceTemplateId`. Coordinate
completed-session behavior with the completion-integrity task.

Replace comment-based source assertions with real redirect and compatibility
behavior tests. Remove `BuilderClient.tsx` only after `git grep` reference
analysis proves it has no external consumer; otherwise document why it remains.

## Implementation Steps

1. Add failing tests for cross-week edits, foreign template IDs, completed
   session edits, owner isolation, legacy block mapping, and redirect query preservation.
2. Implement the chosen legacy date/Plan contract and ownership checks.
3. Remove or document dead builder client references and fix misleading tests.
4. Rewrite architecture and AI handoff ownership maps to name the active planner services.
5. Update compatibility, planner, current-status, work-index, decision, and history records.

## Acceptance Criteria

- Compatibility update/delete remains coach-owner scoped.
- Legacy block normalization and fallback duration remain regression tested.
- Cross-week behavior is explicit, consistent, and tested.
- Foreign templates cannot be persisted through the compatibility route.
- Completed/activity state behavior is consistent with the chosen completion policy.
- `/coach/builder` has a runtime redirect test and no comment-only source assertion.
- Dead builder code is removed or has a documented external-consumer reason.
- Current architecture docs direct new planner work to the active services and
  label the old path transitional.
- No new product behavior is added to `planner-service.ts`.

## Verification

```bash
git grep -n "BuilderClient\|/api/coach/sessions\|planner-service\|workout-spec\|workout-editor"
pnpm test -- --test-name-pattern="compat|legacy|builder|planner"
pnpm lint
pnpm build
```
