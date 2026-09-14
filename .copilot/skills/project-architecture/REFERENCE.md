# Project Architecture Reference

## Current Service Owners

- `lib/auth-session.ts` and `lib/api-auth.ts` - current user access and API guards
- `lib/account-service.ts` - account profile, performance profile, and preferences
- `lib/coach-service.ts` - coach roster and athlete detail
- `lib/athlete-service.ts` - athlete Home, Calendar, Activity, profile, discovery, and session reads
- `lib/coach-request-service.ts` - coach search and request lifecycle
- `lib/coach-planner-service.ts` and `lib/athlete-planner-service.ts` - dated planning mutations
- `lib/workout-library-service.ts` and `lib/coach-session-library-service.ts` - unscheduled workout libraries
- `lib/template-service.ts` - reusable templates
- `lib/coach-training-plan-service.ts` - reusable coach training plans
- `lib/assignment-service.ts` - source-copy assignment and lineage
- `lib/planner-service.ts` - transitional older coach session adapter
- `lib/session-editor.ts`, `lib/workout-editor.ts`, and `lib/workout-blocks.ts` - canonical workout content
- `lib/athlete-completion-service.ts`, `lib/session-snapshot-service.ts`, `lib/athlete-session-adjustment-service.ts`, and `lib/session-comparison-service.ts` - session outcomes and comparison
- `lib/share-link.ts` and `lib/share-link-service.ts` - sanitized public sharing and explicit intake

## Extension Rules

1. Put Prisma-backed business behavior in the owning `lib/` service, not in route handlers or pages.
2. Extend an existing owner before adding a module.
3. Keep planner weeks Monday-based.
4. Keep Workout library records owner-scoped and unscheduled; Planner owns dates.
5. Keep copied source content independent and retain lineage in assignment models.
6. Keep public share projections sanitized and profile-free.

## Change Checklist

1. Find the owning service and existing tests.
2. Keep adapters thin and input validation explicit.
3. Add or update a boundary test when a rule changes.
4. Update `ARCHITECTURE.md`, `CURRENT-STATUS.md`, and `WORK-INDEX.md` when the change is durable.
5. Run `pnpm test`, `pnpm lint`, and `pnpm build` before finishing when possible.
