# Coach-owned library and training plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let coaches create templates, standalone coach-owned sessions, and reusable training plans before they have athletes, while preserving the current athlete planning flow.

**Architecture:** Keep one shared session shape across the app, extend it with explicit ownership metadata, and add a new `TrainingPlan` parent object for reusable weekday-based planning. Split command logic into focused coach-side services for standalone sessions and training plans, then broaden `/coach/planner` into a coach library workspace that no longer hard-blocks when the roster is empty.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Prisma + SQLite, date-fns, Node test runner, existing Tempo UI primitives.

---

## File structure

- **Modify:** `prisma/schema.prisma` — add the `TrainingPlan` model, session ownership fields, and coach relations.
- **Modify:** `lib/planner-draft.ts` — extend the shared session draft with ownership mode, weekday/date rules, and sport metrics serialization.
- **Create:** `lib/coach-session-library-service.ts` — CRUD for coach-owned standalone sessions plus list loading for the planner workspace.
- **Create:** `lib/coach-training-plan-service.ts` — CRUD for training plans and sessions stored inside those plans.
- **Modify:** `lib/coach-planner-service.ts` — load the broader workspace (athletes, templates, standalone sessions, training plans) without requiring athletes.
- **Create:** `app/api/coach/planner/library-sessions/route.ts` — POST for coach-owned standalone sessions.
- **Create:** `app/api/coach/planner/library-sessions/[sessionId]/route.ts` — PATCH/DELETE for coach-owned standalone sessions.
- **Create:** `app/api/coach/planner/training-plans/route.ts` — POST for training-plan creation.
- **Create:** `app/api/coach/planner/training-plans/[planId]/route.ts` — PATCH/DELETE for training-plan metadata.
- **Create:** `app/api/coach/planner/training-plans/[planId]/sessions/route.ts` — POST for adding a session to a training plan.
- **Create:** `app/api/coach/planner/training-plans/[planId]/sessions/[sessionId]/route.ts` — PATCH/DELETE for training-plan sessions.
- **Modify:** `app/(app)/coach/planner/page.tsx` — remove the zero-athlete hard stop and pass the new workspace payload into the client.
- **Modify:** `app/(app)/coach/planner/PlannerClient.tsx` — add coach library and training-plan modes while preserving athlete planning.
- **Modify:** `app/(app)/coach/templates/CoachTemplatesClient.tsx` — route “new template in builder” and “load into builder” into the broader planner workspace modes.
- **Create:** `tests/coach-session-library-service.test.ts` — service tests for standalone coach-owned sessions.
- **Create:** `tests/coach-training-plan-service.test.ts` — service tests for training-plan CRUD and weekday session placement.
- **Modify:** `tests/planner-draft.test.ts` — validation and serialization coverage for the expanded shared session shape.
- **Modify:** `tests/coach-planner-service.test.ts` — workspace and planner page regression coverage for zero-athlete access and new workspace payload.

### Task 1: Expand the schema and shared session draft

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `lib/planner-draft.ts`
- Test: `tests/planner-draft.test.ts`

- [ ] **Step 1: Write the failing shared-draft tests**

Update `tests/planner-draft.test.ts` with ownership and sport-metrics coverage:

```ts
test('validatePlannerSessionDraft enforces standalone coach session rules', () => {
  const draft = createEmptyPlannerSessionDraft({
    ownershipMode: 'coach-library',
    scheduledDate: '2026-06-25',
  });

  assert.equal(validatePlannerSessionDraft({ ...draft, scheduledDate: '' }), 'A coach session date is required.');
  assert.equal(
    validatePlannerSessionDraft({ ...draft, planWeekday: 3 }),
    'Standalone coach sessions cannot have a training-plan weekday.',
  );
});

test('validatePlannerSessionDraft enforces training-plan session weekday rules', () => {
  const draft = createEmptyPlannerSessionDraft({
    ownershipMode: 'training-plan',
    scheduledDate: null,
  });

  assert.equal(validatePlannerSessionDraft({ ...draft, planWeekday: null }), 'Choose a weekday for the training-plan session.');
  assert.equal(
    validatePlannerSessionDraft({ ...draft, scheduledDate: '2026-06-25', planWeekday: 2 }),
    'Training-plan sessions use a weekday instead of a fixed date.',
  );
});

test('serializePlannerDraftForSave preserves shared sport metrics', () => {
  const draft = {
    ...createEmptyPlannerSessionDraft({
      ownershipMode: 'coach-library',
      scheduledDate: '2026-06-25',
    }),
    title: 'Bike threshold',
    sport: 'BIKING',
    sportMetrics: {
      ftp: 305,
      thresholdPaceSecPerKm: null,
      thresholdHr: 172,
    },
  };

  assert.deepEqual(serializePlannerDraftForSave(draft).sportMetrics, {
    ftp: 305,
    thresholdPaceSecPerKm: null,
    thresholdHr: 172,
  });
});
```

