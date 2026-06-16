# Project Architecture Improvement Design

**Date:** 2026-06-16  
**Status:** Assumed approved for autonomous execution

## Goal

Tighten the app's runtime architecture so the documented service boundaries become the default way to extend the product, then add a reusable project skill that teaches future agents how to preserve those boundaries.

## Problem

The repo already has a good architectural direction, but it is only partially enforced:

1. Some page components and route handlers still talk to Prisma directly instead of going through focused domain services.
2. Coach-request and athlete-onboarding behavior is spread across multiple routes and pages without a dedicated owning module.
3. Existing services are inconsistent about construction style and test seams. `planner-service` supports dependency injection, while `template-service` and `coach-service` are still singleton-first.
4. The architecture lives in docs, but there is no repo-local skill that turns those rules into a repeatable workflow for future changes.

## Architecture improvement options

### Option 1: Documentation-only guardrails

Keep the current code shape, add a project skill, and update docs so future contributors know the intended boundaries.

**Pros**

- Fastest and lowest-risk change.
- Gives future agents clearer guidance immediately.

**Cons**

- Leaves current leaks in place.
- The codebase still teaches mixed patterns by example.

### Option 2: Complete the service-boundary refactor and add a project skill **(recommended)**

Add the missing service modules for athlete-facing reads and coach-request flows, move remaining direct Prisma business reads and writes behind them, standardize service construction, and encode the rules in a repo-local skill.

**Pros**

- Aligns the live code with `ARCHITECTURE.md`.
- Reduces future boundary drift by fixing both code and guidance.
- Keeps scope small enough for one focused architecture pass.

**Cons**

- Touches several files across pages, routes, and `lib/`.
- Requires careful shaping of service return values so UI behavior stays unchanged.

### Option 3: Introduce a full repository/use-case layering

Create repository classes plus use-case modules for every domain area, then move all Prisma access and orchestration into that deeper stack.

**Pros**

- Maximally explicit layering.
- Strong long-term separation if the app becomes much larger.

**Cons**

- Too heavy for the current app size.
- Adds indirection before the existing service layer is fully exhausted.

## Recommended design

Use **Option 2**.

The app already has the right architectural center of gravity: focused domain services in `lib/`, thin App Router pages, and thin API handlers. The highest-value improvement is to finish that move instead of introducing a new abstraction tier.

## Target boundaries

### 1. Athlete read boundary

Create a focused athlete-facing read service that owns:

- Resolving the current athlete profile relationship
- Loading the athlete week view input
- Loading athlete profile/request state for `/athlete/profile`

This removes direct Prisma reads from athlete pages and gives the athlete surface one obvious extension point.

### 2. Coach-request boundary

Create a coach-request service that owns:

- Listing athlete requests
- Searching coaches for athlete onboarding
- Creating athlete-to-coach requests
- Listing pending coach requests
- Accepting or rejecting coach requests

This consolidates onboarding and request lifecycle behavior, which is currently split across `/api/coaches`, `/api/athlete/coach-requests`, and `/api/coach/requests/*`.

### 3. Service construction consistency

Standardize the smaller services on the same pattern already used by `planner-service`:

- `createTemplateService(...)`
- `createCoachService(...)`
- default exported singleton instances for app use

That keeps runtime ergonomics unchanged while making service seams consistent.

### 4. Project architecture skill

Add a repo-local skill dedicated to this project's architecture rules. The skill should teach future agents to:

- Start from `docs/AI-HANDOFF.md` and `ARCHITECTURE.md`
- Keep pages and route handlers thin
- Put Prisma-backed business behavior in `lib/` domain services
- Extend existing service owners before adding new ones
- Use focused service outputs instead of leaking raw Prisma models across the app
- Update architecture docs when boundaries change

The skill should act as a practical checklist, not just narrative documentation.

## Planned code changes

| Area | Change |
|---|---|
| `lib/athlete-service.ts` | New service for athlete profile and week-facing reads |
| `lib/coach-request-service.ts` | New service for request search, create, list, and decision flows |
| `lib/template-service.ts` | Convert to factory + singleton pattern |
| `lib/coach-service.ts` | Convert to factory + singleton pattern |
| `app/athlete/page.tsx` | Replace direct Prisma profile lookup with athlete service |
| `app/athlete/profile/page.tsx` | Replace direct Prisma reads with athlete service |
| `app/api/coaches/route.ts` | Delegate coach search to coach-request service |
| `app/api/athlete/coach-requests/route.ts` | Delegate list/create to coach-request service |
| `app/api/coach/requests/route.ts` | Delegate pending-request list to coach-request service |
| `app/api/coach/requests/[requestId]/route.ts` | Delegate accept/reject mutation to coach-request service |
| repo skill files | Add a project-local architecture skill package |
| `ARCHITECTURE.md` / `docs/AI-HANDOFF.md` | Update boundary map to include the new services and skill |

## Data flow

1. **Server pages** authenticate with `getCurrentUser`, then call focused read services in `lib/`.
2. **API routes** authenticate with `requireCoach` / `requireAthlete`, then hand validated inputs to service methods.
3. **Services** own Prisma access, authorization-sensitive record checks, orchestration, and response shaping.
4. **Shared domain helpers** such as week and workout shaping remain pure helpers under `lib/`.

## Error handling

- Route handlers keep request parsing and HTTP response shaping.
- Services return explicit not-found, conflict, and validation outcomes for expected failures.
- Unexpected failures continue to throw so Next.js can surface them instead of silently hiding them.
- Ownership checks stay close to the service methods that mutate or expose data.

## Validation strategy

There is no committed automated test suite yet, so this change should validate with the existing project commands:

1. `pnpm lint`
2. `pnpm build`

## Non-goals

- Introducing a repository layer below services
- Reworking planner-service ownership, which is already the strongest boundary
- Expanding product scope or changing user-visible workflows

## Expected outcome

After this pass, the app should have one clear service owner for each current domain area:

- Auth/session guards
- Planner
- Templates
- Coach dashboard
- Athlete reads
- Coach-request onboarding

Future contributors should also have a repo-local skill that turns those boundaries into a repeatable extension workflow instead of relying on tribal memory.
