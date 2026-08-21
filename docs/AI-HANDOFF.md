# AI Handoff

This is the fastest way to understand the repo before changing code.

For coordination across agents, read `docs/agent-workspace/README.md` first.
It links the current snapshot, feature status, active tasks, decisions, and
append-only history. Update that workspace when work changes the repository.

## What this app is

Workout Planner is now a Tempo-aligned coach-athlete planning app. Coaches manage rosters, templates, and builder assignments; athletes use Home, Calendar, Session, Live, Activity, and Settings surfaces to follow the plan.

## Current shipped state

### Auth and access

- Auth.js v5 is live.
- Credentials login and signup are implemented.
- Google sign-in is supported when OAuth env vars are configured.
- Users are routed by role: coaches to `/coach`, athletes to `/athlete`.
- Athletes without a coach are redirected into the coach-request flow instead of the main Tempo surfaces.

### Main user flows

- **Coach roster:** athlete overview plus pending coach requests.
- **Coach athlete detail:** weekly status, recent planned-vs-done history, and builder handoff.
- **Coach builder:** assign a template onto an athlete schedule.
- **Coach templates:** create, edit, duplicate, delete, and load private session templates into the builder.
- **Athlete onboarding:** find coach, send request, wait for approval, handle rejection.
- **Athlete Tempo surfaces:** Home, Calendar, Session detail, Live execution, Activity history, and Settings preferences.

### Route map

| Area | Routes |
|---|---|
| Auth | `/`, `/login`, `/signup`, `/setup` |
| Coach | `/coach`, `/coach/athletes/[athleteId]`, `/coach/builder`, `/coach/templates` |
| Athlete | `/athlete`, `/athlete/calendar`, `/athlete/session/[sessionId]`, `/athlete/live/[sessionId]`, `/athlete/activity`, `/settings`, `/athlete/profile`, `/athlete/find-coach` |
| API | `/api/auth/*`, `/api/coach/*`, `/api/athlete/*`, `/api/coaches` |

## Data model

The source of truth is `prisma/schema.prisma`.

Important models:

- `User` — coach or athlete account
- `Account` — Auth.js provider link
- `CoachRequest` — athlete-to-coach join request
- `Plan` — athlete training window and goal-race context
- `Session` and `Block` — planned training content with block-derived metrics
- `Template` — coach-owned reusable workout definitions
- `Activity` — completed session outcomes and compliance
- `Assignment` — coach scheduling records

`User.role` is nullable only for a first-time Auth.js user before setup.
`User.name`, `image`, and `emailVerified` are nullable for adapter compatibility;
application services normalize names for UI consumers.
`CoachRequest.pendingAthleteId` is a nullable unique key populated only while a
request is pending.

## Code boundaries that matter

### Auth

- `auth.ts` configures Auth.js.
- `middleware.ts` handles route protection and role redirects.
- `lib/auth-session.ts` is the server-rendered current-user access point.
- `lib/api-auth.ts` is the API route guard layer.
- `lib/auth-principal.ts` validates session IDs and role claims.
- `lib/auth-role-service.ts` owns one-time atomic role assignment.
- `lib/route-params.ts` owns strict positive-integer and JSON-object API input
  parsing.

### Planner and templates

- `lib/planner-service.ts` owns the remaining coach-side week planner APIs and their mutations.
- `lib/template-service.ts` owns template persistence.
- `lib/coach-service.ts` owns roster and athlete-detail read models.
- `lib/assignment-service.ts` owns builder assignment creation and deduplication.
- `lib/athlete-service.ts` owns athlete Home/Calendar/Session/Live/Activity/discovery/profile reads.
- `lib/athlete-completion-service.ts` owns completion/reopen transactions and
  Activity outcome writes.
- `lib/coach-request-service.ts` owns onboarding and coach-request flows.
- `lib/week.ts` owns Monday-based week shaping and per-day session grouping.
- `lib/sport.ts` owns shared sport constants and UI labels.
- `lib/session-math.ts` owns duration/TSS/zone derivation from structured blocks.
- `lib/workout-editor.ts` owns shared draft shaping used by planners and templates.