- [ ] **Step 2: Run the draft test to verify failure**

Run:

```bash
pnpm test -- tests/planner-draft.test.ts
```

Expected: FAIL because `ownershipMode`, `planWeekday`, `sportMetrics`, and the new validation messages do not exist yet.

- [ ] **Step 3: Add the Prisma fields and shared draft shape**

Update `prisma/schema.prisma` so `Session` can represent both coach-owned and athlete-owned work, and add the reusable training-plan parent:

```prisma
model User {
  // existing fields...
  coachOwnedSessions Session[]      @relation("CoachOwnedSessions")
  trainingPlans      TrainingPlan[] @relation("CoachTrainingPlans")
}

model TrainingPlan {
  id           Int       @id @default(autoincrement())
  coachOwnerId Int
  name         String
  summary      String?
  sport        String
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt
  coachOwner   User      @relation("CoachTrainingPlans", fields: [coachOwnerId], references: [id], onDelete: Cascade)
  sessions     Session[] @relation("TrainingPlanSessions")

  @@index([coachOwnerId, sport])
}

model Session {
  id              Int           @id @default(autoincrement())
  athleteId       Int?
  coachOwnerId    Int?
  trainingPlanId  Int?
  planId          Int?
  templateId      Int?
  assignedById    Int?
  date            DateTime?
  planWeekday     Int?
  sport           String
  title           String
  summary         String?
  sportMetricsJson String?
  status          String        @default("planned")
  source          String
  adjusted        Boolean       @default(false)
  athlete         User?         @relation("AthleteSessions", fields: [athleteId], references: [id], onDelete: Cascade)
  coachOwner      User?         @relation("CoachOwnedSessions", fields: [coachOwnerId], references: [id], onDelete: Cascade)
  trainingPlan    TrainingPlan? @relation("TrainingPlanSessions", fields: [trainingPlanId], references: [id], onDelete: Cascade)
  // keep existing plan/template/assignedBy/blocks/activity/assignments relations...

  @@index([coachOwnerId, date])
  @@index([trainingPlanId, planWeekday])
}
```

Then extend `lib/planner-draft.ts` around the session type and serializer:

```ts
export type SessionOwnershipMode = 'coach-library' | 'training-plan' | 'athlete';

export type PlannerSportMetrics = {
  ftp: number | null;
  thresholdPaceSecPerKm: number | null;
  thresholdHr: number | null;
};

export type PlannerSessionDraft = {
  id?: number;
  ownershipMode: SessionOwnershipMode;
  athleteId: number | null;
  scheduledDate: string | null;
  planWeekday: 1 | 2 | 3 | 4 | 5 | 6 | 7 | null;
  sport: string;
  title: string;
  summary: string;
  sourceTemplateId: number | null;
  sportMetrics: PlannerSportMetrics;
  blocks: PlannerBlockDraft[];
};

export function createEmptyPlannerSessionDraft(input: {
  ownershipMode: SessionOwnershipMode;
  scheduledDate: string | null;
  athleteId?: number | null;
  sport?: string;
}): PlannerSessionDraft {
  return {
    ownershipMode: input.ownershipMode,
    athleteId: input.athleteId ?? null,
    scheduledDate: input.scheduledDate,
    planWeekday: null,
    sport: input.sport ?? 'RUNNING',
    title: '',
    summary: '',
    sourceTemplateId: null,
    sportMetrics: {
      ftp: null,
      thresholdPaceSecPerKm: null,
      thresholdHr: null,
    },
    blocks: [
      createPlannerBlockDraft({ kind: 'warmup', zone: 1, durationSec: 600, note: 'Easy warmup' }),
      createPlannerBlockDraft({ kind: 'work', zone: 3, durationSec: 1800, note: 'Main work' }),
      createPlannerBlockDraft({ kind: 'cooldown', zone: 1, durationSec: 600, note: 'Cooldown' }),
    ],
  };
}

export function serializePlannerDraftForSave(draft: PlannerSessionDraft) {
  return {
    ownershipMode: draft.ownershipMode,
    athleteId: draft.athleteId,
    scheduledDate: draft.scheduledDate,
    planWeekday: draft.planWeekday,
    sport: draft.sport,
    title: draft.title.trim(),
    summary: draft.summary.trim(),
    sourceTemplateId: draft.sourceTemplateId,
    sportMetrics: draft.sportMetrics,
    blocks: draft.blocks.map((block, index) => ({
      id: block.id,
      kind: block.kind,
      zone: block.zone,
      durationSec: block.durationSec,
      reps: block.reps,
      targetType: block.targetType,
      targetLow: block.targetLow,
      targetHigh: block.targetHigh,
      note: block.note.trim() || null,
      sortOrder: index,
    })),
  };
}
```

