---
name: project-architecture
description: Guides contributors through this repo's service-boundary architecture and safe extension workflow. Use when changing routes, pages, Prisma-backed behavior, or introducing new domain logic in the workout planner.
---

# Project Architecture

## Quick start

1. Read `docs/agent-workspace/README.md`, `CURRENT-STATUS.md`, and `WORK-INDEX.md`.
2. Read the related feature record and `docs/AI-HANDOFF.md`.
3. Read `ARCHITECTURE.md`.
4. Identify the owning `lib/` service before editing pages or route handlers.
5. Keep Prisma-backed business logic out of `app/` unless no service owner exists yet.
6. Update the agent workspace if boundaries, behavior, status, or verification changes.

## Workflows

### Extending planner behavior

- Start in `lib/planner-service.ts`.
- Keep API handlers under `app/api/coach/athletes/[athleteId]/planner/` thin.
- Reuse `lib/workout-editor.ts` and `lib/workout-spec.ts` before adding draft logic elsewhere.

### Extending templates or dashboard reads

- Start in `lib/template-service.ts` or `lib/coach-service.ts`.
- Keep `app/coach/templates/page.tsx` and `app/coach/page.tsx` as consumers, not owners.

### Extending athlete onboarding or coach requests

- Start in `lib/coach-request-service.ts`.
- Keep `/api/coaches`, `/api/athlete/coach-requests`, and `/api/coach/requests/*` as adapters.

### Extending athlete-facing week/profile reads

- Start in `lib/athlete-service.ts`.
- Keep `app/athlete/page.tsx` and `app/athlete/profile/page.tsx` free of Prisma business reads.

## Smell checks

- Does a page or route call `prisma.*` directly for business behavior?
- Is new domain logic being added to a component instead of a `lib/` owner?
- Is a new service being created even though an existing owner already fits?
- Did a boundary change without matching doc updates?

See [REFERENCE.md](REFERENCE.md) for the current owner map and extension rules.
