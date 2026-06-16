# Project Architecture Reference

## Current service owners

- `lib/planner-service.ts` — week-scoped planner reads and mutations
- `lib/template-service.ts` — coach template persistence
- `lib/coach-service.ts` — coach dashboard reads
- `lib/athlete-service.ts` — athlete week and athlete-profile reads
- `lib/coach-request-service.ts` — coach search and request lifecycle
- `lib/api-auth.ts` — API authorization guards
- `lib/auth-session.ts` — server-rendered current-user lookup

## Extension rules

1. Put Prisma-backed business behavior in `lib/` service modules, not route handlers or page components.
2. Extend an existing owner before adding a new service.
3. Keep planner week logic Monday-based everywhere.
4. Reuse `lib/workout-editor.ts` and `lib/workout-spec.ts` for workout content shaping.
5. Update `ARCHITECTURE.md` and `docs/AI-HANDOFF.md` when the owner map changes.

## Current adapter surfaces

- `app/coach/page.tsx` reads from `lib/coach-service.ts`
- `app/coach/templates/page.tsx` reads from `lib/template-service.ts`
- `app/athlete/page.tsx` and `app/athlete/profile/page.tsx` read from `lib/athlete-service.ts`
- `app/api/coaches/route.ts`, `app/api/athlete/coach-requests/route.ts`, and `app/api/coach/requests/*` delegate to `lib/coach-request-service.ts`

## Change checklist

1. Find the owning service first.
2. Keep adapters thin and data-shaping explicit.
3. Add or update boundary tests when a rule changes.
4. Run the architecture test, lint, and build before finishing.
