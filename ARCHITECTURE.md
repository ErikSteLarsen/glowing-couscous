# Architecture

This document describes the current implementation. The source code, tests, and
`prisma/schema.prisma` remain authoritative.

## Product Priority

The first MVP centers on independent personal training, as defined in
PRODUCT.md. The existing ATHLETE role and /athlete/* routes are the current
implementation of that personal workspace. Coach routes and services remain
supported secondary capabilities; their presence in this owner map does not
make coach feature completion a first-MVP gate. Extend the personal or shared
service owner for personal workflows and preserve role/ownership boundaries.
This priority does not change the current schema, roles, or route names.

## Runtime Shape

Next.js 16 App Router renders pages under `app/`. Authenticated pages use the
grouped `(app)` layout, which loads the current user, redirects users without a
role to `/setup`, and mounts `components/AppShell.tsx`. Server pages read
through `lib/` services. Client components own drafts and call API adapters for
mutations.

Most API routes guard the session with `lib/api-auth.ts`, parse transport input
with `lib/route-params.ts`, and delegate business behavior to a domain service.
The signup route is the intentional authentication exception and owns its
one-time account creation flow directly.

## Routes

### Public and authentication

- `/` - entry redirect
- `/login`, `/signup`, `/setup` - authentication and first-login role setup
- `/share/[token]` - public sanitized workout snapshot

### Coach

- `/coach` - roster
- `/coach/athletes/[athleteId]` - athlete detail
- `/coach/workouts` - owner-scoped unscheduled workout library
- `/coach/planner` - month-first Planning Desk for dated source assignment
- `/coach/builder` - compatibility redirect to the active planner
- `/coach/templates` - private template library

### Athlete

- `/athlete` - Home week overview
- `/athlete/calendar` - URL-addressable week/month calendar, summaries, and personal session rescheduling
- `/athlete/workouts` - owner-scoped unscheduled workout library
- `/athlete/planner` - private month-first multi-date Planning Desk
- `/athlete/templates` - athlete reusable content surface
- `/athlete/session/[sessionId]` - session detail and planned/actual editing
- `/athlete/live/[sessionId]` - local block execution stepper
- `/athlete/activity` - paginated completion history with URL name/sport filters and matching totals
- `/athlete/find-coach` - coach discovery and requests
- `/athlete/profile`, `/profile` - profile surfaces and compatibility alias
- `/settings` - account and overview preferences

Internal visual demos live under `/design/*` and are not part of the primary
navigation.

### API areas

- `/api/auth/*` - Auth.js, signup, and role setup
- `/api/account/*` - account profile and preferences
- `/api/coaches` and `/api/athlete/coach-requests` - athlete discovery
- `/api/coach/requests/*` - coach request decisions
- `/api/coach/planner/*`, `/api/coach/assignments`, `/api/coach/sessions/*` - coach planning
- `/api/coach/workouts/*`, `/api/athlete/workouts/*` - standalone libraries
- `/api/coach/templates/*`, `/api/athlete/templates/*` - reusable templates
- `/api/athlete/planner/*`, `/api/athlete/sessions/*` - athlete planning and outcomes
- `/api/share-links/*` - authenticated share creation and intake

## Service Ownership

| Area | Owner | Responsibility |
|---|---|---|
| Authentication | `auth.ts`, `proxy.ts`, `lib/auth-session.ts`, `lib/api-auth.ts` | Session shaping, redirects, current-user access, and API role guards |
| Account | `lib/account-service.ts` | Profile, performance profile, and overview preference reads/writes |
| Coach reads | `lib/coach-service.ts` | Roster and athlete-detail read models |
| Coach requests | `lib/coach-request-service.ts` | Search, request creation, approval, rejection, and pending uniqueness |
| Athlete reads | `lib/athlete-service.ts` | Home, Calendar, Activity, profile, discovery, and session reads |
| Activity navigation | `lib/activity-navigation.ts` | Validated history filters, page size, and pagination URLs |
| Athlete planning | `lib/athlete-planner-service.ts`, `components/PlannerDesk.tsx` | Month-grid workspace, private dated copies, source search, and athlete planner mutations |
| Coach planning | `lib/coach-planner-service.ts`, `components/PlannerDesk.tsx` | Month-grid workspace, dated sessions, source search, and roster-scoped planner writes |
| Library | `lib/workout-library-service.ts`, `lib/coach-session-library-service.ts` | Unscheduled owner-scoped workout definitions |
| Training plans | `lib/coach-training-plan-service.ts` | Reusable weekday-based coach plans |
| Templates | `lib/template-service.ts`, `CoachTemplatesClient` | Owner-scoped personal and coach templates, cadence, and shared authoring |
| Assignment | `lib/assignment-service.ts` | Snapshot copies, lineage, deduplication, and training-plan assignment |
| Session compatibility | `lib/planner-service.ts` | Older coach session mutation adapter; transitional only |
| Workout content | `lib/session-editor.ts`, `lib/session-editor-adapters.ts`, `lib/workout-editor.ts`, `lib/workout-blocks.ts` | Canonical drafts, editor modes, block normalization, and persistence shaping |
| Targets and metrics | `lib/workout-targets.ts`, `lib/workout-target-resolution.ts`, `lib/performance-profile.ts`, `lib/session-math.ts`, `lib/tempo-blocks.ts` | Relative target catalogs, profile resolution, derived metrics, and timeline segments |
| Session outcomes | `lib/athlete-completion-service.ts`, `lib/session-snapshot-service.ts`, `lib/athlete-session-adjustment-service.ts`, `lib/session-comparison-service.ts` | Completion, baseline/actual snapshots, planned edits, and comparison reads |
| Sharing | `lib/share-link.ts`, `lib/share-link-service.ts` | Sanitized snapshots, opaque tokens, public lookup, and explicit recipient copies |

## Data Ownership

`prisma/schema.prisma` defines `User`, Auth.js `Account`, `CoachRequest`,
`Plan`, `TrainingPlan`, `Session`, `Block`, `Template`, `Activity`,
`Assignment`, `TrainingPlanAssignment`, and `ShareLink`.

- `User.role` controls access. It is nullable only before first-login setup.
- `User.coachId` represents the accepted coach-athlete relationship.
- `Session` can be an athlete assignment, a coach library source, or a training-plan child. A standalone library session has no date, `Plan`, or `TrainingPlan`.
- `Block` is the structured source for workout content and derived metrics.
- `Assignment` and `TrainingPlanAssignment` record source-copy lineage and prevent duplicates.
- `Activity` stores completion outcomes and the latest actual snapshot. Planned session data stores the latest coach baseline snapshot.
- `ShareLink` stores a token hash and one sanitized snapshot tied to either a `Session` or `Template`; the raw token is never persisted.

## Safe Extension Rules

1. Keep all week calculations Monday-based.
2. Find and extend the existing owning service before adding Prisma logic to a route or page.
3. Keep Workouts unscheduled. Date and week assignment belongs to Planner or `assignment-service`.
4. Use the canonical session editor and shared block components for new workout authoring.
5. Keep completed sessions immutable through planner paths. Completion/reopen behavior belongs to `athlete-completion-service`.
6. Keep source-copy behavior in `assignment-service`; copied sessions are independent snapshots.
7. Keep baseline and actual payloads behind `session-snapshot-service`; do not derive history from mutable current blocks.
8. Keep public sharing sanitized and explicit. Never include Activity, actual/baseline JSON, private notes, RPE, ownership, or relationship data.
9. Treat `lib/planner-service.ts` and `/api/coach/sessions/[sessionId]` as compatibility code, not a new extension point.

## Known Gaps

- Browser acceptance for public sharing and some session mutation flows still needs a fresh pass.
- Auth.js external OAuth integration is optional and not covered by local credentials tests.
- The authentication proxy runs in Node.js so roleless JWT refreshes can query Prisma. Its redirects are secondary to the service/API authorization checks.

## Calendar scheduling

`lib/calendar-navigation.ts` owns validated local calendar-day URL navigation.
`AthleteCalendar` renders week/month views and submits drag or explicit-date
moves to `/api/athlete/planner/sessions/[sessionId]/schedule`.
`athletePlannerService.rescheduleSession` atomically checks athlete ownership,
completion, and coach assignment, preserves local time/content, and updates the
Monday-based plan. Calendar content and summaries refresh from server data.
