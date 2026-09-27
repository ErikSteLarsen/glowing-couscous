import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { format } from 'date-fns';

import { createCoachPlannerService } from '../lib/coach-planner-service.ts';

const root = process.cwd();
const read = (relativePath: string) => readFile(path.join(root, relativePath), 'utf8');

const block = {
  id: 1,
  kind: 'work' as const,
  zone: 3 as const,
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
        async findMany(args: { where: Record<string, unknown> }) {
          if ('coachOwnerId' in args.where) {
            return [];
          }
          const typedWhere = args.where as { athlete: { coachId: number }; date: { gte: Date; lte: Date } };
          assert.equal(typedWhere.athlete.coachId, 2);
           assert.equal(['2026-06-22', '2026-06-01'].includes(format(typedWhere.date.gte, 'yyyy-MM-dd')), true);
           assert.equal(['2026-06-28', '2026-07-05'].includes(format(typedWhere.date.lte, 'yyyy-MM-dd')), true);
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
      trainingPlan: {
        async findMany() {
          return [];
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
  assert.equal(view.calendarDays.length, 35);
  assert.equal(view.calendarDays.find((day) => day.isoDate === '2026-06-25')?.sessions[0].id, 12);
  assert.equal(view.librarySessions.length, 0);
  assert.equal(view.trainingPlans.length, 0);
});

test('coach planner workspace loads without requiring athletes', async () => {
  const service = createCoachPlannerService({
    db: {
      user: {
        async findMany() {
          return [];
        },
      },
      template: {
        async findMany() {
          return [];
        },
      },
      session: {
        async findMany(args: { where: Record<string, unknown> }) {
          if ('coachOwnerId' in args.where) {
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
                summary: null,
                sportMetricsJson: null,
                status: 'planned',
                source: 'coach-library',
                adjusted: false,
                blocks: [],
              },
            ];
          }
          return [];
        },
      },
      trainingPlan: {
        async findMany() {
          return [
            {
              id: 7,
              coachOwnerId: 2,
              name: 'Base week',
              summary: null,
              sport: 'RUNNING',
              sessions: [
                {
                  id: 52,
                  coachOwnerId: 2,
                  athleteId: null,
                  trainingPlanId: 7,
                  date: new Date('2026-06-25T00:00:00.000Z'),
                  planWeekday: 3,
                  sport: 'RUNNING',
                  title: 'Tempo day',
                  summary: null,
                  sportMetricsJson: '{"thresholdHr":168}',
                  status: 'planned',
                  source: 'training-plan',
                  adjusted: false,
                  blocks: [],
                },
              ],
            },
          ];
        },
      },
    } as never,
  });

  const view = await service.loadWorkspace(2, '2026-06-25');

  assert.equal(view.athletes.length, 0);
  assert.equal(view.librarySessions.length, 1);
  assert.equal(view.trainingPlans.length, 1);
  assert.equal(view.trainingPlans[0].sessions[0].date, '2026-06-25');
  assert.equal(view.trainingPlans[0].sessions[0].sportMetricsJson, '{"thresholdHr":168}');
  assert.equal(view.days.length, 7);
  assert.equal(view.calendarDays.length, 35);
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
      coachBaselineJson: string;
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
        async create(args: {
          data: NonNullable<typeof calls.sessionCreate> & {
            date: Date;
            summary: string | null;
            status: string;
            adjusted: boolean;
            timeLabel: string | null;
          };
        }) {
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
  assert.equal(JSON.parse(calls.sessionCreate?.coachBaselineJson ?? '{}').title, 'Endurance build');
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

test('coach planned edits clear adjusted state and move the current assignment date', async () => {
  let updatedData: Record<string, unknown> | undefined;
  let assignmentUpdate: Record<string, unknown> | undefined;
  const service = createCoachPlannerService({
    db: {
      session: {
        async findUnique() {
          return { id: 88, athleteId: 5, adjusted: true, activity: null };
        },
        async update(args: { data: Record<string, unknown> }) {
          updatedData = args.data;
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
          return { count: 1 };
        },
      },
      assignment: {
        async upsert(args: { update: Record<string, unknown> }) {
          assignmentUpdate = args.update;
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
      scheduledDate: '2026-06-27',
      sport: 'RUNNING',
      title: 'Coach overwrite',
      summary: '',
      sourceTemplateId: null,
      blocks: [{ ...block, clientId: 'b1' }],
    },
    88,
  );

  assert.deepEqual(result, { ok: true, sessionId: 88 });
  assert.equal(updatedData?.adjusted, false);
  assert.equal((updatedData?.date as Date).toISOString().slice(0, 10), '2026-06-27');
  assert.equal((assignmentUpdate?.targetDate as Date).toISOString().slice(0, 10), '2026-06-27');
});

test('coach planner deletes only sessions owned by roster athletes', async () => {
  let deletedSessionId: number | undefined;
  const service = createCoachPlannerService({
    db: {
      session: {
        async findUnique(args: { where: { id: number } }) {
          assert.deepEqual(args.where, { id: 88 });
          return { id: 88, athleteId: 5, athlete: { coachId: 2 } };
        },
        async delete(args: { where: { id: number } }) {
          deletedSessionId = args.where.id;
          return { id: args.where.id };
        },
      },
    } as never,
  });

  const result = await service.deleteSession(2, 88);

  assert.deepEqual(result, { ok: true, sessionId: 88 });
  assert.equal(deletedSessionId, 88);
});

test('planner API routes and navigation use the coach planner service', async () => {
  const createRoute = await read('app/api/coach/planner/sessions/route.ts');
  const sessionRoute = await read('app/api/coach/planner/sessions/[sessionId]/route.ts');
  const navigation = await read('lib/app-navigation.ts');
  const oldBuilderPage = await read(['app/(app)/coach', 'builder', 'page.tsx'].join('/'));
  const templatesClient = await read('app/(app)/coach/templates/CoachTemplatesClient.tsx');

  assert.match(createRoute, /coachPlannerService\.saveSession/);
  assert.match(createRoute, /requireCoach/);
  assert.match(sessionRoute, /coachPlannerService\.saveSession/);
  assert.match(sessionRoute, /coachPlannerService\.deleteSession/);
  assert.match(navigation, /label: 'Planner'/);
  const desktopNavigation = navigation.slice(
    navigation.indexOf('export function getPrimaryNavigation'),
    navigation.indexOf('export function getMobileNavigation'),
  );
  assert.doesNotMatch(desktopNavigation, /href: '\/coach\/planner'/);
  assert.match(navigation, /label: 'Plan', description: 'Assign training', href: '\/coach\/planner'/);
  assert.match(oldBuilderPage, /redirect\('\/coach\/planner/);
  assert.match(templatesClient, /plannerHref = '\/coach\/planner'/);
  assert.doesNotMatch(templatesClient, /\$\{plannerHref\}\?templateId=/);
});

test('planner page places defined sources without embedding workout creation', async () => {
  const pageSource = await read('app/(app)/coach/planner/page.tsx');
  const clientSource = await read('app/(app)/coach/planner/PlannerClient.tsx');
  const plannerDeskSource = await read('components/PlannerDesk.tsx');

  assert.match(pageSource, /coachPlannerService\.loadWorkspace/);
  assert.match(pageSource, /PlannerClient/);
  assert.doesNotMatch(clientSource, /WorkoutBuilder|Create detailed session|Session canvas/);
  assert.match(clientSource, /PlannerDesk/);
  assert.match(plannerDeskSource, /Manage workouts/);
  assert.match(plannerDeskSource, /Manage templates/);
  assert.match(plannerDeskSource, /Assign .*template/);
});

test('planner page loads all reusable coach source types for assignment', async () => {
  const pageSource = await read('app/(app)/coach/planner/page.tsx');
  const clientSource = await read('app/(app)/coach/planner/PlannerClient.tsx');

  assert.doesNotMatch(pageSource, /No athletes available/);
  assert.match(pageSource, /librarySessions=/);
  assert.match(pageSource, /trainingPlans=/);
  assert.doesNotMatch(clientSource, /selectedWorkspaceMode|draft\.ownershipMode/);
  assert.match(clientSource, /PlannerDesk/);
});

test('coach assignment transport accepts multiple workout or template dates', async () => {
  const routeSource = await read('app/api/coach/assignments/route.ts');
  const serviceSource = await read('lib/assignment-service.ts');

  assert.match(routeSource, /body\.value\.dates/);
  assert.match(routeSource, /readAssignmentDates/);
  assert.match(routeSource, /assignSourcesToAthlete/);
  assert.match(serviceSource, /for \(const date of dates\)/);
  assert.match(serviceSource, /validateTemplateDateRange/);
  assert.match(routeSource, /training-plan/);
});

test('loadWorkspace serializes library session dates to ISO date strings', async () => {
  const service = createCoachPlannerService({
    db: {
      user: { async findMany() { return []; } },
      template: { async findMany() { return []; } },
      session: {
        async findMany(args: { where: Record<string, unknown> }) {
          if ('coachOwnerId' in args.where) {
            return [{
              id: 41, coachOwnerId: 2, athleteId: null, trainingPlanId: null,
              date: new Date('2026-06-25T00:00:00.000Z'),
              planWeekday: null, sport: 'RUNNING', title: 'Coach long run',
              summary: null, sportMetricsJson: null, source: 'coach-library',
              status: 'planned', adjusted: false, blocks: [],
            }];
          }
          return [];
        },
      },
      trainingPlan: { async findMany() { return []; } },
    } as never,
  });

  const view = await service.loadWorkspace(2, '2026-06-25');
  const session = view.librarySessions[0] as { date: unknown };
  assert.equal(typeof session.date, 'string');
  assert.equal(session.date, '2026-06-25');
});
