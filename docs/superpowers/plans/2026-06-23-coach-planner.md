# Coach Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a coach Planner workspace where coaches can select an athlete/date, create or edit detailed visual sessions from scratch, and optionally prefill drafts from existing templates.

**Architecture:** Add a focused planner read/write service behind `lib/coach-planner-service.ts`, then expose it through coach-only API routes and a new `/coach/planner` App Router page. The client UI keeps all draft manipulation local with small pure helpers in `lib/planner-draft.ts`, renders a calendar-first workspace, and persists flattened Tempo `Block` records using the existing `Session`, `Block`, `Plan`, and `Assignment` models.

**Tech Stack:** Next.js 16 App Router, React 19 client components, TypeScript, Tailwind CSS v4, Prisma + SQLite, date-fns, Node test runner, existing Tempo UI primitives.

---

## File Structure

- Create `lib/planner-draft.ts`: pure draft normalization, block add/update/duplicate/reorder helpers, template-to-session draft conversion, metrics projection, and validation.
- Create `lib/coach-planner-service.ts`: coach-scoped roster/calendar/template loader plus create/update/delete session commands.
- Create `tests/planner-draft.test.ts`: pure unit tests for draft helpers and validation.
- Create `tests/coach-planner-service.test.ts`: service tests with mocked DB interfaces.
- Create `app/api/coach/planner/sessions/route.ts`: POST endpoint for creating coach-planned sessions.
- Create `app/api/coach/planner/sessions/[sessionId]/route.ts`: PATCH/DELETE endpoint for editing/removing sessions.
- Create `app/(app)/coach/planner/page.tsx`: server page that loads the planner workspace.
- Create `app/(app)/coach/planner/PlannerClient.tsx`: interactive calendar, template picker, visual block editor, inspector, and save/delete flows.
- Modify `lib/app-navigation.ts`: rename coach navigation from “Plan builder” to “Planner” and point it at `/coach/planner`.
- Modify `app/(app)/coach/builder/page.tsx`: redirect old `/coach/builder` links to `/coach/planner`.
- Modify `app/(app)/coach/templates/CoachTemplatesClient.tsx`: point “Load into builder” and “New template in builder” links at Planner with `templateId`.

## Data Contracts

Use this client draft shape everywhere outside Prisma:

```ts
export type PlannerBlockDraft = {
  clientId: string;
  id?: number;
  kind: 'warmup' | 'work' | 'recovery' | 'cooldown';
  zone: 1 | 2 | 3 | 4 | 5;
  durationSec: number;
  reps: number | null;
  targetType: 'power' | 'pace' | 'hr' | null;
  targetLow: number | null;
  targetHigh: number | null;
  note: string;
};

export type PlannerSessionDraft = {
  id?: number;
  athleteId: number;
  scheduledDate: string;
  sport: string;
  title: string;
  summary: string;
  sourceTemplateId: number | null;
  blocks: PlannerBlockDraft[];
};
```

Persist blocks as current Prisma `Block` records: `kind`, `zone`, `durationSec`, `reps`, `targetType`, `targetLow`, `targetHigh`, `note`, and `sortOrder`.

---

### Task 1: Planner Draft Helpers

**Files:**
- Create: `lib/planner-draft.ts`
- Test: `tests/planner-draft.test.ts`

- [ ] **Step 1: Write failing draft helper tests**

Create `tests/planner-draft.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addPlannerBlock,
  createEmptyPlannerSessionDraft,
  duplicatePlannerBlock,
  movePlannerBlock,
  plannerDraftToTempoBlocks,
  templateToPlannerDraft,
  updatePlannerBlock,
  validatePlannerSessionDraft,
} from '../lib/planner-draft.ts';

test('createEmptyPlannerSessionDraft seeds a professional default workout', () => {
  const draft = createEmptyPlannerSessionDraft({
    athleteId: 5,
    scheduledDate: '2026-06-25',
  });

  assert.equal(draft.athleteId, 5);
  assert.equal(draft.scheduledDate, '2026-06-25');
  assert.equal(draft.sport, 'RUNNING');
  assert.equal(draft.blocks.length, 3);
  assert.deepEqual(
    draft.blocks.map((block) => [block.kind, block.zone, block.durationSec]),
    [
      ['warmup', 1, 600],
      ['work', 3, 1800],
      ['cooldown', 1, 600],
    ],
  );
});

test('planner block helpers add, update, duplicate, and reorder immutable drafts', () => {
  const draft = createEmptyPlannerSessionDraft({ athleteId: 5, scheduledDate: '2026-06-25' });
  const added = addPlannerBlock(draft, 'recovery');
  const updated = updatePlannerBlock(added, added.blocks.length - 1, {
    zone: 2,
    durationSec: 300,
    note: 'Float recovery',
  });
  const duplicated = duplicatePlannerBlock(updated, updated.blocks.length - 1);
  const moved = movePlannerBlock(duplicated, duplicated.blocks.length - 1, 1);

  assert.equal(draft.blocks.length, 3);
  assert.equal(added.blocks.length, 4);
  assert.equal(updated.blocks.at(-1)?.note, 'Float recovery');
  assert.equal(duplicated.blocks.length, 5);
  assert.notEqual(duplicated.blocks.at(-1)?.clientId, updated.blocks.at(-1)?.clientId);
  assert.equal(moved.blocks[1].note, 'Float recovery');
});

test('templateToPlannerDraft preloads template blocks for a chosen athlete and date', () => {
  const draft = templateToPlannerDraft(
    {
      id: 8,
      sport: 'BIKING',
      name: 'Over-unders',
      summary: 'Controlled aerobic pressure.',
      blocks: [
        {
          id: 80,
          kind: 'work',
          zone: 4,
          durationSec: 720,
          reps: 3,
          targetType: 'power',
          targetLow: 250,
          targetHigh: 270,
          note: 'Three rounds',
          sortOrder: 0,
        },
      ],
    },
    { athleteId: 5, scheduledDate: '2026-06-25' },
  );

  assert.equal(draft.sourceTemplateId, 8);
  assert.equal(draft.title, 'Over-unders');
  assert.equal(draft.sport, 'BIKING');
  assert.equal(draft.blocks[0].targetType, 'power');
  assert.equal(draft.blocks[0].targetLow, 250);
});

test('validatePlannerSessionDraft catches missing title and invalid targets', () => {
  const draft = createEmptyPlannerSessionDraft({ athleteId: 5, scheduledDate: '2026-06-25' });

  assert.equal(validatePlannerSessionDraft({ ...draft, title: '' }), 'Session title is required.');
  assert.equal(
    validatePlannerSessionDraft({
      ...draft,
      title: 'Threshold',
      blocks: [{ ...draft.blocks[0], durationSec: 0 }],
    }),
    'Every block needs a positive duration.',
  );
  assert.equal(
    validatePlannerSessionDraft({
      ...draft,
      title: 'Threshold',
      blocks: [{ ...draft.blocks[0], targetType: 'power', targetLow: 280, targetHigh: 260 }],
    }),
    'Target range low must be less than or equal to target high.',
  );
});

test('plannerDraftToTempoBlocks projects block drafts into metric-ready Tempo blocks', () => {
  const draft = {
    ...createEmptyPlannerSessionDraft({ athleteId: 5, scheduledDate: '2026-06-25' }),
    title: 'Steady endurance',
  };

  const tempoBlocks = plannerDraftToTempoBlocks(draft.blocks);

  assert.equal(tempoBlocks.length, 3);
  assert.deepEqual(tempoBlocks[1], {
    kind: 'work',
    zone: 3,
    durationSec: 1800,
    reps: null,
    target: null,
  });
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
pnpm test -- tests/planner-draft.test.ts
```

