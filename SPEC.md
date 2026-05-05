# Workout Planner App Spec

## Overview

This app is a workout planning tool for personal trainers, coaches, and self-directed athletes who want a better way to structure training plans than advanced spreadsheets. The product should make it easy to create, review, and follow a weekly training plan containing sessions like running, biking, swimming, strength training, stretching, and rest.

The app has two primary user roles:

- Coach: creates and manages training plans for multiple athletes.
- Athlete: receives a training plan, views upcoming sessions, marks sessions done, and adds notes or adjustments after completion.

The first version should be visually easy to use and navigate for both the planner and the receiver of the plan.

## Product Goals

- Replace spreadsheet-based training planning with a purpose-built interface.
- Make week planning fast and clear for coaches.
- Make daily training instructions easy to read for athletes.
- Support both desktop and mobile well from the start.
- Keep the first version small enough to build quickly without introducing heavy collaboration or recurrence complexity.

## Core Product Decisions

### MVP Scope

- The first usable version targets multi-athlete coaching.
- One coach manages many athletes.
- This is not a self-coached-only app in the first version.

### Roles and Permissions

- Coach edits plans.
- Athlete views their plan.
- Athlete can mark a planned session as done.
- Athlete can add notes and possible adjustments made to the session after it is completed.
- Coach and athlete do not both freely edit the same session content in the MVP.
- Team or multi-coach collaboration is out of scope for the MVP.

### Planning Structure

- Plans are structured around sessions on calendar days.
- The first version is week-planner only.
- Month planning is out of scope for the first version.
- Each week can also have a weekly note from the coach.

### Session Structure

- In overview, a session appears as a simple session card.
- In details, a session supports structured workout blocks.
- Session details may include warmup, main set, cooldown, intervals, reps, rest, or notes.

### Activity Types

The fixed sport list for V1 is:

- Running
- Biking
- Swimming
- Strength
- Stretching
- Rest

No custom activity types in the first version.

### Landing Experiences

- Coach lands on a coach dashboard.
- Athlete lands on a week calendar view.
- The two roles should have separate primary starting experiences.

### Coach Dashboard Priority

The coach dashboard should prioritize:

- Athlete list
- Upcoming week status

This makes the coach dashboard a planning hub rather than a template hub or analytics-first surface.

### Device Strategy

- The app should support desktop and mobile equally well from the start.
- The UI should not assume coach desktop only or athlete mobile only.

### Planner Interaction

- Coaches should place sessions using tap and click interactions first.
- Drag and drop is not required in the first version.
- This choice improves cross-device usability and reduces implementation complexity.

### Athlete Context

- Athlete week view should show a weekly note plus sessions.
- The weekly note gives context for the plan without adding major product complexity.

### Completion Tracking

- Athlete can mark a session done.
- Athlete can add notes.
- Full performed metrics, detailed execution logging, and detailed plan-versus-actual block tracking are out of scope for V1.

### Authentication Strategy

- Start with seeded demo accounts.
- The first development phase should use Prisma-backed seeded users and a simple role-based demo login or role switch.
- Full production-grade auth is intentionally deferred.

### Template and Reuse Strategy

- Coaches can create sessions from scratch.
- Coaches can create sessions from templates.
- Templates are coach-owned private templates.
- Repeated patterns work through manual copy week-to-week.
- Full recurring sessions are out of scope for V1.

### Planner Layout Pattern

The chosen planning UI is:

- Hybrid: week strip plus selected day detail.

This fits the equal mobile/desktop requirement better than a dense full-week grid.

### Session Detail Pattern

- Session details should open in a slide-over panel.
- On desktop this behaves like a side panel.
- On mobile this should behave like a full-screen or near-full-screen sheet.

## UX Summary

### Coach Experience

The coach needs to:

- Open a dashboard showing athletes and week status.
- Open a specific athlete planner.
- Move week by week.
- Select a day.
- Add a session from scratch.
- Add a session from a template.
- Edit a session.
- Edit detailed workout blocks.
- Add or update the weekly note.
- Copy a previous week manually when useful.

### Athlete Experience

The athlete needs to:

- Open their weekly plan.
- Read the weekly note.
- Open a session.
- Read workout details.
- Mark a session done.
- Add notes or adjustments.

## Visual/Product Direction