- [ ] **Step 4: Implement the new validation rules and regenerate the local SQLite schema**

Add the mode-aware validation in `lib/planner-draft.ts`:

```ts
if (draft.ownershipMode === 'coach-library') {
  if (!draft.scheduledDate) return 'A coach session date is required.';
  if (draft.planWeekday !== null) return 'Standalone coach sessions cannot have a training-plan weekday.';
}

if (draft.ownershipMode === 'training-plan') {
  if (draft.planWeekday === null) return 'Choose a weekday for the training-plan session.';
  if (draft.scheduledDate) return 'Training-plan sessions use a weekday instead of a fixed date.';
}

if (draft.ownershipMode === 'athlete') {
  if (!Number.isInteger(draft.athleteId) || (draft.athleteId ?? 0) <= 0) return 'Choose an athlete before saving.';
  if (!draft.scheduledDate) return 'A valid scheduled date is required.';
}
```

Then run the schema refresh required by this repo:

```bash
pnpm db:push && pnpm db:seed
```

Expected: Prisma pushes the new `TrainingPlan` model and session ownership columns, then reseeds successfully.

- [ ] **Step 5: Re-run the draft test and commit**

Run:

```bash
pnpm test -- tests/planner-draft.test.ts
git add prisma/schema.prisma lib/planner-draft.ts tests/planner-draft.test.ts
git commit -m "feat: add shared coach planning session shape"
```

Expected: the targeted test passes, then the commit records the schema and draft-layer change.

### Task 2: Add coach-owned standalone session services

**Files:**
- Create: `lib/coach-session-library-service.ts`
- Modify: `lib/coach-planner-service.ts`
- Create: `tests/coach-session-library-service.test.ts`
- Modify: `tests/coach-planner-service.test.ts`

- [ ] **Step 1: Write the failing standalone-session service tests**

Create `tests/coach-session-library-service.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { createCoachSessionLibraryService } from '../lib/coach-session-library-service.ts';

test('coach session library lists standalone sessions without requiring athletes', async () => {
  const service = createCoachSessionLibraryService({
    db: {
      session: {
        async findMany() {
          return [
            {
              id: 41,
              coachOwnerId: 2,
              athleteId: null,
              trainingPlanId: null,
              date: new Date('2026-06-25T00:00:00.000Z'),
              planWeekday: null,
              sport: 'RUNNING',
              title: 'Coach long run',
              summary: 'Preview session',
              sportMetricsJson: null,
              source: 'coach-library',
              status: 'planned',
              adjusted: false,
              blocks: [],
            },
          ];
        },
      },
    } as never,
  });

  const sessions = await service.listForCoach(2);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].athleteId, null);
});

test('coach session library saves standalone sessions with coach ownership only', async () => {
  let createdPayload: Record<string, unknown> | undefined;

  const service = createCoachSessionLibraryService({
    db: {
      session: {
        async create(args: { data: Record<string, unknown> }) {
          createdPayload = args.data;
          return { id: 51 };
        },
      },
    } as never,
  });

  const result = await service.saveForCoach(2, {
    ownershipMode: 'coach-library',
    athleteId: null,
    scheduledDate: '2026-06-25',
    planWeekday: null,
    sport: 'RUNNING',
    title: 'Coach session',
    summary: '',
    sourceTemplateId: null,
    sportMetrics: { ftp: null, thresholdPaceSecPerKm: 255, thresholdHr: 168 },
    blocks: [],
  });

  assert.deepEqual(result, { ok: true, sessionId: 51 });
  assert.equal(createdPayload?.coachOwnerId, 2);
  assert.equal(createdPayload?.athleteId, null);
  assert.equal(createdPayload?.trainingPlanId, null);
});
```

