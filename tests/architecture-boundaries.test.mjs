import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

test('athlete pages and coach-request routes do not access prisma directly', async () => {
  const directPrismaPaths = [
    'app/athlete/page.tsx',
    'app/athlete/profile/page.tsx',
    'app/api/coaches/route.ts',
    'app/api/athlete/coach-requests/route.ts',
    'app/api/coach/requests/route.ts',
    'app/api/coach/requests/[requestId]/route.ts',
  ];

  for (const relativePath of directPrismaPaths) {
    const source = await read(relativePath);
    assert.equal(
      source.includes('prisma.'),
      false,
      `${relativePath} still reaches Prisma directly instead of delegating to a service`,
    );
  }
});

test('coach and template services expose factory constructors', async () => {
  const coachServiceSource = await read('lib/coach-service.ts');
  const templateServiceSource = await read('lib/template-service.ts');

  assert.match(coachServiceSource, /export function createCoachService/);
  assert.match(templateServiceSource, /export function createTemplateService/);
});

test('project architecture skill files exist', async () => {
  const skillSource = await read('.copilot/skills/project-architecture/SKILL.md');
  const referenceSource = await read('.copilot/skills/project-architecture/REFERENCE.md');

  assert.match(skillSource, /name: project-architecture/);
  assert.match(referenceSource, /# Project Architecture Reference/);
});
