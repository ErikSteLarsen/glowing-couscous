# Project Architecture Improvement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the remaining athlete/onboarding Prisma business logic behind focused services, standardize service construction patterns, and add a repo-local architecture skill that teaches future contributors how to preserve those boundaries.

**Architecture:** Keep the existing service-oriented `lib/` structure and finish the refactor instead of adding a deeper repository layer. Add one athlete read service, one coach-request service, factory-style construction for smaller services, then encode the project rules in a `.copilot/skills` package and refresh the architecture docs.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma + SQLite, Auth.js v5, pnpm.

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `lib/athlete-service.ts` | Own athlete profile lookup and athlete-facing week/profile reads. |
| Create | `lib/coach-request-service.ts` | Own coach search plus athlete/coach request list and decision flows. |
| Modify | `lib/coach-service.ts` | Convert to factory + singleton export pattern. |
| Modify | `lib/template-service.ts` | Convert to factory + singleton export pattern. |
| Modify | `app/athlete/page.tsx` | Delegate athlete profile lookup to `athleteService`. |
| Modify | `app/athlete/profile/page.tsx` | Delegate profile/request state reads to `athleteService`. |
| Modify | `app/api/coaches/route.ts` | Delegate coach search to `coachRequestService`. |
| Modify | `app/api/athlete/coach-requests/route.ts` | Delegate athlete request list/create actions to `coachRequestService`. |
| Modify | `app/api/coach/requests/route.ts` | Delegate pending request list to `coachRequestService`. |
| Modify | `app/api/coach/requests/[requestId]/route.ts` | Delegate accept/reject flow to `coachRequestService`. |
| Create | `.copilot/skills/project-architecture/SKILL.md` | Main project architecture skill instructions. |
| Create | `.copilot/skills/project-architecture/REFERENCE.md` | Detailed boundary map, ownership rules, and extension checklist. |
| Modify | `ARCHITECTURE.md` | Add athlete and coach-request service boundaries plus skill mention. |
| Modify | `docs/AI-HANDOFF.md` | Update the fast-start map so new agents see the new service owners and skill. |

> **Testing note:** This repo does not currently ship a dedicated automated test runner. Do not introduce one in this refactor. Use `pnpm lint` and `pnpm build` as the required validation gates.

### Task 1: Add the athlete read service

**Files:**
- Create: `lib/athlete-service.ts`
- Modify: `app/athlete/page.tsx`
- Modify: `app/athlete/profile/page.tsx`

- [ ] **Step 1: Create the service factory and singleton**

```ts
import { prisma } from '@/lib/prisma';
import { plannerService } from '@/lib/planner-service';

type AthleteServiceDeps = {
  db?: typeof prisma;
  planner?: typeof plannerService;
};

export function createAthleteService({ db = prisma, planner = plannerService }: AthleteServiceDeps = {}) {
  return {
    async findProfileByUserId(userId: number) {
      return db.athleteProfile.findUnique({ where: { userId } });
    },

    async loadWeekByUserId(userId: number, weekStart: Date | string | undefined) {
      const profile = await db.athleteProfile.findUnique({ where: { userId } });
      if (!profile) return null;

      const snapshot = await planner.forWeek({ athleteId: profile.id, weekStart: weekStart ?? new Date() }).load();
      return { profile, snapshot };
    },

    async loadProfileState(userId: number) {
      const profile = await db.athleteProfile.findUnique({ where: { userId } });
      if (profile) return { profile, latestRequest: null };

      const latestRequest = await db.coachRequest.findFirst({
        where: { athleteId: userId, status: { in: ['PENDING', 'REJECTED'] } },
        include: { coach: { select: { name: true } } },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      });

      return { profile: null, latestRequest };
    },
  };
}

export const athleteService = createAthleteService();
```

- [ ] **Step 2: Move athlete profile lookup out of `app/athlete/page.tsx`**

```ts
import { athleteService } from '@/lib/athlete-service';

const athleteContext = await athleteService.loadWeekByUserId(user.id, weekStartParam ?? fallbackWeekStart);
if (!athleteContext) redirect('/athlete/profile');

const plannerSnapshot = athleteContext.snapshot;
```

- [ ] **Step 3: Move athlete profile/request reads out of `app/athlete/profile/page.tsx`**

```ts
import { athleteService } from '@/lib/athlete-service';

const profileState = await athleteService.loadProfileState(user.id);
if (profileState.profile) redirect('/athlete');

const latestRequest = profileState.latestRequest;
```

