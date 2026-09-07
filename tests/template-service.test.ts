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

  assert.deepEqual(result, { error: null });
  assert.equal(createArgs?.data.blocks.create[0].durationSec, 1800);
  assert.equal(createArgs?.data.blocks.create[0].sortOrder, 0);
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
