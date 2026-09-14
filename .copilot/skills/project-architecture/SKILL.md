---
name: project-architecture
description: Guides contributors through this repo's service ownership and safe extension workflow.
---

# Project Architecture

## Quick Start

1. Read `README.md`, `docs/agent-workspace/CURRENT-STATUS.md`, and `docs/agent-workspace/WORK-INDEX.md`.
2. Read `ARCHITECTURE.md` before changing routes, services, Prisma, or authentication.
3. Identify the owning `lib/` service before editing a page, route, or client mutation.
4. Keep Prisma-backed business behavior out of `app/` unless the architecture document names an explicit exception.
5. Update current status and the work index when behavior, ownership, or verification changes.

## Workflows

### Planner and library behavior

- Start in `lib/coach-planner-service.ts`, `lib/athlete-planner-service.ts`, or `lib/workout-library-service.ts` based on ownership.
- Keep standalone Workouts records unscheduled. Use Planner and `lib/assignment-service.ts` for dates and source copies.
- Reuse `lib/session-editor.ts`, `lib/session-editor-adapters.ts`, and `components/WorkoutBuilder.tsx` for structured editing.

### Templates and coach reads

- Start in `lib/template-service.ts` for templates.
- Start in `lib/coach-service.ts` for roster and athlete-detail reads.
- Keep the corresponding pages as consumers and adapters.

### Athlete and account behavior

- Start in `lib/athlete-service.ts` for athlete reads and `lib/account-service.ts` for profile/preferences.
- Start in `lib/coach-request-service.ts` for discovery and request lifecycle.
- Use `lib/athlete-completion-service.ts` for completion and `lib/athlete-session-adjustment-service.ts` for planned edits.

## Smell Checks

- Is a page or route calling `prisma.*` for behavior already owned by a service?
- Is a new service being created even though an owner already fits?
- Is a source copy being synchronized instead of persisted as an independent snapshot?
- Did a boundary change without updating `ARCHITECTURE.md` and the current workspace?
