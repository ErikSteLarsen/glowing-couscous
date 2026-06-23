# Architecture Cleanup Design

**Date:** 2026-06-23  
**Status:** Assumed approved for autonomous execution

## Goal

Remove clearly dead planner-era code so the current Tempo architecture is easier to extend without carrying unused clients, routes, and service branches.

## Problem

The repo has already moved coach and athlete flows onto the newer Tempo surfaces, but a small set of week-planner-era files still remains:

1. `app/(app)/coach/athletes/[athleteId]/CoachPlannerClient.tsx` is no longer imported by any live route.
2. `app/api/coach/athletes/[athleteId]/planner/weeks/**` only serves that dead client.
3. `lib/planner-service.ts` still contains planner-loading and copy/note branches that only supported the removed UI.
4. `lib/athlete-service.ts` still exposes `loadWeekByUserId`, which no live route calls.

## Options

### Option 1: Leave the dead code and only update docs

**Pros**

- Lowest immediate risk.

**Cons**

- Keeps misleading extension points in the codebase.
- Forces future work to distinguish active versus abandoned planner paths.

### Option 2: Remove the dead planner-era surfaces and trim dependent service code **(recommended)**

**Pros**

- Matches the current route structure and docs more closely.
- Removes unused branches from central services.
- Keeps scope surgical and behavior-safe.

**Cons**

- Requires synchronized updates to tests and architecture docs.

### Option 3: Broader service reshaping at the same time

**Pros**

- Could further simplify route/service ownership.

**Cons**

- Too much risk for a cleanup pass in a dirty worktree.

## Recommended design

Use **Option 2**.

Delete the unused legacy coach planner client and the API routes that only existed for it. Then simplify `planner-service` and `athlete-service` by removing dead methods and command branches that become unreachable. Update architecture-facing docs and source-inspection tests so they describe the cleaned current state rather than the transitional one.

## Scope

### Remove

- `app/(app)/coach/athletes/[athleteId]/CoachPlannerClient.tsx`
- `app/api/coach/athletes/[athleteId]/planner/weeks/[weekStart]/route.ts`
- `app/api/coach/athletes/[athleteId]/planner/weeks/[weekStart]/sessions/route.ts`
- `app/api/coach/athletes/[athleteId]/planner/weeks/[weekStart]/copy-previous/route.ts`

### Simplify

- `lib/planner-service.ts`
- `lib/athlete-service.ts`

### Update documentation and tests

- `ARCHITECTURE.md`
- `docs/AI-HANDOFF.md`
- `tests/app-shell-navigation.test.mjs`
- `tests/theme-accessibility.test.mjs`

## Non-goals

- Changing active Tempo coach, athlete, template, or auth flows
- Reworking planner mutations that are still used by live session routes
- Removing `/athlete/profile`, which still acts as a compatibility redirect