Expected: FAIL because `../lib/planner-draft.ts` does not exist.

- [ ] **Step 3: Implement draft helpers**

Create `lib/planner-draft.ts`:

```ts
import { SPORT_OPTIONS } from './sport.ts';
import type { TempoBlock, TempoBlockKind, TempoZone } from './tempo-blocks.ts';

export type PlannerTargetType = 'power' | 'pace' | 'hr';

export type PlannerBlockDraft = {
  clientId: string;
  id?: number;
  kind: TempoBlockKind;
  zone: TempoZone;
  durationSec: number;
  reps: number | null;
  targetType: PlannerTargetType | null;
  targetLow: number | null;
  targetHigh: number | null;
  note: string;
};

export type PlannerSessionDraft = {
  id?: number;
  athleteId: number;
  scheduledDate: string;
  sport: string;
  title: string;
  summary: string;
  sourceTemplateId: number | null;
  blocks: PlannerBlockDraft[];
};

export type PlannerTemplateRecord = {
  id: number;
  sport: string;
  name: string;
  summary: string | null;
  blocks: Array<{
    id: number;
    kind: string;
    zone: number;
    durationSec: number;
    reps: number | null;
    targetType: string | null;
    targetLow: number | null;
    targetHigh: number | null;
    note: string | null;
    sortOrder: number;
  }>;
};

let nextClientId = 0;

function createClientId(prefix = 'block') {
  nextClientId += 1;
  return `${prefix}-${nextClientId}`;
}

export function createPlannerBlockDraft(input: Partial<PlannerBlockDraft> = {}): PlannerBlockDraft {
  return {
    clientId: input.clientId ?? createClientId(),
    id: input.id,
    kind: normalizeKind(input.kind),
    zone: normalizeZone(input.zone),
    durationSec: normalizePositiveInt(input.durationSec, 600),
    reps: normalizeNullablePositiveInt(input.reps),
    targetType: normalizeTargetType(input.targetType),
    targetLow: normalizeNullablePositiveInt(input.targetLow),
    targetHigh: normalizeNullablePositiveInt(input.targetHigh),
    note: typeof input.note === 'string' ? input.note : '',
  };
}

export function createEmptyPlannerSessionDraft(input: {
  athleteId: number;
  scheduledDate: string;
  sport?: string;
}): PlannerSessionDraft {
  return {
    athleteId: input.athleteId,
    scheduledDate: input.scheduledDate,
    sport: input.sport ?? 'RUNNING',
    title: '',
    summary: '',
    sourceTemplateId: null,
    blocks: [
      createPlannerBlockDraft({ kind: 'warmup', zone: 1, durationSec: 600, note: 'Easy warmup' }),
      createPlannerBlockDraft({ kind: 'work', zone: 3, durationSec: 1800, note: 'Main work' }),
      createPlannerBlockDraft({ kind: 'cooldown', zone: 1, durationSec: 600, note: 'Cooldown' }),
    ],
  };
}

export function templateToPlannerDraft(
  template: PlannerTemplateRecord,
  input: { athleteId: number; scheduledDate: string },
): PlannerSessionDraft {
  return {
    athleteId: input.athleteId,
    scheduledDate: input.scheduledDate,
    sport: template.sport,
    title: template.name,
    summary: template.summary ?? '',
    sourceTemplateId: template.id,
    blocks: template.blocks
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((block) =>
        createPlannerBlockDraft({
          id: block.id,
          kind: normalizeKind(block.kind),
          zone: normalizeZone(block.zone),
          durationSec: block.durationSec,
          reps: block.reps,
          targetType: normalizeTargetType(block.targetType),
          targetLow: block.targetLow,
          targetHigh: block.targetHigh,
          note: block.note ?? '',
        }),
      ),
  };
}

export function addPlannerBlock(draft: PlannerSessionDraft, kind: TempoBlockKind = 'work') {
  return {
    ...draft,
    blocks: [...draft.blocks, createPlannerBlockDraft({ kind, zone: kind === 'recovery' ? 1 : 3 })],
  };
}

export function updatePlannerBlock(
  draft: PlannerSessionDraft,
  index: number,
  patch: Partial<Omit<PlannerBlockDraft, 'clientId' | 'id'>>,
) {
  return {
    ...draft,
    blocks: draft.blocks.map((block, blockIndex) =>
      blockIndex === index
        ? createPlannerBlockDraft({
            ...block,
            ...patch,
            clientId: block.clientId,
            id: block.id,
          })
        : block,
    ),
  };
}

export function duplicatePlannerBlock(draft: PlannerSessionDraft, index: number) {
  const source = draft.blocks[index];
  if (!source) return draft;

  const copy = createPlannerBlockDraft({
    ...source,
    clientId: createClientId('copy'),
    id: undefined,
    note: source.note,
  });
  const blocks = [...draft.blocks.slice(0, index + 1), copy, ...draft.blocks.slice(index + 1)];
  return { ...draft, blocks };
}

export function removePlannerBlock(draft: PlannerSessionDraft, index: number) {
  if (draft.blocks.length <= 1) return draft;
  return { ...draft, blocks: draft.blocks.filter((_, blockIndex) => blockIndex !== index) };
}

export function movePlannerBlock(draft: PlannerSessionDraft, fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex || !draft.blocks[fromIndex]) return draft;
  const next = draft.blocks.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(Math.max(0, Math.min(toIndex, next.length)), 0, moved);
  return { ...draft, blocks: next };
}

export function plannerDraftToTempoBlocks(blocks: PlannerBlockDraft[]): TempoBlock[] {
  return blocks.map((block) => ({
    kind: block.kind,
    zone: block.zone,
    durationSec: block.durationSec,
    reps: block.reps,
    target:
      block.targetType && block.targetLow !== null && block.targetHigh !== null
        ? { type: block.targetType, low: block.targetLow, high: block.targetHigh }
        : null,
  }));
}

export function serializePlannerDraftForSave(draft: PlannerSessionDraft) {
  return {
    athleteId: draft.athleteId,
    scheduledDate: draft.scheduledDate,
    sport: draft.sport,
    title: draft.title.trim(),
    summary: draft.summary.trim(),
    sourceTemplateId: draft.sourceTemplateId,
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

export function validatePlannerSessionDraft(draft: PlannerSessionDraft) {
  if (!Number.isInteger(draft.athleteId) || draft.athleteId <= 0) {
    return 'Choose an athlete before saving.';
  }
  if (!draft.scheduledDate || Number.isNaN(new Date(draft.scheduledDate).getTime())) {
    return 'A valid scheduled date is required.';
  }
  if (!draft.title.trim()) {
    return 'Session title is required.';
  }
  if (!SPORT_OPTIONS.includes(draft.sport as (typeof SPORT_OPTIONS)[number])) {
    return 'Sport is required.';
  }
  if (draft.blocks.length === 0) {
    return 'At least one block is required.';
  }
  for (const block of draft.blocks) {
    if (block.durationSec <= 0) {
      return 'Every block needs a positive duration.';
    }
    if (block.targetType && (block.targetLow === null || block.targetHigh === null)) {
      return 'Target range needs both low and high values.';
    }
    if (block.targetLow !== null && block.targetHigh !== null && block.targetLow > block.targetHigh) {
      return 'Target range low must be less than or equal to target high.';
    }
  }
  return null;
}

function normalizeKind(input: unknown): TempoBlockKind {
  return input === 'warmup' || input === 'work' || input === 'recovery' || input === 'cooldown'
    ? input
    : 'work';
}

function normalizeZone(input: unknown): TempoZone {
  const parsed = Number(input);
  return parsed >= 1 && parsed <= 5 ? (Math.round(parsed) as TempoZone) : 2;
}

function normalizeTargetType(input: unknown): PlannerTargetType | null {
  return input === 'power' || input === 'pace' || input === 'hr' ? input : null;
}

function normalizePositiveInt(input: unknown, fallback: number) {
  const parsed = Number(input);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : fallback;
}

function normalizeNullablePositiveInt(input: unknown) {
  if (input === null || input === undefined || input === '') return null;
  const parsed = Number(input);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : null;
}
```

