# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start dev server
pnpm build        # Run prisma generate + next build
pnpm lint         # Run ESLint
pnpm db:push      # Push schema changes to SQLite (resets data)
pnpm db:seed      # Seed demo users, athletes, and sessions
```

Use `pnpm` — not npm or yarn. The lockfile is `pnpm-lock.yaml`.

After changing the Prisma schema, run `pnpm db:push` then `pnpm db:seed` to rebuild the local database.

## Agent Work Tracking

Before starting a non-trivial task, read `docs/agent-workspace/README.md`,
`docs/agent-workspace/CURRENT-STATUS.md`, `docs/agent-workspace/WORK-INDEX.md`,
and the related feature record. Update the workspace after meaningful progress
and before finishing: record the changed behavior, files, verification, date,
and follow-up work. Use `docs/agent-workspace/tasks/TEMPLATE.md` for work that
needs an active task record.

## Architecture

**Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Prisma + SQLite, date-fns, lucide-react.

**Import alias:** `@/*` maps to the project root.

**Domain-level string enums:** Because the datasource is SQLite, domain values are stored as constrained strings rather than Prisma enums. Current core values are `COACH`/`ATHLETE`, `RUNNING`/`BIKING`/`SWIMMING`/`STRENGTH`/`STRETCHING`/`REST`, session statuses such as `planned`/`completed`/`missed`, block kinds `warmup`/`work`/`recovery`/`cooldown`, and target types `power`/`pace`/`hr`.

### Service boundaries

All feature logic belongs behind these `lib/` modules. Do not reintroduce Prisma calls directly into route handlers for behavior that belongs here.

| Module | Owns |
|---|---|
| `lib/planner-service.ts` | Compatibility coach-session mutations used by the remaining week-based API |
| `lib/coach-service.ts` | Coach roster and athlete-detail read models |
| `lib/athlete-service.ts` | Athlete Home, Calendar, Session, Activity, discovery, and profile reads |
| `lib/assignment-service.ts` | Coach builder assignment creation and template-to-session scheduling |
| `lib/workout-spec.ts` | Block draft normalization, validation, and persistence transforms |
| `lib/workout-editor.ts` | Shared workout content draft shaping used by both session editing and template editing |
| `lib/template-service.ts` | Coach template list/create/update/delete |
| `lib/auth-session.ts` | Current-user lookup for server-rendered UI (`getCurrentUser`) |
| `lib/api-auth.ts` | Role-based route guards for API handlers (`requireCoach`, `requireAthlete`) |
| `lib/session-snapshot-service.ts` | Canonical latest coach-baseline and actual snapshot serialization, validation, replacement, and comparison projection |

### Shared UI components

- `components/WorkoutBlocksEditor.tsx` — block editing UI used by both session and template editors
- `components/CoachEditorDrawer.tsx` — coach-side editor drawer shell
- `components/ui.tsx` — shared primitives (`PageShell`, `TopBar`, `Surface`, `ActionLink`, etc.)
- `components/tempo/*` — Tempo-specific primitives such as `SessionBlockBar`, `StatusBadge`, `MetricText`, and navigation/form controls

### Route structure

```
/                              Landing / demo role entry
/coach                         Coach roster
/coach/athletes/[athleteId]    Athlete detail
/coach/builder                 Coach builder + assignment
/coach/templates               Coach template library
/athlete                       Athlete Home
/athlete/calendar              Athlete Calendar
/athlete/session/[sessionId]   Athlete session detail
/athlete/live/[sessionId]      Athlete live execution
/athlete/activity              Athlete activity history
/settings                      Shared settings / overview preferences
```

Route handlers live under `app/api/` and call into the service layer. Client components are colocated with their route (`BuilderClient.tsx`, `CoachTemplatesClient.tsx`, `SessionDetailClient.tsx`).

### Auth

Auth is implemented with Auth.js v5. Server components read the signed-in user through `lib/auth-session.ts`, and route handlers enforce role access through `lib/api-auth.ts`. Seed data still provides convenient local accounts, but the app now uses real login, signup, setup, and session middleware flows.

### UI conventions

- **Cursor:** `button`, `a`, and `[role="button"]` get `cursor: pointer` via `@layer base` in `app/globals.css`. If a specific interactive element still shows the wrong cursor (e.g. due to Tailwind preflight specificity), add `cursor-pointer` explicitly as a class on that element.

### Week boundary convention

Weeks start on Monday (`weekStartsOn: 1` everywhere). `planner-service` normalizes all incoming `weekStart` values to Monday midnight using `startOfWeek(..., { weekStartsOn: 1 })`.
