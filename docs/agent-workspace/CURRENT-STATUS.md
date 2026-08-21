# Current Status

This is the verified baseline recorded on **2026-08-21**. It was inspected on
branch `main` at commit `57f9d453b44de7cd5216e7e2fb86dbec14738110` (`commit a
lot of unstaged things?`, dated 2026-08-13). The worktree was clean before
this documentation change.

## Verification

| Gate | Result | Evidence |
|---|---|---|
| Tests | Pass: 99 tests | `pnpm test` |
| Lint | Pass | `pnpm lint` |
| Production build | Pass | `pnpm build` |
| Build warning | Present | Next.js reports the `middleware` convention is deprecated in favor of `proxy`; this is not currently a build failure. |

## Product Snapshot

Workout Planner is a Tempo-aligned coach-athlete training planner. Coaches
manage rosters, reusable templates, standalone library sessions, reusable
weekday training plans, and athlete assignments. Athletes discover or connect
to a coach, view Home/Calendar/Session/Live/Activity surfaces, and mark
sessions complete with notes. Weeks are Monday-based.

## Capability Status

| Capability | Status | Primary implementation | Verification / gap |
|---|---|---|---|
| Auth, signup, setup, role redirects | `shipped` | `auth.ts`, `middleware.ts`, `lib/auth-principal.ts`, `lib/auth-role-service.ts`, `lib/auth-session.ts`, `lib/api-auth.ts` | Focused role/principal tests and adapter smoke test pass; external OAuth integration remains a gap. |
| Responsive Tempo app shell and navigation | `shipped` | `components/AppShell.tsx`, `AppSidebar.tsx`, `lib/app-navigation.ts`, `app/globals.css` | Shell, accessibility, centering, and navigation tests pass. |
| Coach roster and athlete detail | `shipped` | `lib/coach-service.ts`, `/coach`, `/coach/athletes/[athleteId]` | `tests/coach-service.test.ts` and route tests pass. |
| Athlete coach discovery and request lifecycle | `shipped` | `lib/coach-request-service.ts`, `prisma/schema.prisma`, `lib/athlete-service.ts`, discovery/profile routes | Request invariants, UI errors/in-flight state, 99 tests, schema reset/seed, lint, and build pass; UX polish remains planned. |
| Coach planner for athlete schedules | `shipped` | `lib/coach-planner-service.ts`, `lib/planner-draft.ts`, `/coach/planner` | Planner, draft, API, and compatibility tests pass. |
| Coach-owned session library | `shipped` | `lib/coach-session-library-service.ts`, planner library API/UI | Dedicated service tests pass. |
| Reusable coach training plans | `shipped` | `lib/coach-training-plan-service.ts`, training-plan APIs/UI | Dedicated service and planner tests pass. |
| Coach template library and assignment | `transitional` | `lib/template-service.ts`, `lib/assignment-service.ts`, template APIs/UI | List/duplicate/delete and service/API behavior exist, but live create/edit UI and active assignment workflow are incomplete. |
| Athlete Home, Calendar, Session, Live, Activity | `shipped` | `lib/athlete-service.ts`, athlete route tree, Tempo components | Calendar, shell, source, and build coverage pass; live execution is a UI stepper, not device telemetry. |
| Interactive athlete Live execution | `planned` | `lib/athlete-execution.ts` to be created, Live client, `Stepper` | Current route is static: block one is always active and no block can be advanced. |
| Session completion and activity persistence | `shipped` | `app/api/athlete/sessions/[sessionId]/completion/route.ts`, `Activity` model | Completion behavior is covered indirectly; route still owns direct Prisma persistence and deserves a focused service/test seam. |
| Completion metric/history integrity | `planned` | New completion module and lifecycle policy | Manual completion fabricates 100% compliance and mutable plan edits can change Activity history. |
| Structured workout blocks and derived metrics | `shipped` | `lib/tempo-blocks.ts`, `lib/session-math.ts`, `lib/planner-draft.ts` | Session-math and planner tests pass. |
| Compatibility planner mutation path | `transitional` | `/api/coach/sessions/[sessionId]`, `lib/planner-service.ts`, `lib/planner.ts` | Required by current tests and route; do not extend for new features without an explicit migration decision. |
| Reusable source-copy assignment | `planned` | Unified assignment module and source lineage | Templates are partially assignable; library sessions and training plans cannot be copied to athletes. |
| Live planner/template workflows | `planned` | Source-copy assignment command | Template create/edit UI is absent and the old builder UI is unreachable. |
| Auth.js adapter and role setup hardening | `shipped` | `prisma/schema.prisma`, `lib/auth-principal.ts`, `lib/auth-role-service.ts`, `auth.ts`, setup route | `AUTH-002`; focused principal/role tests, Prisma validation, adapter smoke test, and full gates pass. External OAuth integration remains a gap. |
| Coach-request lifecycle hardening | `shipped` | `lib/coach-request-service.ts`, `prisma/schema.prisma`, request UI | `REQUEST-002`; pending uniqueness, eligibility, atomic acceptance cleanup, UI errors, and full gates pass. |
| API auth/input hardening | `shipped` | `lib/api-auth.ts`, `lib/route-params.ts`, protected API handlers | `API-001`; 92 tests, lint, build, and route inventory checks pass. Full session-backed route integration remains a gap. |

