import test from 'node:test';
import assert from 'node:assert/strict';

import { createTemplateService } from '../lib/template-service.ts';

type TemplateCreateArgs = {
  data: {
    ownerId: number;
    name: string;
    sport: string;
    summary: string | null;
    blocks: {
      create: Array<{
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
  };
};

test('template service preserves explicit durationSec when saving tempo blocks', async () => {
  let createArgs: TemplateCreateArgs | undefined;

  const templateService = createTemplateService({
    db: {
      template: {
        async create(args: TemplateCreateArgs) {
          createArgs = args;
          return { id: 19 };
        },
      },
    } as never,
  });

  const result = await templateService.saveForCoach(2, {
    name: 'Tempo over-unders',
    sport: 'RUNNING',
    summary: 'Steady control',
    blocks: [
      {
        kind: 'work',
        zone: 4,
        durationSec: 1800,
        durationMinutes: 45,
        note: '3 x 10 min',
      },
    ],
  });

  assert.deepEqual(result, { error: null, templateId: 19 });
  assert.equal(createArgs?.data.blocks.create[0].durationSec, 1800);
  assert.equal(createArgs?.data.blocks.create[0].sortOrder, 0);
});

test('athlete template creation returns the created id for the Planner handoff', async () => {
  const templateService = createTemplateService({
    db: {
      template: {
        async create(args: TemplateCreateArgs) {
          assert.equal(args.data.ownerId, 7);
          return { id: 53 };
        },
      },
    } as never,
  });

  const result = await templateService.saveForOwner(7, {
    name: 'Easy week',
    sport: 'RUNNING',
    cadence: 'week',
    blocks: [{ kind: 'work', zone: 2, durationSec: 1800 }],
  });

  assert.deepEqual(result, { error: null, templateId: 53 });
});

test('template update does not return another owner’s template id', async () => {
  let transactionStarted = false;
  const templateService = createTemplateService({
    db: {
      template: {
        async findUnique() {
          return { id: 41, ownerId: 99 };
        },
      },
      $transaction() {
        transactionStarted = true;
        throw new Error('unexpected transaction');
      },
    } as never,
  });

  const result = await templateService.saveForOwner(7, {
    name: 'Private week',
    sport: 'RUNNING',
    cadence: 'week',
    blocks: [{ kind: 'work', zone: 2, durationSec: 1800 }],
  }, 41);

  assert.deepEqual(result, { error: 'Template not found.' });
  assert.equal(transactionStarted, false);
});

test('template service rejects unsupported sport values', async () => {
  const templateService = createTemplateService({
    db: {
      template: {
        async create() {
          throw new Error('template.create should not run for invalid sports');
        },
      },
    } as never,
  });

  const result = await templateService.saveForCoach(2, {
    name: 'Unsupported sport draft',
    sport: 'CYCLING',
    blocks: [
      {
        kind: 'work',
        zone: 3,
        durationSec: 900,
      },
    ],
  });

  assert.deepEqual(result, { error: 'Sport is required.' });
});

test('template service rejects unsupported cadence values', async () => {
  const templateService = createTemplateService({
    db: {
      template: {
        async create() {
          throw new Error('template.create should not run for invalid cadence');
        },
      },
    } as never,
  });

  const result = await templateService.saveForCoach(2, {
    name: 'Invalid cadence draft',
    sport: 'RUNNING',
    cadence: 'quarter' as never,
    blocks: [{ kind: 'work', zone: 3, durationSec: 900 }],
  });

  assert.deepEqual(result, { error: 'Template cadence is invalid.' });
});

test('template service rejects invalid template ids instead of creating a new template', async () => {
  let created = false;

  const templateService = createTemplateService({
    db: {
      template: {
        async create() {
          created = true;
          return { id: 22 };
        },
      },
    } as never,
  });

  const result = await templateService.saveForCoach(
    2,
    {
      name: 'Tempo over-unders',
      sport: 'RUNNING',
      summary: 'Steady control',
      blocks: [
        {
          kind: 'work',
          zone: 4,
          durationSec: 1800,
          note: '3 x 10 min',
        },
      ],
    },
    Number.NaN,
  );

  assert.deepEqual(result, { error: 'Template id is invalid.' });
  assert.equal(created, false);
});