- [ ] **Step 2: Run the standalone-session tests to verify failure**

Run:

```bash
pnpm test -- tests/coach-session-library-service.test.ts
```

Expected: FAIL because `../lib/coach-session-library-service.ts` does not exist yet.

- [ ] **Step 3: Implement the standalone-session command/query service**

Create `lib/coach-session-library-service.ts`:

```ts
import { parseISO } from 'date-fns';
import { prisma } from './prisma.ts';
import { serializePlannerDraftForSave, validatePlannerSessionDraft, type PlannerSessionDraft } from './planner-draft.ts';

export function createCoachSessionLibraryService({ db = prisma } = {}) {
  return {
    async listForCoach(coachId: number) {
      return db.session.findMany({
        where: {
          coachOwnerId: coachId,
          athleteId: null,
          trainingPlanId: null,
        },
        include: { blocks: { orderBy: { sortOrder: 'asc' } } },
        orderBy: [{ date: 'asc' }, { title: 'asc' }],
      });
    },

    async saveForCoach(coachId: number, draft: PlannerSessionDraft, sessionId?: number) {
      const validationError = validatePlannerSessionDraft(draft);
      if (validationError) return { ok: false as const, error: validationError, status: 400 };

      const serialized = serializePlannerDraftForSave(draft);
      const data = {
        coachOwnerId: coachId,
        athleteId: null,
        trainingPlanId: null,
        date: parseISO(serialized.scheduledDate!),
        planWeekday: null,
        sport: serialized.sport,
        title: serialized.title,
        summary: serialized.summary || null,
        sportMetricsJson: JSON.stringify(serialized.sportMetrics),
        templateId: serialized.sourceTemplateId,
        source: 'coach-library',
        status: 'planned',
        adjusted: false,
        blocks: {
          create: serialized.blocks.map((block) => ({
            kind: block.kind,
            zone: block.zone,
            durationSec: block.durationSec,
            reps: block.reps,
            targetType: block.targetType,
            targetLow: block.targetLow,
            targetHigh: block.targetHigh,
            note: block.note,
            sortOrder: block.sortOrder,
          })),
        },
      };

      if (!sessionId) {
        const created = await db.session.create({ data });
        return { ok: true as const, sessionId: created.id };
      }

      await db.$transaction([
        db.block.deleteMany({ where: { sessionId } }),
        db.session.update({ where: { id: sessionId, coachOwnerId: coachId }, data }),
      ]);
      return { ok: true as const, sessionId };
    },

    async deleteForCoach(coachId: number, sessionId: number) {
      const existing = await db.session.findFirst({
        where: {
          id: sessionId,
          coachOwnerId: coachId,
          athleteId: null,
          trainingPlanId: null,
        },
        select: { id: true },
      });
      if (!existing) return { ok: false as const, error: 'Session not found.', status: 404 };

      await db.session.delete({ where: { id: sessionId } });
      return { ok: true as const, sessionId };
    },
  };
}
```

- [ ] **Step 4: Broaden the planner workspace loader and add regression assertions**

Update `lib/coach-planner-service.ts` so `loadWorkspace()` no longer assumes a roster is required:

```ts
const [athletes, templates, librarySessions, trainingPlans, assignedSessions] = await Promise.all([
  db.user.findMany({
    where: { coachId, role: 'ATHLETE' },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, email: true },
  }),
  db.template.findMany({
    where: { ownerId: coachId },
    include: { blocks: { orderBy: { sortOrder: 'asc' } } },
    orderBy: [{ sport: 'asc' }, { name: 'asc' }],
  }),
  db.session.findMany({
    where: { coachOwnerId: coachId, athleteId: null, trainingPlanId: null },
    include: { blocks: { orderBy: { sortOrder: 'asc' } } },
    orderBy: [{ date: 'asc' }, { title: 'asc' }],
  }),
  db.trainingPlan.findMany({
    where: { coachOwnerId: coachId },
    include: { sessions: { include: { blocks: { orderBy: { sortOrder: 'asc' } } }, orderBy: { planWeekday: 'asc' } } },
    orderBy: [{ sport: 'asc' }, { name: 'asc' }],
  }),
  db.session.findMany({
    where: {
      athlete: { coachId },
      date: { gte: weekStart, lte: weekEnd },
    },
    include: { blocks: { orderBy: { sortOrder: 'asc' } } },
    orderBy: [{ date: 'asc' }, { title: 'asc' }],
  }),
]);
```