See `WORK-INDEX.md` for stable IDs and `features/` for detailed records.

## Runtime Shape

### Request and rendering flow

- Next.js 16 App Router renders route pages under `app/`.
- `app/(app)/layout.tsx` gets the authenticated user, redirects users without
  a valid role to setup, and computes whether an athlete has an active coach.
- `components/AppShell.tsx` and `AppSidebar.tsx` provide desktop sidebar and
  mobile bottom navigation.
- Server pages read through `lib/*-service.ts` modules. Client components own
  local draft state and call API routes for mutations.
- Route handlers use `lib/api-auth.ts` for role guards. The signup, setup,
  and completion routes are current exceptions that still call Prisma
  directly for their behavior.
- `lib/route-params.ts` owns strict positive-integer and JSON-object transport
  parsing for API adapters.

### Active coach planning flow

`/coach/planner` -> `coachPlannerService.loadWorkspace` -> roster, templates,
coach-owned sessions, training plans, and Monday-first athlete sessions.
Planner UI drafts use `lib/planner-draft.ts`; save/delete APIs delegate to
`coach-planner-service`, `coach-session-library-service`, and
`coach-training-plan-service`. Structured blocks are persisted as `Block`
rows, and display duration/TSS/zone segments are derived by
`lib/session-math.ts`.

### Compatibility coach-session flow

`/api/coach/sessions/[sessionId]` first checks roster ownership through
`coachService`, then delegates save/delete to `plannerService`. That service
normalizes the older `planner.ts` draft shape and maps old block types into
Tempo blocks. It is live compatibility code, not the preferred extension
point for new planner behavior.

## Data Model

`prisma/schema.prisma` is authoritative. The main relationships are:

- `User` stores identity, role, optional `coachId`, self-coached state, and JSON preferences.
- `Account` stores Auth.js provider links.
- `CoachRequest` stores athlete-to-coach requests with a unique athlete/coach pair.
- `Plan` stores an athlete training window and optional goal race.
- `Session` stores athlete assignments or coach-owned library/training-plan sessions.
- `Block` is the structured workout source for duration, TSS, zone distribution, targets, and notes.
- `Template` is private to a coach and can be copied into athlete sessions.
- `Activity` stores completion outcomes, compliance, notes, and derived zone totals.
- `Assignment` records coach scheduling actions and prevents duplicate session/athlete rows.
- `TrainingPlan` owns reusable coach sessions placed on weekdays 1 through 7.

SQLite stores domain enums as constrained strings. Current values include
`COACH`/`ATHLETE`, `RUNNING`/`BIKING`/`SWIMMING`/`STRENGTH`/`STRETCHING`/`REST`,
`planned`/`completed`/`missed`, block kinds `warmup`/`work`/`recovery`/`cooldown`,
and target types `power`/`pace`/`hr`.

## Known Gaps and Risks

- Service-level coverage is stronger for planner, templates, coach reads, and
  utilities than for Auth.js callbacks, signup/setup, API authorization, and
  completion persistence.
- Athlete onboarding and request-state UX works but still has polish work.
- The discovery UI explicitly says messaging is coming soon; messaging is not
  implemented.
- The live route is a block stepper and guidance surface; it does not record
  sensor/device execution or live telemetry.
- The older workout draft helpers and components remain in the repository
  alongside the active Tempo draft path. Remove or migrate them only after
  reference analysis and a decision record.
- Next.js warns that `middleware.ts` is deprecated in favor of `proxy.ts`.
- `pnpm db:push` resets local SQLite data according to repository guidance;
  use it deliberately and reseed afterward when schema work is involved.

## Current Priorities

1. Implement the planned Live and completion tasks so execution state, metric
   provenance, notes, and mutable-session history have explicit semantics.
2. Implement source-copy assignment, then expose it through the planner and
   template UI without duplicating assignment logic.
3. Make coach-request lifecycle invariants database-safe, then deepen full
   session-backed API route coverage.
4. Harden the compatibility adapter and align architecture/handoff docs before
   removing any old planner code.