- The app should feel purpose-built for structured weekly planning, not like a generic CRUD admin panel.
- The plan should be easy to scan at both the week and day level.
- Session cards should feel lightweight in overview.
- Session details should be structured and readable.
- The athlete-facing experience should prioritize clarity over planner density.
- The coach-facing experience should prioritize planning speed without becoming cluttered.

## Technical Baseline

The app should use the same baseline technology choices and project style as the sibling repo `../backyard-ultra-nextjs`.

### Reference Stack From `backyard-ultra-nextjs`

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS v4
- Prisma
- SQLite for local development
- date-fns
- lucide-react

### Reference Project Conventions Observed

- App Router under `app/`
- Route handlers under `app/api/`
- TypeScript with `@/*` import alias
- Tailwind via `@tailwindcss/postcss`
- Prisma client generation during build
- Simple direct server/client split without adding extra state libraries initially

### Technical Recommendation For This App

- Follow the same dependency set and app structure as the reference repo unless there is a strong product-specific reason to diverge.
- Use Prisma with SQLite first for local development.
- Keep architecture lightweight in the first version.
- Prefer server-rendered data loading where it fits naturally with App Router.
- Introduce client components where interaction is needed.
- Because the local datasource is SQLite, enum-like domain values should be implemented as constrained string fields in Prisma for the first version.

### Package Manager

- `pnpm` should be the standard package manager for this project.
- Use `pnpm` for dependency installation, script execution, and lockfile management.
- The intended lockfile for the project is `pnpm-lock.yaml`.

### Current Architecture Direction

- Week-scoped planner behavior now belongs behind `lib/planner-service.ts`.
- Coach template behavior now belongs behind `lib/template-service.ts`.
- Demo role/session lookup now belongs behind `lib/demo-session.ts`.
- Shared workout block behavior belongs in `lib/workout-spec.ts`.
- Shared workout content draft behavior belongs in `lib/workout-editor.ts`.
- Shared coach editor shell belongs in `components/CoachEditorDrawer.tsx`.
- Shared block editing UI belongs in `components/WorkoutBlocksEditor.tsx`.

This structure should be preserved and deepened as the product grows rather than reintroducing route-level business logic or duplicated form behavior.

## Information Architecture

Recommended initial route structure:

- `/`
- `/coach`
- `/coach/athletes/[athleteId]`
- `/coach/templates`
- `/athlete`

Possible future route if deep-linking becomes necessary:

- `/athlete/session/[sessionId]`

For the MVP, session detail should preferably remain in slide-over state rather than forcing a route change.

## Initial Feature Breakdown

### Feature 1: Seeded Role Entry

- Local demo entry into coach or athlete experience.
- Backed by seeded demo users.
- Enough to simulate role-based app behavior without full auth infrastructure.

### Feature 2: Coach Dashboard

- Athlete list
- Current or upcoming week planning status
- Quick entry into an athlete planner

### Feature 3: Coach Athlete Planner

- Week switcher
- Compact week strip
- Selected day detail view
- Session cards for the selected day
- Add session flow
- Add from template flow
- Session edit slide-over
- Weekly note editing
- Manual copy from another week or previous week

### Feature 4: Athlete Week View

- Weekly note
- Week navigation
- Day-grouped sessions
- Session detail slide-over
- Completion and notes flow

### Feature 5: Template Library

- Coach-owned private templates
- Create, list, edit, and apply templates
- Templates can contain blocks

## Data Model Recommendation

The first schema should include:

- `User`
- `AthleteProfile`
- `PlanWeek`
- `PlannedSession`
- `SessionBlock`
- `SessionTemplate`
- `SessionTemplateBlock`
- `SessionCompletion`

### Recommended Domain Rules

- A user has a role of coach or athlete.
- An athlete profile belongs to one athlete user and one coach user.
- A plan week belongs to one athlete.
- A plan week is unique per athlete and week start date.
- A planned session belongs to one plan week.
- A planned session can optionally reference the template it was created from.
- A planned session can have many blocks.
- A template belongs to one coach.
- A template can have many blocks.
- A session can have at most one completion record in the MVP.

### Recommended Prisma Schema Draft