- [ ] **Step 4: Run draft helper tests**

Run:

```bash
pnpm test -- tests/planner-draft.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/planner-draft.ts tests/planner-draft.test.ts
git commit -m "feat: add planner draft helpers

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2: Coach Planner Service

**Files:**
- Create: `lib/coach-planner-service.ts`
- Test: `tests/coach-planner-service.test.ts`

- [ ] **Step 1: Write failing service tests**

Create `tests/coach-planner-service.test.ts`:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { format } from 'date-fns';

import { createCoachPlannerService } from '../lib/coach-planner-service.ts';

const block = {
  id: 1,
  kind: 'work',
  zone: 3,
  durationSec: 1800,
  reps: null,
  targetType: null,
  targetLow: null,
  targetHigh: null,
  note: 'Steady',
  sortOrder: 0,
};

test('coach planner loads roster, templates, and a Monday-first visible week', async () => {
  const service = createCoachPlannerService({
    db: {
      user: {
        async findMany(args: { where: { coachId: number; role: string }; orderBy: { name: string } }) {
          assert.deepEqual(args.where, { coachId: 2, role: 'ATHLETE' });
          return [{ id: 5, name: 'Mara Holt', email: 'mara@example.com' }];
        },
      },
      template: {
        async findMany() {
          return [{ id: 9, sport: 'RUNNING', name: 'Easy aerobic', summary: null, blocks: [block] }];
        },
      },
      session: {
        async findMany(args: { where: { athlete: { coachId: number }; date: { gte: Date; lte: Date } } }) {
          assert.equal(args.where.athlete.coachId, 2);
          assert.equal(format(args.where.date.gte, 'yyyy-MM-dd'), '2026-06-22');
          assert.equal(format(args.where.date.lte, 'yyyy-MM-dd'), '2026-06-28');
          return [
            {
              id: 12,
              athleteId: 5,
              templateId: null,
              assignedById: 2,
              date: new Date('2026-06-25T00:00:00.000Z'),
              timeLabel: null,
              sport: 'RUNNING',
              title: 'Endurance',
              summary: 'Steady',
              status: 'planned',
              source: 'coach',
              adjusted: false,
              blocks: [block],
            },
          ];
        },
      },
    } as never,
  });

  const view = await service.loadWorkspace(2, '2026-06-25');

  assert.equal(view.athletes[0].id, 5);
  assert.equal(view.templates[0].id, 9);
  assert.equal(view.days.length, 7);
  assert.equal(view.days[0].isoDate, '2026-06-22');
  assert.equal(view.days[3].sessions[0].id, 12);
  assert.equal(view.days[3].sessions[0].durationSec, 1800);
});

test('coach planner creates a direct coach session and assignment record', async () => {
  const calls: {
    planCreate?: unknown;
    sessionCreate?: {
      athleteId: number;
      planId: number;
      templateId: number | null;
      assignedById: number;
      sport: string;
      title: string;
      source: string;
      blocks: { create: Array<{ kind: string; zone: number; durationSec: number; sortOrder: number }> };
    };
    assignmentUpsert?: unknown;
  } = {};

  const service = createCoachPlannerService({
    db: {
      user: {
        async findFirst(args: { where: { id: number; coachId: number; role: string } }) {
          assert.deepEqual(args.where, { id: 5, coachId: 2, role: 'ATHLETE' });
          return { id: 5 };
        },
      },
      plan: {
        async findFirst() {
          return null;
        },
        async create(args: unknown) {
          calls.planCreate = args;
          return { id: 77 };
        },
      },
      session: {
        async create(args: { data: typeof calls.sessionCreate & { date: Date; summary: string | null; status: string; adjusted: boolean; timeLabel: string | null } }) {
          calls.sessionCreate = args.data;
          return { id: 88 };
        },
      },
      assignment: {
        async upsert(args: unknown) {
          calls.assignmentUpsert = args;
          return { id: 99 };
        },
      },
    } as never,
    now: () => new Date('2026-06-23T12:00:00.000Z'),
  });

  const result = await service.saveSession(2, {
    athleteId: 5,
    scheduledDate: '2026-06-25',
    sport: 'RUNNING',
    title: 'Endurance build',
    summary: 'Keep it smooth.',
    sourceTemplateId: null,
    blocks: [{ ...block, clientId: 'b1' }],
  });

  assert.deepEqual(result, { ok: true, sessionId: 88 });
  assert.ok(calls.planCreate);
  assert.equal(calls.sessionCreate?.athleteId, 5);
  assert.equal(calls.sessionCreate?.planId, 77);
  assert.equal(calls.sessionCreate?.assignedById, 2);
  assert.equal(calls.sessionCreate?.source, 'coach');
  assert.equal(calls.sessionCreate?.blocks.create[0].sortOrder, 0);
  assert.ok(calls.assignmentUpsert);
});

test('coach planner updates only sessions owned by roster athletes', async () => {
  let deletedBlocks = false;
  let updatedSession = false;
  const service = createCoachPlannerService({
    db: {
      session: {
        async findUnique() {
          return { id: 88, athleteId: 5, adjusted: true };
        },
        async update() {
          updatedSession = true;
          return { id: 88 };
        },
      },
      user: {
        async findFirst() {
          return { id: 5 };
        },
      },
      plan: {
        async findFirst() {
          return { id: 77 };
        },
        async create() {
          throw new Error('plan.create should not run when a plan exists');
        },
      },
      block: {
        async deleteMany() {
          deletedBlocks = true;
          return { count: 1 };
        },
      },
      assignment: {
        async upsert() {
          return { id: 99 };
        },
      },
      $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations),
    } as never,
  });

  const result = await service.saveSession(
    2,
    {
      athleteId: 5,
      scheduledDate: '2026-06-25',
      sport: 'RUNNING',
      title: 'Edited endurance',
      summary: '',
      sourceTemplateId: null,
      blocks: [{ ...block, clientId: 'b1', durationSec: 2400 }],
    },
    88,
  );

  assert.deepEqual(result, { ok: true, sessionId: 88 });
  assert.equal(deletedBlocks, true);
  assert.equal(updatedSession, true);
});
```

