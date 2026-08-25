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
- `/coach/builder`
- `/coach/templates`

### Athlete routes

- `/athlete`
- `/athlete/calendar`
- `/athlete/session/[sessionId]`
- `/athlete/live/[sessionId]`
- `/athlete/activity`
- `/settings`
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
- `lib/auth-principal.ts` validates numeric application IDs and role claims
  without framework imports.
- `lib/auth-role-service.ts` owns the atomic one-time role assignment command.
- `lib/route-params.ts` owns strict positive-integer and JSON-object transport
  parsing for API adapters.

Use `auth-session` in pages and server components. Use `api-auth` in route handlers.

### Planner boundary

- `lib/planner-service.ts` owns coach-side week scheduling mutations for session save/delete flows.
- Active API entry points are the coach session routes under `app/api/coach/sessions/*`.

If a feature changes planner behavior, add it here first instead of scattering Prisma calls through pages and routes.

### Template boundary

- `lib/template-service.ts` owns coach template listing and persistence.
- `app/api/coach/templates/*` should keep delegating to this service.

### Coach boundary

- `lib/coach-service.ts` owns the coach roster and athlete-detail read models.
- `app/coach/page.tsx` and `app/coach/athletes/[athleteId]/page.tsx` should keep using this service instead of embedding Prisma reads.

### Athlete boundary

- `lib/athlete-service.ts` owns athlete Home, Calendar, Session detail, Live, Activity, discovery, and profile reads.
- `lib/athlete-completion-service.ts` owns completion/reopen transactions,
  manual metric provenance, notes retention, and Activity lifecycle writes.
- `lib/session-snapshot-service.ts` owns canonical latest baseline/actual
  payload serialization, bounded metadata validation, replacement, and loading.
- `lib/athlete-session-adjustment-service.ts` owns athlete authorization and
  planned edits to one assigned Session, including Plan/Assignment date movement.
- Athlete pages under `app/(app)/athlete/**` plus `app/(app)/settings/page.tsx` should stay thin and delegate to this service where appropriate.

### Assignment boundary

- `lib/assignment-service.ts` owns coach builder assignment creation and duplicate-prevention rules.
- `app/api/coach/assignments/route.ts` should stay thin and delegate to this service.
- `assignment-service` owns the source union for template, library-session, and
  training-plan snapshots; `Assignment` and `TrainingPlanAssignment` retain
  explicit lineage and idempotency keys.

### Coach-request boundary

- `lib/coach-request-service.ts` owns coach search plus request list/create/decision flows.
- `/api/coaches`, `/api/athlete/coach-requests`, and `/api/coach/requests/*` should stay thin and delegate to this service.
- `CoachRequest.pendingAthleteId` is the nullable unique concurrency key for
  pending requests; the service clears it when requests resolve.

### Calendar and sport-domain helpers

- `lib/week.ts` owns Monday-based week shaping and grouping helpers.
- `lib/sport.ts` owns shared sport constants and human-readable sport labels.
- `lib/session-math.ts` owns derived duration, TSS, zone totals, and block-bar segments from Tempo blocks.

### Workout-content boundary

- `lib/workout-spec.ts` owns block normalization, validation helpers, and persistence shaping.
- `lib/workout-editor.ts` owns shared workout draft shaping used by session and template editing.
- `components/WorkoutBlocksEditor.tsx` is the shared block-editing UI.
- `components/CoachEditorDrawer.tsx` is the shared coach-side editor shell.

## Data ownership

The source of truth for models is `prisma/schema.prisma`.

Important ownership relationships:

- `User.role` drives access and redirects.
- `User.role` is nullable only during first-login setup; role assignment is
  conditional and cannot be changed through the setup endpoint.
- `User.name`, `User.emailVerified`, and `User.image` use Auth.js-compatible
  nullability; application read services normalize nullable names to `''`.
- `CoachRequest` tracks athlete-to-coach connection requests.
- `CoachRequest.pendingAthleteId` is populated only for pending rows, so request
  history can retain the unique athlete/coach pair without allowing competing
  pending requests.
- `User.coachId` represents the accepted coach-athlete relationship.
- `Plan` owns goal/race windows for an athlete.
- `Session` belongs to an athlete and may also belong to a `Plan` or `Template`.
- `Block` is the structured source of truth for session duration, TSS, and zone distribution.
- `Activity` stores performed session outcomes.
- `Activity` stores outcome metrics, persisted segments, metric provenance, and
  nullable compliance when no performed data exists, plus the latest actual
  canonical snapshot and RPE.
- `Session` stores the latest coach baseline canonical snapshot, coach notes, and
  planned RPE. Snapshot payloads are latest-value records, not version history.
- `Assignment` records coach scheduling actions onto athlete calendars.
- `TrainingPlanAssignment` records a reusable-plan copy operation for one athlete
  and Monday target week; child `Assignment` rows point to copied source sessions.
- `Template` is coach-owned and private.

## Transitional areas

The main read/write boundaries are clearer, but they still need protection:

- The current automated coverage is strongest around architecture, shell, and utility seams; service-level regression coverage is still thinner than the UI surface area.
- Pages still compose several service outputs directly, so future work should avoid slipping business logic back into route components.

## Safe extension rules

1. Keep week logic Monday-based everywhere.
2. Add planner behavior to `planner-service` before touching API handlers.
3. Add template behavior to `template-service` before touching API handlers.
4. Reuse shared workout-editor and block-editor primitives instead of duplicating draft logic.
5. Prefer focused domain modules like `coach-service`, `week`, and `sport` over reviving mixed helper files.
6. Keep future agents aligned with `.copilot/skills/project-architecture/` when boundary work is involved.
7. Keep role setup behind `auth-role-service` and validate session principals
   through `auth-principal` rather than casting Auth.js values.
8. Keep route transport parsing in `route-params`; do not move ownership or
   business validation out of the domain service boundary.
9. Treat sessions with Activity outcomes as immutable through planner mutation
   paths; use `athlete-completion-service` for the explicit reopen transition.
10. Keep source-copy behavior in `assignment-service`; source authoring modules
    must not introduce separate copy or synchronization paths.
11. Keep baseline/actual snapshot serialization behind `session-snapshot-service`
    and do not derive historical Activity outcomes from mutable Session blocks.
12. Keep athlete planned mutations behind `athlete-session-adjustment-service`;
    do not extend the compatibility planner route for this behavior.

## Highest-value architectural next step

Add deeper service-level coverage around planner, template, assignment, coach-detail, and auth behavior so the current Tempo boundaries stay stable as features are added.
