# AI Handoff

This is the fastest way to understand the repo before changing code.

## What this app is

Workout Planner is a coach-athlete planning app built around weekly training plans. Coaches own plan creation. Athletes consume the plan, complete sessions, and leave notes.

## Current shipped state

### Auth and access

- Auth.js v5 is live.
- Credentials login and signup are implemented.
- Google sign-in is supported when OAuth env vars are configured.
- Users are routed by role: coaches to `/coach`, athletes to `/athlete`.
- Athletes without a coach are redirected into the coach-request flow instead of the planner.

### Main user flows

- **Coach dashboard:** roster overview plus pending coach requests.
- **Coach planner:** week navigation, day-focused planning, weekly note editing, session create/edit/delete, copy previous week.
- **Coach templates:** create, edit, delete, and apply private session templates.
- **Athlete onboarding:** find coach, send request, wait for approval, handle rejection.
- **Athlete week view:** read weekly note, open sessions, mark completion, add notes.

### Route map

| Area | Routes |
|---|---|
| Auth | `/`, `/login`, `/signup`, `/setup` |
| Coach | `/coach`, `/coach/athletes/[athleteId]`, `/coach/templates` |
| Athlete | `/athlete`, `/athlete/profile`, `/athlete/find-coach` |
| API | `/api/auth/*`, `/api/coach/*`, `/api/athlete/*`, `/api/coaches` |

## Data model

The source of truth is `prisma/schema.prisma`.

Important models:

- `User` — coach or athlete account
- `Account` — Auth.js provider link
- `CoachRequest` — athlete-to-coach join request
- `AthleteProfile` — accepted coach-athlete relationship
- `PlanWeek` — one athlete week
- `PlannedSession` and `SessionBlock` — planned training content
- `SessionTemplate` and `SessionTemplateBlock` — coach-owned reusable templates
- `SessionCompletion` — athlete done state and notes

## Code boundaries that matter

### Auth

- `auth.ts` configures Auth.js.
- `middleware.ts` handles route protection and role redirects.
- `lib/auth-session.ts` is the server-rendered current-user access point.
- `lib/api-auth.ts` is the API route guard layer.

### Planner and templates

- `lib/planner-service.ts` owns week loading and planner mutations.
- `lib/template-service.ts` owns template persistence.
- `lib/coach-service.ts` owns the coach dashboard read model.
- `lib/athlete-service.ts` owns athlete week/profile reads.
- `lib/coach-request-service.ts` owns onboarding and coach-request flows.
- `lib/week.ts` owns Monday-based week shaping and per-day session grouping.
- `lib/sport.ts` owns shared sport constants and UI labels.
- `lib/workout-spec.ts` owns block normalization and persistence shaping.
- `lib/workout-editor.ts` owns shared draft shaping used by planners and templates.

### Shared UI

- `components/CoachEditorDrawer.tsx` is the shared editor shell.
- `components/WorkoutBlocksEditor.tsx` is the shared workout-block editor.
- `components/ui.tsx` contains page-shell primitives.

## Transitional areas and known weak spots

These are the first places to be careful when extending the app:

1. The main runtime boundaries are now much clearer, but there is still no committed automated test suite around them.
2. The coach dashboard, planner, and template flows are good candidates for service-level tests because they now have cleaner seams.
3. Athlete onboarding and request-state UX still has room for polish even though the core flow is in place.

## Safe extension rules

- If the feature changes planner behavior, extend `lib/planner-service.ts` first.
- If the feature changes template behavior, extend `lib/template-service.ts`.
- If the feature changes athlete onboarding or coach-request lifecycle behavior, extend `lib/coach-request-service.ts`.
- If the feature changes athlete-facing week/profile reads, extend `lib/athlete-service.ts`.
- Do not add new Prisma business logic directly to route handlers if an existing service already owns that behavior.
- Keep Monday as the week boundary.
- Reuse shared editor primitives before building new planner/template editing UIs.
- Use `.copilot/skills/project-architecture/` when making architecture-sensitive changes so new work follows the current owner map.

## Best next step

The clearest next step is to **add boundary-focused tests around auth, planner, template, and coach-dashboard flows**.

Why this is the highest-value move:

1. The refactor work has already created cleaner seams, so tests can now lock them in.
2. Future feature work will be safer once those service boundaries have regression coverage.
3. The highest-risk behavior now lives in a small number of central modules instead of scattered page-level reads.

## Recommended next work after that

1. Add focused tests around `lib/api-auth.ts`, `lib/planner-service.ts`, `lib/template-service.ts`, and `lib/coach-service.ts`.
2. Add a lightweight test strategy for the new pure utility modules such as `lib/week.ts` and `lib/sport.ts`.
3. Continue polishing athlete onboarding and cross-role navigation now that auth is stable.

## Fast file map for common tasks

| Task | Start here |
|---|---|
| Change auth flow | `auth.ts`, `middleware.ts`, `lib/auth-session.ts`, `lib/api-auth.ts` |
| Change coach planner behavior | `lib/planner-service.ts`, `lib/week.ts`, `app/coach/athletes/[athleteId]/page.tsx`, `app/api/coach/athletes/[athleteId]/planner/...` |
| Change athlete week behavior | `app/athlete/page.tsx`, `app/api/athlete/sessions/[sessionId]/completion/route.ts` |
| Change template behavior | `lib/template-service.ts`, `lib/sport.ts`, `app/coach/templates/page.tsx`, `app/api/coach/templates/*` |
| Change onboarding / coach requests | `app/athlete/find-coach/page.tsx`, `app/athlete/profile/page.tsx`, `app/api/athlete/coach-requests/route.ts`, `app/api/coach/requests/*` |

## Read next

1. `ARCHITECTURE.md` for the current implementation model
2. `SPEC.md` for product scope and roadmap
3. `CLAUDE.md` for repo-specific coding guidance