- [ ] **Step 2: Run tests and verify failure**

Run:

```bash
pnpm test -- tests/coach-planner-service.test.ts
```

Expected: FAIL because `../lib/coach-planner-service.ts` does not exist.

- [ ] **Step 3: Implement service**

Create `lib/coach-planner-service.ts` with:

```ts
import { addDays, endOfWeek, format, formatISO, isValid, parseISO, startOfWeek } from 'date-fns';
import { prisma } from './prisma.ts';
import { deriveSessionMetrics } from './session-math.ts';
import {
  serializePlannerDraftForSave,
  validatePlannerSessionDraft,
  type PlannerSessionDraft,
} from './planner-draft.ts';

type CoachPlannerDeps = {
  db?: typeof prisma;
  now?: () => Date;
};

export function createCoachPlannerService({ db = prisma, now = () => new Date() }: CoachPlannerDeps = {}) {
  return {
    async loadWorkspace(coachId: number, referenceDateInput?: string) {
      const referenceDate = parseReferenceDate(referenceDateInput);
      const weekStart = startOfWeek(referenceDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(referenceDate, { weekStartsOn: 1 });
      const [athletes, templates, sessions] = await Promise.all([
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
          where: {
            athlete: { coachId },
            date: { gte: weekStart, lte: weekEnd },
          },
          include: { blocks: { orderBy: { sortOrder: 'asc' } } },
          orderBy: [{ date: 'asc' }, { title: 'asc' }],
        }),
      ]);

      const days = Array.from({ length: 7 }, (_, index) => {
        const date = addDays(weekStart, index);
        const isoDate = formatISO(date, { representation: 'date' });
        return {
          isoDate,
          label: format(date, 'EEE'),
          dateLabel: format(date, 'd MMM'),
          sessions: sessions
            .filter((session) => formatISO(session.date, { representation: 'date' }) === isoDate)
            .map((session) => {
              const metrics = deriveSessionMetrics(
                session.blocks.map((block) => ({
                  kind: block.kind as 'warmup' | 'work' | 'recovery' | 'cooldown',
                  zone: block.zone as 1 | 2 | 3 | 4 | 5,
                  durationSec: block.durationSec,
                  reps: block.reps,
                  target:
                    block.targetType && block.targetLow !== null && block.targetHigh !== null
                      ? { type: block.targetType as 'power' | 'pace' | 'hr', low: block.targetLow, high: block.targetHigh }
                      : null,
                })),
              );
              return {
                id: session.id,
                athleteId: session.athleteId,
                templateId: session.templateId,
                assignedById: session.assignedById,
                scheduledDate: isoDate,
                sport: session.sport,
                title: session.title,
                summary: session.summary,
                status: session.status,
                source: session.source,
                adjusted: session.adjusted,
                durationSec: metrics.durationSec,
                tss: metrics.tss,
                segments: metrics.segments,
                blocks: session.blocks,
              };
            }),
        };
      });

      return {
        period: {
          start: weekStart,
          end: weekEnd,
          label: `${format(weekStart, 'd MMM')} - ${format(weekEnd, 'd MMM yyyy')}`,
        },
        athletes,
        templates,
        days,
      };
    },

    async saveSession(coachId: number, draft: PlannerSessionDraft, sessionId?: number) {
      const validationError = validatePlannerSessionDraft(draft);
      if (validationError) {
        return { ok: false as const, error: validationError, status: 400 };
      }

      const athlete = await db.user.findFirst({
        where: { id: draft.athleteId, coachId, role: 'ATHLETE' },
        select: { id: true },
      });
      if (!athlete) {
        return { ok: false as const, error: 'Athlete not found in your roster.', status: 404 };
      }

      if (sessionId !== undefined) {
        const existing = await db.session.findUnique({
          where: { id: sessionId },
          select: { id: true, athleteId: true, adjusted: true },
        });
        if (!existing || existing.athleteId !== draft.athleteId) {
          return { ok: false as const, error: 'Session not found.', status: 404 };
        }
      }

      const scheduledDate = parseISO(draft.scheduledDate);
      const weekStart = startOfWeek(scheduledDate, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(scheduledDate, { weekStartsOn: 1 });
      const plan =
        (await db.plan.findFirst({
          where: { athleteId: draft.athleteId, startDate: weekStart, endDate: weekEnd },
          orderBy: { id: 'desc' },
        })) ??
        (await db.plan.create({
          data: {
            athleteId: draft.athleteId,
            name: `Week of ${format(weekStart, 'd MMM yyyy')}`,
            startDate: weekStart,
            endDate: weekEnd,
          },
        }));

      const serialized = serializePlannerDraftForSave(draft);
      const blocks = serialized.blocks.map((block) => ({
        kind: block.kind,
        zone: block.zone,
        durationSec: block.durationSec,
        reps: block.reps,
        targetType: block.targetType,
        targetLow: block.targetLow,
        targetHigh: block.targetHigh,
        note: block.note,
        sortOrder: block.sortOrder,
      }));
      const sessionData = {
        athleteId: draft.athleteId,
        planId: plan.id,
        templateId: draft.sourceTemplateId,
        assignedById: coachId,
        date: scheduledDate,
        timeLabel: null,
        sport: draft.sport,
        title: draft.title.trim(),
        summary: draft.summary.trim() || null,
        status: 'planned',
        source: draft.sourceTemplateId ? 'template' : 'coach',
      };

      const savedSession =
        sessionId === undefined
          ? await db.session.create({
              data: {
                ...sessionData,
                adjusted: false,
                blocks: { create: blocks },
              },
            })
          : await updateExistingSession(db, sessionId, sessionData, blocks);

      await db.assignment.upsert({
        where: { sessionId_athleteId: { sessionId: savedSession.id, athleteId: draft.athleteId } },
        update: { assignedBy: coachId, assignedAt: now() },
        create: { sessionId: savedSession.id, athleteId: draft.athleteId, assignedBy: coachId, assignedAt: now() },
      });

      return { ok: true as const, sessionId: savedSession.id };
    },

    async deleteSession(coachId: number, sessionId: number) {
      const session = await db.session.findUnique({
        where: { id: sessionId },
        select: { id: true, athleteId: true, athlete: { select: { coachId: true } } },
      });
      if (!session || session.athlete.coachId !== coachId) {
        return { ok: false as const, error: 'Session not found.', status: 404 };
      }

      await db.session.delete({ where: { id: sessionId } });
      return { ok: true as const, sessionId };
    },
  };
}

async function updateExistingSession(
  db: typeof prisma,
  sessionId: number,
  sessionData: {
    athleteId: number;
    planId: number;
    templateId: number | null;
    assignedById: number;
    date: Date;
    timeLabel: null;
    sport: string;
    title: string;
    summary: string | null;
    status: string;
    source: string;
  },
  blocks: Array<{
    kind: string;
    zone: number;
    durationSec: number;
    reps: number | null;
    targetType: string | null;
    targetLow: number | null;
    targetHigh: number | null;
    note: string | null;
    sortOrder: number;
  }>,
) {
  const [, savedSession] = await db.$transaction([
    db.block.deleteMany({ where: { sessionId } }),
    db.session.update({
      where: { id: sessionId },
      data: {
        ...sessionData,
        blocks: { create: blocks },
      },
    }),
  ]);
  return savedSession;
}

function parseReferenceDate(input?: string) {
  const parsed = input ? parseISO(input) : new Date();
  return isValid(parsed) ? parsed : new Date();
}

export const coachPlannerService = createCoachPlannerService();
```

