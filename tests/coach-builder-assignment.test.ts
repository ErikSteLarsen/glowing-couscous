import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';


const root = process.cwd();
const read = (relativePath: string) => readFile(path.join(root, relativePath), 'utf8');

test('builder route redirects to the active planner and assignment API path', async () => {
  const builderPageSource = await read(['app/(app)/coach', 'builder', 'page.tsx'].join('/'));
  const assignmentRouteSource = await read('app/api/coach/assignments/route.ts');

  assert.match(builderPageSource, /redirect\('\/coach\/planner'/);
  assert.doesNotMatch(builderPageSource, /templateId/);
  assert.match(builderPageSource, /params\.set\('athleteId'/);
  assert.doesNotMatch(builderPageSource, /still in progress|next migration slice/i);
  assert.match(assignmentRouteSource, /assignmentService\.assignSourcesToAthlete/);
  assert.match(assignmentRouteSource, /parsePositiveInteger/);
});
