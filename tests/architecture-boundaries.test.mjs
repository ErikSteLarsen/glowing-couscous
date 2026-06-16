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
    'app/coach/page.tsx',
    'app/coach/templates/page.tsx',
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

test('service modules expose factory constructors', async () => {
  const athleteServiceSource = await read('lib/athlete-service.ts');
  const coachRequestServiceSource = await read('lib/coach-request-service.ts');
  const coachServiceSource = await read('lib/coach-service.ts');
  const templateServiceSource = await read('lib/template-service.ts');

  assert.match(athleteServiceSource, /export function createAthleteService/);
  assert.match(coachRequestServiceSource, /export function createCoachRequestService/);
  assert.match(coachServiceSource, /export function createCoachService/);
  assert.match(templateServiceSource, /export function createTemplateService/);
});

test('project architecture skill files exist', async () => {
  const skillSource = await read('.copilot/skills/project-architecture/SKILL.md');
  const referenceSource = await read('.copilot/skills/project-architecture/REFERENCE.md');

  assert.match(skillSource, /name: project-architecture/);
  assert.match(referenceSource, /# Project Architecture Reference/);
});

test('coach request decision flow guards resolved requests and invalid route params', async () => {
  const serviceSource = await read('lib/coach-request-service.ts');
  const routeSource = await read('app/api/coach/requests/[requestId]/route.ts');

  assert.match(serviceSource, /request\.status !== 'PENDING'/);
  assert.match(serviceSource, /status: 409/);
  assert.match(routeSource, /const parsedRequestId = Number\(requestId\)/);
  assert.match(routeSource, /Number\.isInteger\(parsedRequestId\)/);
  assert.match(routeSource, /status: 400/);
});

test('athlete request services support re-opened rejected requests and shared request-state reads', async () => {
  const coachRequestServiceSource = await read('lib/coach-request-service.ts');
  const athleteServiceSource = await read('lib/athlete-service.ts');

  assert.match(coachRequestServiceSource, /existingRequest/);
  assert.match(coachRequestServiceSource, /existingRequest\.status === 'REJECTED'/);
  assert.match(coachRequestServiceSource, /db\.coachRequest\.update\(/);
  assert.match(athleteServiceSource, /loadCoachSearchState/);
  assert.match(athleteServiceSource, /listForAthlete/);
});

test('athlete onboarding surfaces request state in profile and coach-search UI', async () => {
  const profileSource = await read('app/athlete/profile/page.tsx');
  const searchSource = await read('app/athlete/find-coach/page.tsx');
  const routeSource = await read('app/api/athlete/coach-requests/route.ts');

  assert.match(profileSource, /Request pending|Waiting for/);
  assert.match(searchSource, /Request pending|Send request again|Back to profile/);
  assert.match(searchSource, /fetch\('\/api\/athlete\/coach-requests'\)/);
  assert.match(routeSource, /athleteService/);
  assert.match(routeSource, /loadCoachSearchState/);
  assert.match(routeSource, /Request already pending/);
});

test('athlete week view exposes a current-week shortcut and smarter default day selection', async () => {
  const athletePageSource = await read('app/athlete/page.tsx');
  const weekViewSource = await read('components/AthleteWeekView.tsx');

  assert.match(athletePageSource, /This week/);
  assert.match(athletePageSource, /Viewed week|Week of/);
  assert.match(athletePageSource, /key=\{plannerSnapshot\.week\.start\}/);
  assert.match(weekViewSource, /findIndex\(\(day\) => day\.sessions\.length > 0\)/);
  assert.match(weekViewSource, /useState\(initialSelectedIndex\)/);
});

test('template workflow supports duplication and library filtering', async () => {
  const templateServiceSource = await read('lib/template-service.ts');
  const duplicateRouteSource = await read('app/api/coach/templates/[templateId]/duplicate/route.ts');
  const templatesClientSource = await read('app/coach/templates/CoachTemplatesClient.tsx');

  assert.match(templateServiceSource, /duplicateForCoach/);
  assert.match(duplicateRouteSource, /templateService\.duplicateForCoach/);
  assert.match(templatesClientSource, /filterText/);
  assert.match(templatesClientSource, /Duplicate template/);
});

test('package scripts include the architecture test command', async () => {
  const packageJson = await read('package.json');

  assert.match(packageJson, /"test": "node --test tests\/\*\.test\.mjs"/);
});