Also extend `tests/coach-planner-service.test.ts` with:

```ts
assert.equal(view.athletes.length, 0);
assert.equal(view.librarySessions.length, 1);
assert.equal(view.trainingPlans.length, 1);
```

Create `app/api/coach/planner/library-sessions/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireCoach } from '@/lib/api-auth';
import { coachSessionLibraryService } from '@/lib/coach-session-library-service';

export async function POST(request: NextRequest) {
  const { user, error } = await requireCoach();
  if (error) return error;

  const result = await coachSessionLibraryService.saveForCoach(user.id, await request.json());
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, sessionId: result.sessionId }, { status: 201 });
}
```

Create `app/api/coach/planner/library-sessions/[sessionId]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireCoach } from '@/lib/api-auth';
import { coachSessionLibraryService } from '@/lib/coach-session-library-service';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { user, error } = await requireCoach();
  if (error) return error;

  const { sessionId } = await params;
  const result = await coachSessionLibraryService.saveForCoach(user.id, await request.json(), Number(sessionId));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, sessionId: result.sessionId });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { user, error } = await requireCoach();
  if (error) return error;

  const { sessionId } = await params;
  const result = await coachSessionLibraryService.deleteForCoach(user.id, Number(sessionId));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Re-run the service tests and commit**

Run:

```bash
pnpm test -- tests/coach-session-library-service.test.ts tests/coach-planner-service.test.ts
git add lib/coach-session-library-service.ts lib/coach-planner-service.ts app/api/coach/planner/library-sessions tests/coach-session-library-service.test.ts tests/coach-planner-service.test.ts
git commit -m "feat: add coach session library services"
```

Expected: the new standalone-session service and workspace regression tests pass.

### Task 3: Add training-plan services and API routes

**Files:**
- Create: `lib/coach-training-plan-service.ts`
- Create: `app/api/coach/planner/training-plans/route.ts`
- Create: `app/api/coach/planner/training-plans/[planId]/route.ts`
- Create: `app/api/coach/planner/training-plans/[planId]/sessions/route.ts`
- Create: `app/api/coach/planner/training-plans/[planId]/sessions/[sessionId]/route.ts`
- Create: `tests/coach-training-plan-service.test.ts`

- [ ] **Step 1: Write the failing training-plan tests**

Create `tests/coach-training-plan-service.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import { createCoachTrainingPlanService } from '../lib/coach-training-plan-service.ts';

test('coach training plans create a reusable plan and weekday session', async () => {
  let planCreate: Record<string, unknown> | undefined;
  let sessionCreate: Record<string, unknown> | undefined;

  const service = createCoachTrainingPlanService({
    db: {
      trainingPlan: {
        async create(args: { data: Record<string, unknown> }) {
          planCreate = args.data;
          return { id: 71 };
        },
      },
      session: {
        async create(args: { data: Record<string, unknown> }) {
          sessionCreate = args.data;
          return { id: 72 };
        },
      },
    } as never,
  });

  const plan = await service.createPlan(2, { name: 'Base week', summary: 'Build aerobic durability', sport: 'RUNNING' });
  const session = await service.savePlanSession(2, 71, {
    ownershipMode: 'training-plan',
    athleteId: null,
    scheduledDate: null,
    planWeekday: 3,
    sport: 'RUNNING',
    title: 'Wednesday tempo',
    summary: '',
    sourceTemplateId: null,
    sportMetrics: { ftp: null, thresholdPaceSecPerKm: 255, thresholdHr: 168 },
    blocks: [],
  });

  assert.equal(plan.id, 71);
  assert.deepEqual(session, { ok: true, sessionId: 72 });
  assert.equal(planCreate?.coachOwnerId, 2);
  assert.equal(sessionCreate?.trainingPlanId, 71);
  assert.equal(sessionCreate?.planWeekday, 3);
  assert.equal(sessionCreate?.date, null);
});
```

- [ ] **Step 2: Run the training-plan test to verify failure**

Run:

```bash
pnpm test -- tests/coach-training-plan-service.test.ts
```

Expected: FAIL because `../lib/coach-training-plan-service.ts` does not exist yet.

- [ ] **Step 3: Implement the training-plan service**

Create `lib/coach-training-plan-service.ts`:

```ts
import { prisma } from './prisma.ts';
import { serializePlannerDraftForSave, validatePlannerSessionDraft, type PlannerSessionDraft } from './planner-draft.ts';

