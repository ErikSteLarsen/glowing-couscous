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

## Architecture

**Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS v4, Prisma + SQLite, date-fns, lucide-react.

**Import alias:** `@/*` maps to the project root.

**Domain-level string enums:** Because the datasource is SQLite, domain values like `role`, `sportType`, and `blockType` are stored as constrained strings rather than Prisma enums. Valid values are `COACH`/`ATHLETE`, `RUNNING`/`BIKING`/`SWIMMING`/`STRENGTH`/`STRETCHING`/`REST`, and `WARMUP`/`MAIN_SET`/`COOLDOWN`/`INTERVALS`/`REPS`/`REST`/`NOTE`.

### Service boundaries

All feature logic belongs behind these `lib/` modules. Do not reintroduce Prisma calls directly into route handlers for behavior that belongs here.

| Module | Owns |
|---|---|
| `lib/planner-service.ts` | Week-scoped planner loading and all planner mutations (sessions, weekly note, copy-previous-week, completion) |
| `lib/workout-spec.ts` | Block draft normalization, validation, and persistence transforms |
| `lib/workout-editor.ts` | Shared workout content draft shaping used by both session editing and template editing |
| `lib/template-service.ts` | Coach template list/create/update/delete |
| `lib/demo-session.ts` | Demo-user lookup (`getCurrentCoach`, `getCurrentAthleteUser`). Replace this module when adding real auth — keep the same boundary shape |

### Shared UI components

- `components/WorkoutBlocksEditor.tsx` — block editing UI used by both session and template editors
- `components/CoachEditorDrawer.tsx` — coach-side editor drawer shell
- `components/ui.tsx` — shared primitives (`PageShell`, `TopBar`, `Surface`, `ActionLink`, etc.)

### Route structure

```
/                              Landing / demo role entry
/coach                         Coach dashboard (athlete list + week status)
/coach/athletes/[athleteId]    Athlete planner (week strip + day detail)
/coach/templates               Coach template library
/athlete                       Athlete week view
```

Route handlers live under `app/api/` and call into the service layer. Client components are colocated with their route (`CoachPlannerClient.tsx`, `CoachTemplatesClient.tsx`).

### Auth

Currently demo-only: `lib/demo-session.ts` returns the first seeded COACH or ATHLETE user. There is no session management. Seed data is the source of truth for users.

### UI conventions

- **Cursor:** `button`, `a`, and `[role="button"]` get `cursor: pointer` via `@layer base` in `app/globals.css`. If a specific interactive element still shows the wrong cursor (e.g. due to Tailwind preflight specificity), add `cursor-pointer` explicitly as a class on that element.

### Week boundary convention

Weeks start on Monday (`weekStartsOn: 1` everywhere). `planner-service` normalizes all incoming `weekStart` values to Monday midnight using `startOfWeek(..., { weekStartsOn: 1 })`.
