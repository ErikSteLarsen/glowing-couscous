import test from 'node:test';
import assert from 'node:assert/strict';

import { readApiErrorMessage, readCreatedSourceId } from '../lib/api-response.ts';
import { resolvePlannerSourceSelection } from '../lib/planner-source-selection.ts';

const catalog = { workoutIds: [12, 18], templateIds: [31, 42] };

test('planner source selection accepts listed workout and template ids', () => {
  assert.deepEqual(resolvePlannerSourceSelection('workout:12', catalog), { key: 'workout:12', tab: 'workout' });
  assert.deepEqual(resolvePlannerSourceSelection('template:42', catalog), { key: 'template:42', tab: 'template' });
});

test('planner source selection rejects malformed, unsafe, and unlisted ids', () => {
  for (const input of [undefined, ['workout:12'], 'workout:0', 'workout:01', 'template:1.5', 'template:9007199254740993', 'workout:31', 'workout:999', 'template:12', 'template:999', 'training-plan:12']) {
    assert.equal(resolvePlannerSourceSelection(input, catalog), null, String(input));
  }
});

test('API response readers validate optional messages and created ids', () => {
  assert.equal(readApiErrorMessage({ error: 'Try again.' }, 'fallback'), 'Try again.');
  assert.equal(readApiErrorMessage({ error: 12 }, 'fallback'), 'fallback');
  assert.equal(readCreatedSourceId({ sessionId: 17 }, 'sessionId'), 17);
  assert.equal(readCreatedSourceId({ templateId: 24 }, 'templateId'), 24);
  assert.equal(readCreatedSourceId({ templateId: 0 }, 'templateId'), null);
  assert.equal(readCreatedSourceId({ sessionId: Number.MAX_SAFE_INTEGER + 1 }, 'sessionId'), null);
  assert.equal(readCreatedSourceId({ sessionId: 17 }, 'templateId'), null);
});