```prisma
model User {
  id        Int       @id @default(autoincrement())
  email     String    @unique
  name      String
  role      UserRole
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt

  coachedAthletes AthleteProfile[] @relation("CoachAthletes")
  athleteProfile  AthleteProfile?
  templates       SessionTemplate[]
  completions     SessionCompletion[]
}

model AthleteProfile {
  id        Int      @id @default(autoincrement())
  userId    Int      @unique
  coachId   Int
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  coach     User     @relation("CoachAthletes", fields: [coachId], references: [id], onDelete: Cascade)
  planWeeks PlanWeek[]
}

model PlanWeek {
  id         Int       @id @default(autoincrement())
  athleteId  Int
  weekStart  DateTime
  weeklyNote String?
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  athlete    AthleteProfile   @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  sessions   PlannedSession[]

  @@unique([athleteId, weekStart])
}

model PlannedSession {
  id               Int              @id @default(autoincrement())
  planWeekId       Int
  scheduledDate    DateTime
  sportType        SportType
  title            String
  summary          String?
  durationMinutes  Int?
  distanceKm       Float?
  intensity        String?
  sortOrder        Int              @default(0)
  sourceTemplateId Int?
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt

  planWeek         PlanWeek         @relation(fields: [planWeekId], references: [id], onDelete: Cascade)
  sourceTemplate   SessionTemplate? @relation(fields: [sourceTemplateId], references: [id], onDelete: SetNull)
  blocks           SessionBlock[]
  completion       SessionCompletion?
}

model SessionBlock {
  id           Int            @id @default(autoincrement())
  sessionId     Int
  blockType     BlockType
  title         String
  instructions  String?
  sortOrder     Int            @default(0)

  session       PlannedSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
}

model SessionTemplate {
  id         Int                    @id @default(autoincrement())
  coachId    Int
  sportType  SportType
  name       String
  summary    String?
  createdAt  DateTime               @default(now())
  updatedAt  DateTime               @updatedAt

  coach      User                   @relation(fields: [coachId], references: [id], onDelete: Cascade)
  sessions   PlannedSession[]
  blocks     SessionTemplateBlock[]
}

model SessionTemplateBlock {
  id           Int             @id @default(autoincrement())
  templateId    Int
  blockType     BlockType
  title         String
  instructions  String?
  sortOrder     Int             @default(0)

  template      SessionTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
}

model SessionCompletion {
  id           Int            @id @default(autoincrement())
  sessionId     Int            @unique
  athleteId     Int
  isDone        Boolean        @default(false)
  completedAt   DateTime?
  notes         String?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt

  session       PlannedSession @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  athlete       User           @relation(fields: [athleteId], references: [id], onDelete: Cascade)
}

enum UserRole {
  COACH
  ATHLETE
}

enum SportType {
  RUNNING
  BIKING
  SWIMMING
  STRENGTH
  STRETCHING
  REST
}

enum BlockType {
  WARMUP
  MAIN_SET
  COOLDOWN
  INTERVALS
  REPS
  REST
  NOTE
}
```

## API Areas

Recommended initial API groupings:

- `/api/athletes`
- `/api/plan-weeks`
- `/api/sessions`
- `/api/templates`
- `/api/completions`

These should follow the direct route-handler style used in the reference project.

## Seed Data Recommendation

Seed enough data to make the first UI meaningful:

- One coach user
- Two athlete users
- Athlete profiles for each athlete
- One current week plan per athlete
- Sessions across multiple days
- At least one session completion example
- A small template library owned by the coach

## Build Order Recommendation

Recommended implementation order:

1. Scaffold project with the same baseline stack and structure as `backyard-ultra-nextjs`.
2. Add Prisma schema.
3. Add seed script and local SQLite database setup.
4. Implement simple seeded role entry.
5. Build coach dashboard.
6. Build coach athlete planner.
7. Build athlete week view.
8. Build templates UI.
9. Add completion and notes flow.
10. Run verification commands and fix issues.

## Non-Goals For V1

- Full production authentication
- Multi-coach collaboration
- Shared workspace/business account model
- Full recurrence rules
- Month planner editing
- Deep analytics or performance charts
- Detailed execution metrics beyond done plus notes
- Custom sport definitions

## Immediate Next Steps

The next implementation steps should be:

1. Scaffold the project to match the reference stack and conventions.
2. Add the Prisma schema and seed data.
3. Create the first coach and athlete pages using seeded demo role entry.
