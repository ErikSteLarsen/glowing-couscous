# Architecture Notes

This document describes the **implemented** architecture, not old plans.

## Route surface

### Auth routes

- `/` redirects to `/login`
- `/login`
- `/signup`
- `/setup`

### Coach routes

- `/coach`
- `/coach/athletes/[athleteId]`
- `/coach/templates`

### Athlete routes

- `/athlete`
- `/athlete/profile`
- `/athlete/find-coach`

### API areas

- `app/api/auth/*`
- `app/api/coach/*`
- `app/api/athlete/*`
- `app/api/coaches/route.ts`

## Main runtime boundaries

### Auth boundary

- `auth.ts` defines Auth.js providers, callbacks, and session shaping.
- `middleware.ts` enforces login, role redirects, and setup redirects.
- `lib/auth-session.ts` is the current-user lookup for server-rendered UI.
- `lib/api-auth.ts` is the route-handler guard layer.

Use `auth-session` in pages and server components. Use `api-auth` in route handlers.

### Planner boundary

- `lib/planner-service.ts` owns week-scoped planner loading and mutations.
- Planner commands currently include session save/delete, weekly note save, copy previous week, and athlete completion updates.
- Coach planner routes under `app/api/coach/athletes/[athleteId]/planner/...` should stay thin and delegate to this service.

If a feature changes planner behavior, add it here first instead of scattering Prisma calls through pages and routes.

### Template boundary

- `lib/template-service.ts` owns coach template listing and persistence.
- `app/api/coach/templates/*` should keep delegating to this service.

### Coach-dashboard boundary

- `lib/coach-service.ts` owns the coach dashboard read model.
- `app/coach/page.tsx` should keep using this service instead of embedding Prisma reads.

### Athlete boundary

- `lib/athlete-service.ts` owns athlete profile and athlete-facing week/profile reads.
- `app/athlete/page.tsx` and `app/athlete/profile/page.tsx` should stay thin and delegate to this service.

### Coach-request boundary

- `lib/coach-request-service.ts` owns coach search plus request list/create/decision flows.
- `/api/coaches`, `/api/athlete/coach-requests`, and `/api/coach/requests/*` should stay thin and delegate to this service.

### Calendar and sport-domain helpers

- `lib/week.ts` owns Monday-based week shaping and grouping helpers.
- `lib/sport.ts` owns shared sport constants and human-readable sport labels.

### Workout-content boundary

- `lib/workout-spec.ts` owns block normalization, validation helpers, and persistence shaping.
- `lib/workout-editor.ts` owns shared workout draft shaping used by session and template editing.
- `components/WorkoutBlocksEditor.tsx` is the shared block-editing UI.
- `components/CoachEditorDrawer.tsx` is the shared coach-side editor shell.

## Data ownership

The source of truth for models is `prisma/schema.prisma`.

Important ownership relationships:

- `User.role` drives access and redirects.
- `CoachRequest` tracks athlete-to-coach connection requests.
- `AthleteProfile` represents an accepted coach-athlete relationship.
- `PlanWeek` is unique per athlete and Monday week start.
- `PlannedSession` belongs to a `PlanWeek`.
- `SessionCompletion` belongs to a session and athlete user.
- `SessionTemplate` is coach-owned and private.

## Transitional areas

The main read/write boundaries are now clearer, but they still need protection:

- There is no automated regression coverage around `planner-service`, `template-service`, `coach-service`, or the auth guard layer.
- Pages still compose several service outputs directly, so future work should avoid slipping business logic back into route components.

## Safe extension rules

1. Keep week logic Monday-based everywhere.
2. Add planner behavior to `planner-service` before touching API handlers.
3. Add template behavior to `template-service` before touching API handlers.
4. Reuse shared workout-editor and block-editor primitives instead of duplicating draft logic.
5. Prefer focused domain modules like `coach-service`, `week`, and `sport` over reviving mixed helper files.
6. Keep future agents aligned with `.copilot/skills/project-architecture/` when boundary work is involved.

## Highest-value architectural next step

Add boundary-focused tests around planner, template, coach-dashboard, and auth behavior so the new module boundaries stay stable as features are added.