- [ ] **Step 4: Run the lint checkpoint for the touched files**

Run: `pnpm lint -- app/athlete/page.tsx app/athlete/profile/page.tsx lib/athlete-service.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/athlete-service.ts app/athlete/page.tsx app/athlete/profile/page.tsx
git commit -m "refactor: add athlete read service"
```

### Task 2: Add the coach-request service

**Files:**
- Create: `lib/coach-request-service.ts`
- Modify: `app/api/coaches/route.ts`
- Modify: `app/api/athlete/coach-requests/route.ts`
- Modify: `app/api/coach/requests/route.ts`
- Modify: `app/api/coach/requests/[requestId]/route.ts`

- [ ] **Step 1: Create the request service factory and singleton**

```ts
import { prisma } from '@/lib/prisma';

type CoachRequestServiceDeps = {
  db?: typeof prisma;
};

type RequestDecision = 'accept' | 'reject';

export function createCoachRequestService({ db = prisma }: CoachRequestServiceDeps = {}) {
  return {
    async searchCoaches(query: string) {
      const q = query.trim();
      if (!q) return [];

      return db.user.findMany({
        where: {
          role: 'COACH',
          OR: [{ name: { contains: q } }, { email: { contains: q } }],
        },
        select: { id: true, name: true, email: true },
        take: 10,
      });
    },

    async listForAthlete(athleteUserId: number) {
      return db.coachRequest.findMany({
        where: { athleteId: athleteUserId },
        include: { coach: { select: { id: true, name: true, email: true } } },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      });
    },

    async createForAthlete(athleteUserId: number, coachId: number) {
      const coach = await db.user.findUnique({ where: { id: coachId, role: 'COACH' } });
      if (!coach) return { ok: false as const, status: 404, error: 'Coach not found' };

      try {
        await db.coachRequest.create({ data: { athleteId: athleteUserId, coachId, status: 'PENDING' } });
        return { ok: true as const };
      } catch (error: unknown) {
        if ((error as { code?: string }).code === 'P2002') {
          return { ok: false as const, status: 409, error: 'Request already sent' };
        }
        throw error;
      }
    },

    async listPendingForCoach(coachUserId: number) {
      return db.coachRequest.findMany({
        where: { coachId: coachUserId, status: 'PENDING' },
        include: { athlete: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'asc' },
      });
    },

    async decideForCoach(coachUserId: number, requestId: number, action: RequestDecision) {
      const request = await db.coachRequest.findUnique({ where: { id: requestId } });
      if (!request || request.coachId !== coachUserId) {
        return { ok: false as const, status: 404, error: 'Not found' };
      }

      if (action === 'accept') {
        try {
          await db.$transaction([
            db.coachRequest.update({ where: { id: request.id }, data: { status: 'ACCEPTED' } }),
            db.athleteProfile.create({ data: { userId: request.athleteId, coachId: coachUserId } }),
          ]);
          return { ok: true as const };
        } catch (error: unknown) {
          if ((error as { code?: string }).code === 'P2002') {
            return { ok: false as const, status: 409, error: 'Athlete already has a coach' };
          }
          throw error;
        }
      }

      await db.coachRequest.update({ where: { id: request.id }, data: { status: 'REJECTED' } });
      return { ok: true as const };
    },
  };
}

export const coachRequestService = createCoachRequestService();
```

- [ ] **Step 2: Replace the coach search route body**

```ts
import { coachRequestService } from '@/lib/coach-request-service';

const q = req.nextUrl.searchParams.get('q') ?? '';
const coaches = await coachRequestService.searchCoaches(q);
return NextResponse.json({ coaches });
```

- [ ] **Step 3: Replace the athlete request route body**

```ts
const requests = await coachRequestService.listForAthlete(user.id);

const result = await coachRequestService.createForAthlete(user.id, coachId);
if (!result.ok) {
  return NextResponse.json({ error: result.error }, { status: result.status });
}
```

- [ ] **Step 4: Replace the coach pending-list and decision route bodies**

```ts
const requests = await coachRequestService.listPendingForCoach(user.id);
return NextResponse.json({ requests });
```

```ts
const result = await coachRequestService.decideForCoach(user.id, Number(requestId), action);
if (!result.ok) {
  return NextResponse.json({ error: result.error }, { status: result.status });
}
```

- [ ] **Step 5: Run the lint checkpoint for the request flow**

