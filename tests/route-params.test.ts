import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { isJsonObject, parsePositiveInteger, readJsonObject } from '../lib/route-params.ts';

const root = process.cwd();

async function readRoute(relativePath: string) {
  return readFile(path.join(root, relativePath), 'utf8');
}

test('positive integer parser accepts canonical IDs and rejects malformed values', () => {
  assert.equal(parsePositiveInteger('1'), 1);
  assert.equal(parsePositiveInteger(42), 42);
  assert.equal(parsePositiveInteger('01'), null);
  assert.equal(parsePositiveInteger('1.5'), null);
  assert.equal(parsePositiveInteger('1e2'), null);
  assert.equal(parsePositiveInteger(0), null);
  assert.equal(parsePositiveInteger(-1), null);
  assert.equal(parsePositiveInteger(Infinity), null);
  assert.equal(parsePositiveInteger(Number.MAX_SAFE_INTEGER + 1), null);
  assert.equal(parsePositiveInteger(null), null);
});

test('JSON object reader turns malformed and non-object bodies into a failed result', async () => {
  const valid = await readJsonObject(new Request('http://localhost', {
    method: 'POST',
    body: JSON.stringify({ value: 1 }),
    headers: { 'Content-Type': 'application/json' },
  }));
  assert.deepEqual(valid, { ok: true, value: { value: 1 } });
  assert.equal(isJsonObject(valid.ok ? valid.value : null), true);

  const array = await readJsonObject(new Request('http://localhost', {
    method: 'POST',
    body: '[]',
    headers: { 'Content-Type': 'application/json' },
  }));
  assert.deepEqual(array, { ok: false });

  const malformed = await readJsonObject(new Request('http://localhost', {
    method: 'POST',
    body: '{',
    headers: { 'Content-Type': 'application/json' },
  }));
  assert.deepEqual(malformed, { ok: false });
});

test('protected API routes declare a role guard', async () => {
  const protectedRoutes = [
    'app/api/account/profile/route.ts',
    'app/api/coaches/route.ts',
    'app/api/athlete/calendar/route.ts',
    'app/api/athlete/coach-requests/route.ts',
    'app/api/athlete/planner/sessions/route.ts',
    'app/api/athlete/planner/sessions/[sessionId]/route.ts',
    'app/api/athlete/sessions/[sessionId]/completion/route.ts',
    'app/api/athlete/templates/route.ts',
    'app/api/athlete/templates/[templateId]/route.ts',
    'app/api/athlete/templates/[templateId]/duplicate/route.ts',
    'app/api/coach/assignments/route.ts',
    'app/api/coach/planner/library-sessions/route.ts',
    'app/api/coach/planner/library-sessions/[sessionId]/route.ts',
    'app/api/coach/planner/sessions/route.ts',
    'app/api/coach/planner/sessions/[sessionId]/route.ts',
    'app/api/coach/planner/training-plans/route.ts',
    'app/api/coach/planner/training-plans/[planId]/route.ts',
    'app/api/coach/planner/training-plans/[planId]/sessions/route.ts',
    'app/api/coach/planner/training-plans/[planId]/sessions/[sessionId]/route.ts',
    'app/api/coach/requests/route.ts',
    'app/api/coach/requests/[requestId]/route.ts',
    'app/api/coach/sessions/[sessionId]/route.ts',
    'app/api/coach/templates/route.ts',
    'app/api/coach/templates/[templateId]/route.ts',
    'app/api/coach/templates/[templateId]/duplicate/route.ts',
  ];

  for (const routePath of protectedRoutes) {
    const source = await readRoute(routePath);
    assert.match(source, /require(?:Coach|Athlete|SignedInUser)/, routePath);
  }
});

test('dynamic API routes use strict positive-integer parsing', async () => {
  const dynamicRoutes = [
    ['app/api/athlete/sessions/[sessionId]/completion/route.ts', 2],
    ['app/api/athlete/planner/sessions/[sessionId]/route.ts', 3],
    ['app/api/athlete/templates/[templateId]/route.ts', 3],
    ['app/api/athlete/templates/[templateId]/duplicate/route.ts', 2],
    ['app/api/coach/planner/library-sessions/[sessionId]/route.ts', 3],
    ['app/api/coach/planner/sessions/[sessionId]/route.ts', 3],
    ['app/api/coach/planner/training-plans/[planId]/route.ts', 3],
    ['app/api/coach/planner/training-plans/[planId]/sessions/route.ts', 2],
    ['app/api/coach/planner/training-plans/[planId]/sessions/[sessionId]/route.ts', 5],
    ['app/api/coach/requests/[requestId]/route.ts', 2],
    ['app/api/coach/sessions/[sessionId]/route.ts', 3],
    ['app/api/coach/templates/[templateId]/route.ts', 3],
    ['app/api/coach/templates/[templateId]/duplicate/route.ts', 2],
  ] as const;

  for (const [routePath, expectedParserUses] of dynamicRoutes) {
    const source = await readRoute(routePath);
    assert.equal(source.match(/parsePositiveInteger/g)?.length, expectedParserUses, routePath);
  }
});