### Shared UI

- `components/CoachEditorDrawer.tsx` is the shared editor shell.
- `components/WorkoutBlocksEditor.tsx` is the shared workout-block editor.
- `components/ui.tsx` contains page-shell primitives.

## Transitional areas and known weak spots

These are the first places to be careful when extending the app:

1. The Tempo routes now build and test cleanly, but service-level coverage is still lighter than the surface area.
2. Athlete onboarding and request-state UX still has room for polish even though the core flow is in place.

## Safe extension rules

- If the feature changes planner behavior, extend `lib/planner-service.ts` first.
- If the feature changes template behavior, extend `lib/template-service.ts`.
- If the feature changes athlete onboarding or coach-request lifecycle behavior, extend `lib/coach-request-service.ts`.
- Keep one-pending-request uniqueness in the database key and resolve competing
  requests inside the service transaction.
- If the feature changes athlete-facing week/profile reads, extend `lib/athlete-service.ts`.
- Do not add new Prisma business logic directly to route handlers if an existing service already owns that behavior.
- Keep Monday as the week boundary.
- Reuse shared editor primitives before building new planner/template editing UIs.
- Use `.copilot/skills/project-architecture/` when making architecture-sensitive changes so new work follows the current owner map.
- Protected API routes must guard first, parse dynamic IDs with
  `route-params`, and leave ownership/business rules to their service.
- Completed sessions are immutable through planner mutations; completion/reopen
  behavior belongs in `athlete-completion-service`.
- Do not use the setup endpoint for role changes; extend `auth-role-service` if
  an explicit future account-management flow is introduced.

## Best next step

The clearest next step is to **deepen service-level coverage around auth, planner, assignment, template, and coach-detail flows**.

Why this is the highest-value move:

1. The refactor work has already created cleaner seams, so tests can now lock them in.
2. Future feature work will be safer once those service boundaries have regression coverage.
3. The highest-risk behavior now lives in a small number of central modules instead of scattered page-level reads.

## Recommended next work after that

1. Add focused tests around `lib/api-auth.ts`, `lib/planner-service.ts`, `lib/template-service.ts`, `lib/assignment-service.ts`, and `lib/coach-service.ts`.
2. Continue polishing athlete onboarding and cross-role navigation now that the Tempo shell is stable.

## Fast file map for common tasks

| Task | Start here |
|---|---|
| Change auth flow | `auth.ts`, `middleware.ts`, `lib/auth-session.ts`, `lib/api-auth.ts` |
| Change coach scheduling behavior | `lib/planner-service.ts`, `lib/assignment-service.ts`, `app/coach/builder/page.tsx`, `app/api/coach/assignments/route.ts`, `app/api/coach/sessions/[sessionId]/route.ts` |
| Change coach roster / athlete detail | `lib/coach-service.ts`, `app/coach/page.tsx`, `app/coach/athletes/[athleteId]/page.tsx` |
| Change athlete Tempo surfaces | `lib/athlete-service.ts`, `app/athlete/page.tsx`, `app/athlete/calendar/page.tsx`, `app/athlete/session/[sessionId]/page.tsx`, `app/athlete/activity/page.tsx`, `app/api/athlete/sessions/[sessionId]/completion/route.ts` |
| Change template behavior | `lib/template-service.ts`, `lib/sport.ts`, `app/coach/templates/page.tsx`, `app/api/coach/templates/*` |
| Change onboarding / coach requests | `app/athlete/find-coach/page.tsx`, `app/athlete/profile/page.tsx`, `app/api/athlete/coach-requests/route.ts`, `app/api/coach/requests/*` |

## Read next

1. `docs/agent-workspace/CURRENT-STATUS.md` for the verified current snapshot
2. `docs/agent-workspace/WORK-INDEX.md` and the related feature record before taking work
3. `ARCHITECTURE.md` for the current implementation model
4. `SPEC.md` for product scope and roadmap
5. `CLAUDE.md` for repo-specific coding guidance