- [ ] **Step 4: Run service tests**

Run:

```bash
pnpm test -- tests/coach-planner-service.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/coach-planner-service.ts tests/coach-planner-service.test.ts
git commit -m "feat: add coach planner service

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3: Planner API and Navigation

**Files:**
- Create: `app/api/coach/planner/sessions/route.ts`
- Create: `app/api/coach/planner/sessions/[sessionId]/route.ts`
- Modify: `lib/app-navigation.ts`
- Modify: `app/(app)/coach/builder/page.tsx`
- Modify: `app/(app)/coach/templates/CoachTemplatesClient.tsx`
- Test: `tests/coach-planner-service.test.ts`

- [ ] **Step 1: Add source-based route assertions**

Append to `tests/coach-planner-service.test.ts`:

```ts
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath: string) => readFile(path.join(root, relativePath), 'utf8');

test('planner API routes and navigation use the coach planner service', async () => {
  const createRoute = await read('app/api/coach/planner/sessions/route.ts');
  const sessionRoute = await read('app/api/coach/planner/sessions/[sessionId]/route.ts');
  const navigation = await read('lib/app-navigation.ts');
  const oldBuilderPage = await read('app/(app)/coach/builder/page.tsx');
  const templatesClient = await read('app/(app)/coach/templates/CoachTemplatesClient.tsx');

  assert.match(createRoute, /coachPlannerService\.saveSession/);
  assert.match(createRoute, /requireCoach/);
  assert.match(sessionRoute, /coachPlannerService\.saveSession/);
  assert.match(sessionRoute, /coachPlannerService\.deleteSession/);
  assert.match(navigation, /label: 'Planner'/);
  assert.match(navigation, /href: '\/coach\/planner'/);
  assert.match(oldBuilderPage, /redirect\('\/coach\/planner/);
  assert.match(templatesClient, /\/coach\/planner\?templateId=/);
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
pnpm test -- tests/coach-planner-service.test.ts
```

Expected: FAIL because API routes and `/coach/planner` navigation do not exist yet.

- [ ] **Step 3: Add create route**

Create `app/api/coach/planner/sessions/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireCoach } from '@/lib/api-auth';
import { coachPlannerService } from '@/lib/coach-planner-service';

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireCoach();
    if (error) return error;

    const body = await request.json();
    const result = await coachPlannerService.saveSession(user.id, body);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ ok: true, sessionId: result.sessionId }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to create planner session' }, { status: 500 });
  }
}
```

- [ ] **Step 4: Add update/delete route**

Create `app/api/coach/planner/sessions/[sessionId]/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { requireCoach } from '@/lib/api-auth';
import { coachPlannerService } from '@/lib/coach-planner-service';

function parseSessionId(input: string) {
  const parsed = Number(input);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { user, error } = await requireCoach();
    if (error) return error;

    const { sessionId } = await params;
    const parsedSessionId = parseSessionId(sessionId);
    if (!parsedSessionId) {
      return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 });
    }

    const body = await request.json();
    const result = await coachPlannerService.saveSession(user.id, body, parsedSessionId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ ok: true, sessionId: result.sessionId });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to update planner session' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { user, error } = await requireCoach();
    if (error) return error;

    const { sessionId } = await params;
    const parsedSessionId = parseSessionId(sessionId);
    if (!parsedSessionId) {
      return NextResponse.json({ error: 'Invalid sessionId' }, { status: 400 });
    }

    const result = await coachPlannerService.deleteSession(user.id, parsedSessionId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to delete planner session' }, { status: 500 });
  }
}
```

- [ ] **Step 5: Update navigation and legacy links**

Change `lib/app-navigation.ts` coach items to:

```ts
return [
  { label: 'Athletes', href: '/coach', matchPrefix: '/coach' },
  { label: 'Planner', href: '/coach/planner', matchPrefix: '/coach/planner' },
  { label: 'Templates', href: '/coach/templates', matchPrefix: '/coach/templates' },
];
```

Replace `app/(app)/coach/builder/page.tsx` with:

```ts
import { redirect } from 'next/navigation';