Run: `pnpm lint -- app/api/coaches/route.ts app/api/athlete/coach-requests/route.ts app/api/coach/requests/route.ts app/api/coach/requests/[requestId]/route.ts lib/coach-request-service.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/coach-request-service.ts app/api/coaches/route.ts app/api/athlete/coach-requests/route.ts app/api/coach/requests/route.ts app/api/coach/requests/[requestId]/route.ts
git commit -m "refactor: extract coach request service"
```

### Task 3: Standardize smaller service construction

**Files:**
- Modify: `lib/coach-service.ts`
- Modify: `lib/template-service.ts`

- [ ] **Step 1: Convert `lib/coach-service.ts` to a factory + singleton**

```ts
import { startOfWeek } from 'date-fns';
import { prisma } from '@/lib/prisma';

type CoachServiceDeps = {
  db?: typeof prisma;
  now?: () => Date;
};

export function createCoachService({ db = prisma, now = () => new Date() }: CoachServiceDeps = {}) {
  return {
    async getOverview(coachId: number) {
      const coach = await db.user.findUnique({
        where: { id: coachId },
        include: {
          coachedAthletes: {
            include: {
              user: true,
              planWeeks: {
                where: { weekStart: startOfWeek(now(), { weekStartsOn: 1 }) },
                include: { sessions: true },
              },
            },
          },
        },
      });

      if (coach) {
        coach.coachedAthletes.sort((left, right) => left.user.name.localeCompare(right.user.name));
      }

      return coach;
    },
  };
}

export const coachService = createCoachService();
```

- [ ] **Step 2: Convert `lib/template-service.ts` to a factory + singleton**

```ts
import { prisma } from '@/lib/prisma';
import { normalizeTemplateDraft, validateTemplateDraft } from '@/lib/planner';
import { serializeWorkoutBlocksForPersistence } from '@/lib/workout-spec';

type TemplateServiceDeps = {
  db?: typeof prisma;
};

export function createTemplateService({ db = prisma }: TemplateServiceDeps = {}) {
  return {
    async listForCoach(coachId: number) {
      return db.sessionTemplate.findMany({
        where: { coachId },
        include: {
          blocks: {
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: [{ sportType: 'asc' }, { name: 'asc' }],
      });
    },
    async saveForCoach(coachId: number, draftInput: unknown, templateId?: number) {
      const draft = normalizeTemplateDraft(draftInput);
      const validationError = validateTemplateDraft(draft);

      if (validationError) {
        return { error: validationError };
      }

      const templateData = {
        coachId,
        sportType: draft.sportType,
        name: draft.name,
        summary: draft.summary || null,
      };

      if (!templateId) {
        await db.sessionTemplate.create({
          data: {
            ...templateData,
            blocks: {
              create: serializeWorkoutBlocksForPersistence(draft.blocks),
            },
          },
        });

        return { error: null };
      }

      const existing = await db.sessionTemplate.findUnique({ where: { id: templateId } });
      if (!existing || existing.coachId !== coachId) {
        return { error: 'Template not found.' };
      }

      await db.$transaction([
        db.sessionTemplateBlock.deleteMany({ where: { templateId } }),
        db.sessionTemplate.update({
          where: { id: templateId },
          data: {
            sportType: draft.sportType,
            name: draft.name,
            summary: draft.summary || null,
            blocks: {
              create: serializeWorkoutBlocksForPersistence(draft.blocks),
            },
          },
        }),
      ]);

      return { error: null };
    },
    async deleteForCoach(coachId: number, templateId: number) {
      const template = await db.sessionTemplate.findUnique({ where: { id: templateId } });
      if (!template || template.coachId !== coachId) {
        return { error: 'Template not found.' };
      }

      await db.sessionTemplate.delete({ where: { id: templateId } });
      return { error: null };
    },
  };
}

export const templateService = createTemplateService();
```

- [ ] **Step 3: Run lint for the service modules**

Run: `pnpm lint -- lib/coach-service.ts lib/template-service.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add lib/coach-service.ts lib/template-service.ts
git commit -m "refactor: standardize service factories"
```

### Task 4: Add the repo-local architecture skill

**Files:**
- Create: `.copilot/skills/project-architecture/SKILL.md`
- Create: `.copilot/skills/project-architecture/REFERENCE.md`

- [ ] **Step 1: Write the skill frontmatter and quick-start workflow**