export function createCoachTrainingPlanService({ db = prisma } = {}) {
  return {
    async createPlan(coachId: number, input: { name: string; summary: string; sport: string }) {
      return db.trainingPlan.create({
        data: {
          coachOwnerId: coachId,
          name: input.name.trim(),
          summary: input.summary.trim() || null,
          sport: input.sport,
        },
      });
    },

    async savePlanSession(coachId: number, trainingPlanId: number, draft: PlannerSessionDraft, sessionId?: number) {
      const validationError = validatePlannerSessionDraft(draft);
      if (validationError) return { ok: false as const, error: validationError, status: 400 };

      const plan = await db.trainingPlan.findFirst({
        where: { id: trainingPlanId, coachOwnerId: coachId },
        select: { id: true },
      });
      if (!plan) return { ok: false as const, error: 'Training plan not found.', status: 404 };

      const serialized = serializePlannerDraftForSave(draft);
      const data = {
        coachOwnerId: coachId,
        athleteId: null,
        trainingPlanId,
        date: null,
        planWeekday: serialized.planWeekday,
        sport: serialized.sport,
        title: serialized.title,
        summary: serialized.summary || null,
        sportMetricsJson: JSON.stringify(serialized.sportMetrics),
        templateId: serialized.sourceTemplateId,
        source: 'training-plan',
        status: 'planned',
        adjusted: false,
        blocks: {
          create: serialized.blocks.map((block) => ({
            kind: block.kind,
            zone: block.zone,
            durationSec: block.durationSec,
            reps: block.reps,
            targetType: block.targetType,
            targetLow: block.targetLow,
            targetHigh: block.targetHigh,
            note: block.note,
            sortOrder: block.sortOrder,
          })),
        },
      };

      if (!sessionId) {
        const created = await db.session.create({ data });
        return { ok: true as const, sessionId: created.id };
      }

      await db.$transaction([
        db.block.deleteMany({ where: { sessionId } }),
        db.session.update({ where: { id: sessionId, coachOwnerId: coachId }, data }),
      ]);
      return { ok: true as const, sessionId };
    },

    async updatePlan(coachId: number, trainingPlanId: number, input: { name: string; summary: string; sport: string }) {
      const existing = await db.trainingPlan.findFirst({
        where: { id: trainingPlanId, coachOwnerId: coachId },
        select: { id: true },
      });
      if (!existing) return { ok: false as const, error: 'Training plan not found.', status: 404 };

      await db.trainingPlan.update({
        where: { id: trainingPlanId },
        data: {
          name: input.name.trim(),
          summary: input.summary.trim() || null,
          sport: input.sport,
        },
      });
      return { ok: true as const, planId: trainingPlanId };
    },

    async deletePlan(coachId: number, trainingPlanId: number) {
      const existing = await db.trainingPlan.findFirst({
        where: { id: trainingPlanId, coachOwnerId: coachId },
        select: { id: true },
      });
      if (!existing) return { ok: false as const, error: 'Training plan not found.', status: 404 };

      await db.trainingPlan.delete({ where: { id: trainingPlanId } });
      return { ok: true as const, planId: trainingPlanId };
    },

    async deletePlanSession(coachId: number, trainingPlanId: number, sessionId: number) {
      const existing = await db.session.findFirst({
        where: {
          id: sessionId,
          coachOwnerId: coachId,
          trainingPlanId,
          athleteId: null,
        },
        select: { id: true },
      });
      if (!existing) return { ok: false as const, error: 'Training-plan session not found.', status: 404 };

      await db.session.delete({ where: { id: sessionId } });
      return { ok: true as const, sessionId };
    },
  };
}
```

- [ ] **Step 4: Wire the training-plan API routes**

Create `app/api/coach/planner/training-plans/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireCoach } from '@/lib/api-auth';
import { coachTrainingPlanService } from '@/lib/coach-training-plan-service';