export default function CoachBuilderRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ templateId?: string; athleteId?: string }>;
}) {
  return searchParams.then(({ templateId, athleteId }) => {
    const params = new URLSearchParams();
    if (templateId) params.set('templateId', templateId);
    if (athleteId) params.set('athleteId', athleteId);
    redirect(`/coach/planner${params.size > 0 ? `?${params.toString()}` : ''}`);
  });
}
```

In `app/(app)/coach/templates/CoachTemplatesClient.tsx`, change:

```tsx
href="/coach/builder"
```

to:

```tsx
href="/coach/planner"
```

and change:

```tsx
href={`/coach/builder?templateId=${template.id}`}
```

to:

```tsx
href={`/coach/planner?templateId=${template.id}`}
```

- [ ] **Step 6: Run route/navigation tests**

Run:

```bash
pnpm test -- tests/coach-planner-service.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/api/coach/planner lib/app-navigation.ts app/(app)/coach/builder/page.tsx app/(app)/coach/templates/CoachTemplatesClient.tsx tests/coach-planner-service.test.ts
git commit -m "feat: add planner api routes

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4: Planner Page and Visual Editor

**Files:**
- Create: `app/(app)/coach/planner/page.tsx`
- Create: `app/(app)/coach/planner/PlannerClient.tsx`
- Test: `tests/coach-planner-service.test.ts`

- [ ] **Step 1: Add source-based UI assertions**

Append to `tests/coach-planner-service.test.ts`:

```ts
test('planner page exposes calendar-first visual workout creation', async () => {
  const pageSource = await read('app/(app)/coach/planner/page.tsx');
  const clientSource = await read('app/(app)/coach/planner/PlannerClient.tsx');

  assert.match(pageSource, /coachPlannerService\.loadWorkspace/);
  assert.match(pageSource, /PlannerClient/);
  assert.match(clientSource, /Click a day to plan/);
  assert.match(clientSource, /Session canvas/);
  assert.match(clientSource, /draggable/);
  assert.match(clientSource, /duplicatePlannerBlock/);
  assert.match(clientSource, /deriveSessionMetrics/);
  assert.match(clientSource, /\/api\/coach\/planner\/sessions/);
});
```

- [ ] **Step 2: Run test and verify failure**

Run:

```bash
pnpm test -- tests/coach-planner-service.test.ts
```

Expected: FAIL because the Planner page/client do not exist.

- [ ] **Step 3: Create server page**

Create `app/(app)/coach/planner/page.tsx`:

```tsx
import { formatISO } from 'date-fns';
import { redirect } from 'next/navigation';
import { ActionLink, EmptyState, PageShell, TopBar } from '@/components/ui';
import { getCurrentUser } from '@/lib/auth-session';
import { coachPlannerService } from '@/lib/coach-planner-service';
import { PlannerClient } from './PlannerClient';

export default async function CoachPlannerPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; athleteId?: string; templateId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'COACH') redirect('/login');

  const { date, athleteId, templateId } = await searchParams;
  const workspace = await coachPlannerService.loadWorkspace(user.id, date);
  const parsedAthleteId = Number(athleteId);
  const parsedTemplateId = Number(templateId);

  if (workspace.athletes.length === 0) {
    return (
      <PageShell size="wide">
        <EmptyState title="No athletes available" description="Add an athlete to your roster before planning sessions." />
      </PageShell>
    );
  }

  return (
    <PageShell size="wide" className="max-w-[1600px]">
      <TopBar
        eyebrow="Planner"
        title="Plan the training week"
        description="Click a day to plan, build the session visually, or preload structure from a saved template."
        actions={
          <>
            <ActionLink href="/coach/templates" tone="secondary">
              Templates
            </ActionLink>
            <ActionLink href="/coach">
              Roster
            </ActionLink>
          </>
        }
      />

      <PlannerClient
        athletes={workspace.athletes}
        templates={workspace.templates}
        days={workspace.days}
        periodLabel={workspace.period.label}
        initialAthleteId={
          Number.isInteger(parsedAthleteId) && workspace.athletes.some((athlete) => athlete.id === parsedAthleteId)
            ? parsedAthleteId
            : workspace.athletes[0].id
        }
        initialTemplateId={
          Number.isInteger(parsedTemplateId) && workspace.templates.some((template) => template.id === parsedTemplateId)
            ? parsedTemplateId
            : null
        }
        initialDate={date ?? formatISO(new Date(), { representation: 'date' })}
      />
    </PageShell>
  );
}
```

- [ ] **Step 4: Create client planner workspace**

Create `app/(app)/coach/planner/PlannerClient.tsx` with these required sections:

1. Imports:

```tsx
'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Badge, EmptyState, Surface, dangerTextClassName, formFieldClassName, formSelectClassName, formTextareaClassName, primaryButtonClassName, secondaryButtonClassName, successTextClassName } from '@/components/ui';
import { MetricText } from '@/components/tempo/MetricText';
import { SessionBlockBar } from '@/components/tempo/SessionBlockBar';
import { formatDuration } from '@/lib/format-duration';
import { deriveSessionMetrics } from '@/lib/session-math';
import { getSportLabel, SPORT_OPTIONS } from '@/lib/sport';
import { TEMPO_ZONE_META } from '@/lib/tempo-blocks';
import {
  addPlannerBlock,
  createEmptyPlannerSessionDraft,
  duplicatePlannerBlock,
  movePlannerBlock,
  plannerDraftToTempoBlocks,
  removePlannerBlock,
  serializePlannerDraftForSave,
  templateToPlannerDraft,
  updatePlannerBlock,
  validatePlannerSessionDraft,
  type PlannerSessionDraft,
  type PlannerTemplateRecord,
} from '@/lib/planner-draft';
```

2. Props/types:

```tsx
type PlannerAthlete = { id: number; name: string; email: string };
type PlannerDay = {
  isoDate: string;
  label: string;
  dateLabel: string;
  sessions: Array<{
    id: number;
    athleteId: number;
    templateId: number | null;
    scheduledDate: string;
    sport: string;
    title: string;
    summary: string | null;
    status: string;
    source: string;
    adjusted: boolean;
    durationSec: number;
    tss: number;
    segments: Array<{ key: string; zone: number; durationSec: number; label: string; color: string }>;
    blocks: PlannerTemplateRecord['blocks'];
  }>;
};
```

3. State initialization:

```tsx
export function PlannerClient({
  athletes,
  templates,
  days,
  periodLabel,
  initialAthleteId,
  initialTemplateId,
  initialDate,
}: {
  athletes: PlannerAthlete[];
  templates: PlannerTemplateRecord[];
  days: PlannerDay[];
  periodLabel: string;
  initialAthleteId: number;
  initialTemplateId: number | null;
  initialDate: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedAthleteId, setSelectedAthleteId] = useState(initialAthleteId);
  const [selectedBlockIndex, setSelectedBlockIndex] = useState(0);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'danger'>('success');
  const initialTemplate = templates.find((template) => template.id === initialTemplateId);
  const [draft, setDraft] = useState<PlannerSessionDraft>(() =>
    initialTemplate
      ? templateToPlannerDraft(initialTemplate, { athleteId: initialAthleteId, scheduledDate: initialDate })
      : createEmptyPlannerSessionDraft({ athleteId: initialAthleteId, scheduledDate: initialDate }),
  );

  const visibleSessions = useMemo(
    () => days.flatMap((day) => day.sessions.filter((session) => session.athleteId === selectedAthleteId)),
    [days, selectedAthleteId],
  );
  const metrics = deriveSessionMetrics(plannerDraftToTempoBlocks(draft.blocks));
  const selectedBlock = draft.blocks[selectedBlockIndex] ?? draft.blocks[0];
```

4. Event functions:

```tsx
  function startNewSession(isoDate: string) {
    setSelectedBlockIndex(0);
    setMessage('');
    setDraft(createEmptyPlannerSessionDraft({ athleteId: selectedAthleteId, scheduledDate: isoDate }));
  }

  function loadSession(session: PlannerDay['sessions'][number]) {
    setSelectedAthleteId(session.athleteId);
    setSelectedBlockIndex(0);
    setMessage('');
    setDraft({
      id: session.id,
      athleteId: session.athleteId,
      scheduledDate: session.scheduledDate,
      sport: session.sport,
      title: session.title,
      summary: session.summary ?? '',
      sourceTemplateId: session.templateId,
      blocks: session.blocks.map((block) => ({
        clientId: `session-${session.id}-block-${block.id}`,
        id: block.id,
        kind: block.kind as 'warmup' | 'work' | 'recovery' | 'cooldown',
        zone: block.zone as 1 | 2 | 3 | 4 | 5,
        durationSec: block.durationSec,
        reps: block.reps,
        targetType: block.targetType as 'power' | 'pace' | 'hr' | null,
        targetLow: block.targetLow,
        targetHigh: block.targetHigh,
        note: block.note ?? '',
      })),
    });
  }

  function loadTemplate(templateId: string) {
    const template = templates.find((item) => item.id === Number(templateId));
    if (!template) return;
    setSelectedBlockIndex(0);
    setDraft(templateToPlannerDraft(template, { athleteId: selectedAthleteId, scheduledDate: draft.scheduledDate }));
  }

  function saveSession() {
    const validationError = validatePlannerSessionDraft(draft);
    if (validationError) {
      setMessageTone('danger');
      setMessage(validationError);
      return;
    }

    startTransition(async () => {
      const response = await fetch(
        draft.id ? `/api/coach/planner/sessions/${draft.id}` : '/api/coach/planner/sessions',
        {
          method: draft.id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(serializePlannerDraftForSave(draft)),
        },
      );
      const payload = await response.json().catch(() => ({ error: 'Failed to save session' }));
      if (!response.ok) {
        setMessageTone('danger');
        setMessage(payload.error ?? 'Failed to save session');
        return;
      }
      setMessageTone('success');
      setMessage('Session saved to the planner.');
      router.refresh();
    });
  }

  function deleteSession() {
    if (!draft.id) return;
    startTransition(async () => {
      const response = await fetch(`/api/coach/planner/sessions/${draft.id}`, { method: 'DELETE' });
      const payload = await response.json().catch(() => ({ error: 'Failed to delete session' }));
      if (!response.ok) {
        setMessageTone('danger');
        setMessage(payload.error ?? 'Failed to delete session');
        return;
      }
      setMessageTone('success');
      setMessage('Session deleted.');
      setDraft(createEmptyPlannerSessionDraft({ athleteId: selectedAthleteId, scheduledDate: draft.scheduledDate }));
      router.refresh();
    });
  }
```

5. JSX layout requirements:

Render a 3-column responsive grid:

```tsx
  return (
    <div className="grid gap-6 xl:grid-cols-[0.85fr_1.35fr_0.9fr]">
      <Surface className="space-y-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Planner week</p>
          <h2 className="mt-2 text-lg font-semibold text-[var(--text)]">{periodLabel}</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Click a day to plan or open an existing session.</p>
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-[var(--text-secondary)]">Athlete</span>
          <select
            value={selectedAthleteId}
            className={formSelectClassName}
            onChange={(event) => {
              const athleteId = Number(event.target.value);
              setSelectedAthleteId(athleteId);
              setDraft((current) => ({ ...current, athleteId }));
            }}
          >
            {athletes.map((athlete) => (
              <option key={athlete.id} value={athlete.id}>{athlete.name}</option>
            ))}
          </select>
        </label>

        <div className="space-y-3">
          {days.map((day) => (
            <button
              key={day.isoDate}
              type="button"
              onClick={() => startNewSession(day.isoDate)}
              className={`w-full rounded-[12px] border p-4 text-left transition ${
                draft.scheduledDate === day.isoDate ? 'border-[#DCE0D2] bg-[var(--brand-tint)]' : 'border-[var(--border)] bg-[#FBFAF7] hover:border-[#D6D1C7]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--text)]">{day.label}</p>
                  <p className="text-xs text-[var(--text-secondary)]">{day.dateLabel}</p>
                </div>
                <Badge>{day.sessions.filter((session) => session.athleteId === selectedAthleteId).length}</Badge>
              </div>
              <div className="mt-3 space-y-2">
                {day.sessions.filter((session) => session.athleteId === selectedAthleteId).slice(0, 2).map((session) => (
                  <span
                    key={session.id}
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      event.stopPropagation();
                      loadSession(session);
                    }}
                    className="block rounded-[10px] bg-[var(--surface)] px-3 py-2"
                  >
                    <span className="block truncate text-xs font-semibold text-[var(--text)]">{session.title}</span>
                    <span className="mt-1 block text-[11px] text-[var(--text-secondary)]">{formatDuration(session.durationSec)} · {session.tss} TSS</span>
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      </Surface>

      <Surface className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Session canvas</p>
            <h2 className="mt-2 text-lg font-semibold text-[var(--text)]">{draft.id ? 'Edit planned session' : 'Create detailed session'}</h2>
          </div>
          <Badge tone="brand">{formatDuration(metrics.durationSec)} · {metrics.tss} TSS</Badge>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <input className={formFieldClassName} value={draft.title} placeholder="Session title" onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          <select className={formSelectClassName} value={draft.sport} onChange={(event) => setDraft({ ...draft, sport: event.target.value })}>
            {SPORT_OPTIONS.map((sport) => <option key={sport} value={sport}>{getSportLabel(sport)}</option>)}
          </select>
        </div>
        <textarea className={formTextareaClassName} value={draft.summary} placeholder="Coach notes or session intent" onChange={(event) => setDraft({ ...draft, summary: event.target.value })} />

        <SessionBlockBar segments={metrics.segments} />

        <div className="space-y-3">
          {draft.blocks.map((block, index) => {
            const zoneMeta = TEMPO_ZONE_META[block.zone];
            return (
              <button
                key={block.clientId}
                type="button"
                draggable
                onDragStart={(event) => event.dataTransfer.setData('text/plain', String(index))}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  const fromIndex = Number(event.dataTransfer.getData('text/plain'));
                  setDraft((current) => movePlannerBlock(current, fromIndex, index));
                  setSelectedBlockIndex(index);
                }}
                onClick={() => setSelectedBlockIndex(index)}
                className={`w-full rounded-[12px] border p-4 text-left transition ${selectedBlockIndex === index ? 'border-[#DCE0D2] bg-[var(--brand-tint)]' : 'border-[var(--border)] bg-[#FBFAF7]'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold capitalize text-[var(--text)]">{block.kind}</p>
                    <p className="mt-1 text-xs text-[var(--text-secondary)]">{block.note || zoneMeta.name}</p>
                  </div>
                  <MetricText>{formatDuration(block.durationSec)}</MetricText>
                </div>
                <div className="mt-3 h-2 rounded-full" style={{ background: zoneMeta.solid, width: `${Math.max(18, Math.min(100, (block.durationSec / Math.max(metrics.durationSec, 1)) * 100))}%` }} />
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-3">
          {(['warmup', 'work', 'recovery', 'cooldown'] as const).map((kind) => (
            <button key={kind} type="button" className={secondaryButtonClassName} onClick={() => setDraft((current) => addPlannerBlock(current, kind))}>
              Add {kind}
            </button>
          ))}
        </div>
      </Surface>

      <Surface className="space-y-5">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--text-muted)]">Inspector</p>
          <h2 className="mt-2 text-lg font-semibold text-[var(--text)]">Tune selected block</h2>
        </div>

        {templates.length > 0 ? (
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--text-secondary)]">Prefill from template</span>
            <select className={formSelectClassName} value={draft.sourceTemplateId ?? ''} onChange={(event) => loadTemplate(event.target.value)}>
              <option value="">Choose template</option>
              {templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
            </select>
          </label>
        ) : (
          <EmptyState title="No templates yet" description="Create detailed sessions from scratch now; template creation can reuse this editor later." />
        )}

        {selectedBlock ? (
          <div className="space-y-4">
            <select className={formSelectClassName} value={selectedBlock.kind} onChange={(event) => setDraft((current) => updatePlannerBlock(current, selectedBlockIndex, { kind: event.target.value as typeof selectedBlock.kind }))}>
              {(['warmup', 'work', 'recovery', 'cooldown'] as const).map((kind) => <option key={kind} value={kind}>{kind}</option>)}
            </select>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-[var(--text-secondary)]">Duration (minutes)</span>
              <input className={formFieldClassName} type="number" min="1" value={Math.round(selectedBlock.durationSec / 60)} onChange={(event) => setDraft((current) => updatePlannerBlock(current, selectedBlockIndex, { durationSec: Number(event.target.value) * 60 }))} />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-[var(--text-secondary)]">Intensity zone</span>
              <input className={formFieldClassName} type="range" min="1" max="5" value={selectedBlock.zone} onChange={(event) => setDraft((current) => updatePlannerBlock(current, selectedBlockIndex, { zone: Number(event.target.value) as typeof selectedBlock.zone }))} />
            </label>
            <textarea className={formTextareaClassName} value={selectedBlock.note} placeholder="Block cue or instructions" onChange={(event) => setDraft((current) => updatePlannerBlock(current, selectedBlockIndex, { note: event.target.value }))} />
            <div className="grid grid-cols-2 gap-3">
              <button type="button" className={secondaryButtonClassName} onClick={() => setDraft((current) => duplicatePlannerBlock(current, selectedBlockIndex))}>Copy block</button>
              <button type="button" className={secondaryButtonClassName} onClick={() => setDraft((current) => removePlannerBlock(current, selectedBlockIndex))}>Remove</button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-col gap-3">
          <button type="button" disabled={isPending} className={primaryButtonClassName} onClick={saveSession}>Save session</button>
          {draft.id ? <button type="button" disabled={isPending} className={secondaryButtonClassName} onClick={deleteSession}>Delete session</button> : null}
          {message ? <p className={messageTone === 'success' ? successTextClassName : dangerTextClassName}>{message}</p> : null}
        </div>

        <div className="rounded-[12px] bg-[#FBFAF7] p-4">
          <p className="text-sm font-semibold text-[var(--text)]">Week context</p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">{visibleSessions.length} sessions currently planned for this athlete.</p>
        </div>
      </Surface>
    </div>
  );
}
```

- [ ] **Step 5: Run UI source test**

Run:

```bash
pnpm test -- tests/coach-planner-service.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/(app)/coach/planner tests/coach-planner-service.test.ts
git commit -m "feat: add coach planner workspace

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 5: Full Validation and Polish

**Files:**
- Modify only files touched by Tasks 1-4 if validation finds issues.

- [ ] **Step 1: Run targeted planner tests**

Run:

```bash
pnpm test -- tests/planner-draft.test.ts tests/coach-planner-service.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run:

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 3: Run lint**

Run:

```bash
pnpm lint
```

Expected: PASS. If lint flags the new `role="button"` calendar session spans, replace them with nested-safe buttons by changing day cards from `<button>` wrappers to `<div>` cards with separate “Plan here” buttons and session buttons.

- [ ] **Step 4: Run production build**

Run:

```bash
pnpm build
```

Expected: PASS.

- [ ] **Step 5: Manual source sanity check**

Run:

```bash
grep -R "/coach/builder" -n app lib tests --exclude-dir=.next
```

Expected: either no output or only the legacy redirect file `app/(app)/coach/builder/page.tsx`.

- [ ] **Step 6: Commit validation fixes**

If Task 5 required fixes, commit them:

```bash
git add app lib tests
git commit -m "fix: polish coach planner validation

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

If no files changed, skip this commit.

---

## Self-Review

- **Spec coverage:** The plan covers naming/navigation, coach calendar day-click creation, detailed from-scratch sessions, template prefill, visual continuous session preview, drag/drop reorder, copy blocks, intensity zones, durations, persistence through existing Tempo blocks, and validation.
- **Placeholder scan:** No task relies on “TBD”, “TODO”, “similar to”, or unspecified tests. Each code-producing step includes concrete code or exact replacement text.
- **Type consistency:** `PlannerSessionDraft`, `PlannerBlockDraft`, `PlannerTemplateRecord`, `coachPlannerService.saveSession`, and API payload shapes use the same names across tasks. Persistence fields match the current Prisma `Block` and `Session` schema.
