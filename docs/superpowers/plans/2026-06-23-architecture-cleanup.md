# Architecture Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove dead planner-era code paths and update the remaining docs/tests so the repo reflects the current Tempo architecture.

**Architecture:** Keep the existing service-oriented structure, but delete abandoned coach-planner UI/API surfaces and prune unreachable branches from shared services. Preserve all live Tempo flows and the `/athlete/profile` compatibility redirect.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma, node:test source-inspection tests.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Delete | `app/(app)/coach/athletes/[athleteId]/CoachPlannerClient.tsx` | Remove dead legacy coach planner UI. |
| Delete | `app/api/coach/athletes/[athleteId]/planner/weeks/[weekStart]/route.ts` | Remove dead weekly-note endpoint. |
| Delete | `app/api/coach/athletes/[athleteId]/planner/weeks/[weekStart]/sessions/route.ts` | Remove dead legacy session-create endpoint. |
| Delete | `app/api/coach/athletes/[athleteId]/planner/weeks/[weekStart]/copy-previous/route.ts` | Remove dead copy-previous endpoint. |
| Modify | `lib/planner-service.ts` | Remove unreachable legacy loading/note/copy helpers while keeping active session mutation flows. |
| Modify | `lib/athlete-service.ts` | Remove the unused `loadWeekByUserId` method. |
| Modify | `tests/app-shell-navigation.test.mjs` | Assert the legacy planner client/routes are gone and keep navigation coverage aligned. |
| Modify | `tests/theme-accessibility.test.mjs` | Point input-heavy screen coverage at active coach surfaces. |
| Modify | `ARCHITECTURE.md` | Describe the cleaned planner boundary instead of transitional legacy debt. |
| Modify | `docs/AI-HANDOFF.md` | Remove the “legacy planner code still exists” note and update next-step guidance. |

## Task 1: Write the failing cleanup tests

**Files:**
- Modify: `tests/app-shell-navigation.test.mjs`
- Modify: `tests/theme-accessibility.test.mjs`

- [x] Add assertions that the legacy coach planner client and planner-week API routes no longer exist.
- [x] Add assertions that `lib/planner-service.ts` no longer exposes the dead planner-loading and copy/note branches.
- [x] Replace the deleted `CoachPlannerClient.tsx` accessibility check with the active `app/(app)/coach/builder/BuilderClient.tsx` surface.
- [x] Run `pnpm test -- --test-name-pattern="legacy coach planner surfaces|input-heavy app screens"` and confirm the cleanup assertions fail before implementation.

## Task 2: Remove dead planner-era code

**Files:**
- Delete: `app/(app)/coach/athletes/[athleteId]/CoachPlannerClient.tsx`
- Delete: `app/api/coach/athletes/[athleteId]/planner/weeks/[weekStart]/route.ts`
- Delete: `app/api/coach/athletes/[athleteId]/planner/weeks/[weekStart]/sessions/route.ts`
- Delete: `app/api/coach/athletes/[athleteId]/planner/weeks/[weekStart]/copy-previous/route.ts`
- Modify: `lib/planner-service.ts`
- Modify: `lib/athlete-service.ts`

- [x] Delete the dead planner client and dead planner-week API routes.
- [x] Remove `load`, `save-weekly-note`, `copy-previous-week`, and the legacy serialization helpers from `lib/planner-service.ts`, keeping only live mutation paths.
- [x] Remove `loadWeekByUserId` from `lib/athlete-service.ts`.
- [x] Run the targeted tests again and confirm they pass.

## Task 3: Refresh architecture-facing docs

**Files:**
- Modify: `ARCHITECTURE.md`
- Modify: `docs/AI-HANDOFF.md`

- [x] Update the planner boundary text to describe the current live surface rather than a transitional legacy route set.
- [x] Remove or rewrite notes that say the legacy week-planner client/API still exists.
- [x] Run the full test command used by the repo after the doc/source updates.