```md
---
name: project-architecture
description: Guides contributors through this repo's service-boundary architecture and safe extension workflow. Use when changing routes, pages, Prisma-backed behavior, or introducing new domain logic in the workout planner.
---

# Project Architecture

## Quick start

1. Read `docs/AI-HANDOFF.md`.
2. Read `ARCHITECTURE.md`.
3. Identify the owning `lib/` service before editing pages or route handlers.
4. Keep Prisma-backed business logic out of `app/` unless no service owner exists yet.
5. Update docs if boundaries move.
```

- [ ] **Step 2: Add the repo-specific workflows and smell checks**

```md
## Workflows

### Extending planner behavior

- Start in `lib/planner-service.ts`.
- Keep API handlers under `app/api/coach/athletes/[athleteId]/planner/` thin.
- Reuse `lib/workout-editor.ts` and `lib/workout-spec.ts` before adding draft logic elsewhere.

### Extending athlete onboarding or coach requests

- Start in `lib/coach-request-service.ts`.
- Keep `/api/coaches`, `/api/athlete/coach-requests`, and `/api/coach/requests/*` as adapters.

### Architecture smell checks

- Does a page or route call `prisma.*` directly for business behavior?
- Is new domain logic being added to UI components instead of `lib/`?
- Is a new service being created even though an existing owner already fits?
```

- [ ] **Step 3: Put the larger boundary map in `REFERENCE.md`**

```md
# Project Architecture Reference

## Current service owners

- `lib/planner-service.ts` — week-scoped planner reads and mutations
- `lib/template-service.ts` — coach template persistence
- `lib/coach-service.ts` — coach dashboard reads
- `lib/athlete-service.ts` — athlete week/profile reads
- `lib/coach-request-service.ts` — coach search and request lifecycle
- `lib/api-auth.ts` — API authorization guards
- `lib/auth-session.ts` — server-rendered current-user lookup
```

- [ ] **Step 4: Commit**

```bash
git add .copilot/skills/project-architecture/SKILL.md .copilot/skills/project-architecture/REFERENCE.md
git commit -m "docs: add project architecture skill"
```

### Task 5: Refresh the architecture docs and validate the full refactor

**Files:**
- Modify: `ARCHITECTURE.md`
- Modify: `docs/AI-HANDOFF.md`

- [ ] **Step 1: Update `ARCHITECTURE.md` with the new service owners**

```md
### Athlete boundary

- `lib/athlete-service.ts` owns athlete profile and athlete-facing week/profile reads.

### Coach-request boundary

- `lib/coach-request-service.ts` owns coach search plus request list/create/decision flows.
```

- [ ] **Step 2: Update `docs/AI-HANDOFF.md` to mention the skill and new entry points**

```md
- `lib/athlete-service.ts` owns athlete week/profile reads.
- `lib/coach-request-service.ts` owns onboarding and coach-request flows.
- `.copilot/skills/project-architecture/` gives future agents the repo's architecture workflow.
```

- [ ] **Step 3: Run the required full validation**

Run: `pnpm lint && pnpm build`
Expected: PASS

- [ ] **Step 4: Review the final diff**

Run: `git --no-pager diff -- lib/athlete-service.ts lib/coach-request-service.ts lib/coach-service.ts lib/template-service.ts app/athlete/page.tsx app/athlete/profile/page.tsx app/api/coaches/route.ts app/api/athlete/coach-requests/route.ts app/api/coach/requests/route.ts app/api/coach/requests/[requestId]/route.ts .copilot/skills/project-architecture/SKILL.md .copilot/skills/project-architecture/REFERENCE.md ARCHITECTURE.md docs/AI-HANDOFF.md`
Expected: only the architecture-boundary refactor, skill files, and doc updates

- [ ] **Step 5: Commit**

```bash
git add lib/athlete-service.ts lib/coach-request-service.ts lib/coach-service.ts lib/template-service.ts app/athlete/page.tsx app/athlete/profile/page.tsx app/api/coaches/route.ts app/api/athlete/coach-requests/route.ts app/api/coach/requests/route.ts app/api/coach/requests/[requestId]/route.ts .copilot/skills/project-architecture/SKILL.md .copilot/skills/project-architecture/REFERENCE.md ARCHITECTURE.md docs/AI-HANDOFF.md
git commit -m "refactor: complete service boundaries"
```

## Self-review

- **Spec coverage:** The plan covers the athlete read boundary, coach-request boundary, service-construction consistency, repo-local skill, and doc refresh from the approved spec.
- **Placeholder scan:** No TBD/TODO placeholders remain. Each task names exact files and concrete commands.
- **Type consistency:** The service names and exported singletons stay consistent across the plan: `athleteService`, `coachRequestService`, `coachService`, and `templateService`.
