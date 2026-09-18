import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

test('share link routes stay thin, authenticated, and service-backed', async () => {
  const createRoute = await read('app/api/share-links/route.ts');
  const intakeRoute = await read('app/api/share-links/intake/route.ts');
  const service = await read('lib/share-link-service.ts');

  assert.match(createRoute, /requireSignedInUser/);
  assert.match(createRoute, /parsePositiveInteger/);
  assert.match(createRoute, /shareLinkService/);
  assert.match(intakeRoute, /requireSignedInUser/);
  assert.match(intakeRoute, /shareLinkService/);
  assert.doesNotMatch(createRoute, /prisma\./);
  assert.doesNotMatch(intakeRoute, /prisma\./);
  assert.doesNotMatch(service, /assignmentService/);
});

test('share schema encodes named ownership relations and source deletion cascades', async () => {
  const schema = await read('prisma/schema.prisma');
  assert.match(schema, /model ShareLink/);
  assert.match(schema, /tokenHash\s+String\s+@unique/);
  assert.match(schema, /session\s+Session\?\s+@relation\("SessionShareLinks"[^\n]*onDelete: Cascade/);
  assert.match(schema, /template\s+Template\?\s+@relation\("TemplateShareLinks"[^\n]*onDelete: Cascade/);
  assert.match(schema, /createdBy\s+User\s+@relation\("ShareLinkCreator"/);
  assert.match(schema, /shareLinks\s+ShareLink\[\]\s+@relation\("SessionShareLinks"\)/);
  assert.match(schema, /shareLinks\s+ShareLink\[\]\s+@relation\("TemplateShareLinks"\)/);
});

test('public share route is outside the signed-in shell and hardens metadata', async () => {
  const page = await read('app/share/[token]/page.tsx');
  const client = await read('app/share/[token]/ShareLandingClient.tsx');
  const appLayout = await read('app/(app)/layout.tsx');

  assert.match(page, /robots: \{ index: false, follow: false \}/);
  assert.match(page, /referrer: 'no-referrer'/);
  assert.match(page, /shareLinkService\.loadPreview/);
  assert.doesNotMatch(page, /AppShell/);
  assert.doesNotMatch(page, /prisma\./);
  assert.match(client, /Use in Planner/);
  assert.match(client, /Save as Template/);
  assert.match(client, /Nothing is saved or scheduled until/);
  assert.match(client, /api\/share-links\/intake/);
  assert.match(appLayout, /AppShell/);
});

test('auth continuation preserves only local share token and action paths', async () => {
  const login = await read('app/(auth)/login/page.tsx');
  const signup = await read('app/(auth)/signup/page.tsx');
  const setup = await read('app/(auth)/setup/page.tsx');
  const middleware = await read('middleware.ts');

  for (const source of [login, signup, setup]) {
    assert.match(source, /getSafeShareCallbackPath/);
    assert.match(source, /callbackUrl/);
  }
  assert.match(middleware, /pathname\.startsWith\('\/share\/'\)/);
});

test('supported source surfaces expose share controls with copy and failure states', async () => {
  const button = await read('components/ShareLinkButton.tsx');
  const templateClient = await read('app/(app)/coach/templates/CoachTemplatesClient.tsx');
  const athleteSession = await read('app/(app)/athlete/session/[sessionId]/page.tsx');
  const coachDetail = await read('app/(app)/coach/athletes/[athleteId]/page.tsx');
  const planner = await read('app/(app)/coach/planner/PlannerClient.tsx');

  assert.match(button, /api\/share-links/);
  assert.match(button, /Creating share link/);
  assert.match(button, /Copy link/);
  assert.match(button, /Link created\. Copy it from the field/);
  assert.match(templateClient, /ShareLinkButton/);
  assert.match(athleteSession, /ShareLinkButton/);
  assert.match(coachDetail, /ShareLinkButton/);
  assert.doesNotMatch(planner, /ShareLinkButton/);
  assert.match(planner, /PlannerDesk/);
});