export async function POST(request: NextRequest) {
  const { user, error } = await requireCoach();
  if (error) return error;

  const body = await request.json();
  const plan = await coachTrainingPlanService.createPlan(user.id, body);
  return NextResponse.json({ ok: true, planId: plan.id }, { status: 201 });
}
```

Create `app/api/coach/planner/training-plans/[planId]/sessions/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireCoach } from '@/lib/api-auth';
import { coachTrainingPlanService } from '@/lib/coach-training-plan-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { user, error } = await requireCoach();
  if (error) return error;

  const { planId } = await params;
  const result = await coachTrainingPlanService.savePlanSession(user.id, Number(planId), await request.json());
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, sessionId: result.sessionId }, { status: 201 });
}
```

Create `app/api/coach/planner/training-plans/[planId]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireCoach } from '@/lib/api-auth';
import { coachTrainingPlanService } from '@/lib/coach-training-plan-service';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { user, error } = await requireCoach();
  if (error) return error;

  const { planId } = await params;
  const result = await coachTrainingPlanService.updatePlan(user.id, Number(planId), await request.json());
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, planId: result.planId });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ planId: string }> },
) {
  const { user, error } = await requireCoach();
  if (error) return error;

  const { planId } = await params;
  const result = await coachTrainingPlanService.deletePlan(user.id, Number(planId));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
```

Create `app/api/coach/planner/training-plans/[planId]/sessions/[sessionId]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireCoach } from '@/lib/api-auth';
import { coachTrainingPlanService } from '@/lib/coach-training-plan-service';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string; sessionId: string }> },
) {
  const { user, error } = await requireCoach();
  if (error) return error;

  const { planId, sessionId } = await params;
  const result = await coachTrainingPlanService.savePlanSession(
    user.id,
    Number(planId),
    await request.json(),
    Number(sessionId),
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, sessionId: result.sessionId });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ planId: string; sessionId: string }> },
) {
  const { user, error } = await requireCoach();
  if (error) return error;

  const { planId, sessionId } = await params;
  const result = await coachTrainingPlanService.deletePlanSession(user.id, Number(planId), Number(sessionId));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Re-run the training-plan test and commit**

Run:

```bash
pnpm test -- tests/coach-training-plan-service.test.ts tests/coach-planner-service.test.ts
git add lib/coach-training-plan-service.ts app/api/coach/planner/training-plans tests/coach-training-plan-service.test.ts tests/coach-planner-service.test.ts
git commit -m "feat: add coach training plan services"
```

Expected: the new training-plan tests pass, and the workspace regressions still pass after the new routes exist.

### Task 4: Rebuild the coach planner page as a library workspace

**Files:**
- Modify: `app/(app)/coach/planner/page.tsx`
- Modify: `app/(app)/coach/planner/PlannerClient.tsx`
- Modify: `app/(app)/coach/templates/CoachTemplatesClient.tsx`
- Modify: `tests/coach-planner-service.test.ts`

- [ ] **Step 1: Add the failing workspace/page regression**

Extend `tests/coach-planner-service.test.ts` with file-source assertions:

```ts
assert.doesNotMatch(pageSource, /No athletes available/);
assert.match(pageSource, /librarySessions=/);
assert.match(pageSource, /trainingPlans=/);
assert.match(clientSource, /Session library/);
assert.match(clientSource, /Training plans/);
assert.match(clientSource, /selectedWorkspaceMode/);
```

- [ ] **Step 2: Run the planner regression test to verify failure**

Run:

```bash
pnpm test -- tests/coach-planner-service.test.ts
```

Expected: FAIL because the page still returns the zero-athlete empty state and the client does not expose workspace modes yet.

- [ ] **Step 3: Remove the zero-athlete gate and pass the broader workspace payload**

Update `app/(app)/coach/planner/page.tsx`:

```tsx
return (
  <PageShell size="wide" className="max-w-[1600px]">
    <TopBar
      eyebrow="Planner"
      title="Build your training library"
      description="Create templates, standalone coach sessions, and reusable training plans before athlete assignment."
      actions={
        <>
          <ActionLink href="/coach/templates" tone="secondary">
            Templates
          </ActionLink>
          <ActionLink href="/coach">Roster</ActionLink>
        </>
      }
    />

    <PlannerClient
      athletes={workspace.athletes}
      templates={workspace.templates}
      librarySessions={workspace.librarySessions}
      trainingPlans={workspace.trainingPlans}
      days={workspace.days}
      periodLabel={workspace.period.label}
      initialAthleteId={workspace.athletes[0]?.id ?? null}
      initialTemplateId={Number.isInteger(parsedTemplateId) ? parsedTemplateId : null}
      initialDate={date ?? formatISO(new Date(), { representation: 'date' })}
    />
  </PageShell>
);
```

- [ ] **Step 4: Add workspace modes and training-plan controls to `PlannerClient.tsx`**

Add the top-level mode state and draft initialization:

```tsx
const workspaceModes = ['library', 'training-plan', 'athlete'] as const;
type WorkspaceMode = (typeof workspaceModes)[number];

const [selectedWorkspaceMode, setSelectedWorkspaceMode] = useState<WorkspaceMode>(
  athletes.length === 0 ? 'library' : 'athlete',
);
const [selectedTrainingPlanId, setSelectedTrainingPlanId] = useState<number | null>(trainingPlans[0]?.id ?? null);
const [draft, setDraft] = useState<PlannerSessionDraft>(() =>
  createEmptyPlannerSessionDraft({
    ownershipMode: athletes.length === 0 ? 'coach-library' : 'athlete',
    athleteId: athletes[0]?.id ?? null,
    scheduledDate: initialDate,
  }),
);
```

Render a mode switcher and plan-specific controls:

```tsx
<div className="flex flex-wrap gap-3">
  <button type="button" className={selectedWorkspaceMode === 'library' ? primaryButtonClassName : secondaryButtonClassName} onClick={() => setSelectedWorkspaceMode('library')}>
    Session library
  </button>
  <button type="button" className={selectedWorkspaceMode === 'training-plan' ? primaryButtonClassName : secondaryButtonClassName} onClick={() => setSelectedWorkspaceMode('training-plan')}>
    Training plans
  </button>
  {athletes.length > 0 ? (
    <button type="button" className={selectedWorkspaceMode === 'athlete' ? primaryButtonClassName : secondaryButtonClassName} onClick={() => setSelectedWorkspaceMode('athlete')}>
      Athlete week
    </button>
  ) : null}
</div>
```

Then branch save behavior:

```tsx
const endpoint =
  draft.ownershipMode === 'coach-library'
    ? draft.id
      ? `/api/coach/planner/library-sessions/${draft.id}`
      : '/api/coach/planner/library-sessions'
    : draft.ownershipMode === 'training-plan' && selectedTrainingPlanId
      ? draft.id
        ? `/api/coach/planner/training-plans/${selectedTrainingPlanId}/sessions/${draft.id}`
        : `/api/coach/planner/training-plans/${selectedTrainingPlanId}/sessions`
      : draft.id
        ? `/api/coach/planner/sessions/${draft.id}`
        : '/api/coach/planner/sessions';
```

Also add fields for:

- training-plan selection and creation
- weekday selection when `ownershipMode === 'training-plan'`
- sport metrics inputs (`ftp`, threshold pace, threshold HR)

- [ ] **Step 5: Re-run the planner regression test and commit**

Run:

```bash
pnpm test -- tests/coach-planner-service.test.ts
git add "app/(app)/coach/planner/page.tsx" "app/(app)/coach/planner/PlannerClient.tsx" "app/(app)/coach/templates/CoachTemplatesClient.tsx" tests/coach-planner-service.test.ts
git commit -m "feat: broaden coach planner workspace"
```

Expected: the planner page regression passes, and the coach planner becomes usable with zero athletes.

### Task 5: Run the full targeted verification set and polish compatibility

**Files:**
- Modify: `tests/coach-planner-service.test.ts`

- [ ] **Step 1: Add one compatibility regression for existing athlete planning**

Append this assertion to `tests/coach-planner-service.test.ts` after the planner workspace checks:

```ts
assert.match(clientSource, /draft\.ownershipMode === 'athlete'/);
assert.match(clientSource, /\/api\/coach\/planner\/sessions/);
```

This keeps the original athlete-specific flow visible in the source-based regression test.

- [ ] **Step 2: Run the full targeted test set**

Run:

```bash
pnpm test -- tests/planner-draft.test.ts tests/coach-session-library-service.test.ts tests/coach-training-plan-service.test.ts tests/coach-planner-service.test.ts
```

Expected: PASS across the shared draft logic, standalone session service, training-plan service, and workspace regressions.

- [ ] **Step 3: Run lint and build after the schema/UI/service changes**

Run:

```bash
pnpm lint && pnpm build
```

Expected: both commands succeed after Prisma generate and Next.js build complete.

- [ ] **Step 4: Refresh the local database once more if Prisma generated code is stale after build**

Run:

```bash
pnpm db:push && pnpm db:seed
```

Expected: the local SQLite database and generated client stay aligned with the updated schema before the final commit.

- [ ] **Step 5: Commit the compatibility pass**

Run:

```bash
git add tests/coach-planner-service.test.ts
git commit -m "test: cover coach planning compatibility"
```

Expected: the final regression pass is captured in its own small commit.
