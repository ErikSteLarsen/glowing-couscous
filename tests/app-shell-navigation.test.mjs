import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) => readFile(path.join(root, relativePath), 'utf8');
const exists = async (relativePath) =>
  access(path.join(root, relativePath))
    .then(() => true)
    .catch(() => false);

test('root route and app navigation define signed-in entry points and role-aware menus', async () => {
  const homeSource = await read('app/page.tsx');
  const navSource = await read('lib/app-navigation.ts');

  assert.match(homeSource, /getCurrentUser/);
  assert.match(homeSource, /redirect\('\/login'\)/);
  assert.match(homeSource, /redirect\('\/setup'\)/);
  assert.match(homeSource, /redirect\(user\.role === 'COACH' \? '\/coach' : '\/athlete'\)/);

  assert.match(navSource, /export function getPrimaryNavigation/);
  assert.match(navSource, /hasActiveCoach/);
  assert.match(navSource, /label: 'Coach'/);
  assert.match(navSource, /label: 'Planner'/);
  assert.match(navSource, /href: '\/profile'/);
  assert.match(navSource, /href: '\/settings'/);
});

test('navigation matching prefers the most specific active destination', async () => {
  const navSource = await read('lib/app-navigation.ts');
  const sidebarSource = await read('components/AppSidebar.tsx');

  assert.match(navSource, /export function isNavigationItemActive/);
  assert.match(navSource, /candidate\.matchPrefix\.length > item\.matchPrefix\.length/);
  assert.match(sidebarSource, /isNavigationItemActive\(props\.pathname, item, navItems\)/);
});

test('coach pages rely on shared shell and keep only contextual local actions', async () => {
  const coachPageSource = await read('app/(app)/coach/page.tsx');
  const templatesPageSource = await read('app/(app)/coach/templates/page.tsx');
  const plannerPageSource = await read('app/(app)/coach/athletes/[athleteId]/page.tsx');

  assert.doesNotMatch(coachPageSource, /SignOutButton/);
  assert.match(coachPageSource, /ActionLink href="\/coach\/templates"/);
  assert.doesNotMatch(templatesPageSource, /SignOutButton/);
  assert.match(plannerPageSource, /Back to dashboard/);
  assert.doesNotMatch(plannerPageSource, /SignOutButton/);
});

test('coach athlete detail route uses coach-service detail loading instead of the legacy planner flow', async () => {
  const athleteDetailPageSource = await read('app/(app)/coach/athletes/[athleteId]/page.tsx');
  const coachServiceSource = await read('lib/coach-service.ts');

  assert.match(coachServiceSource, /async getAthleteDetail\(coachId: number, athleteId: number\)/);
  assert.match(coachServiceSource, /export async function getCoachAthleteDetail\(coachId: number, athleteId: number\)/);

  assert.match(athleteDetailPageSource, /getCoachAthleteDetail/);
  assert.match(athleteDetailPageSource, /ActionLink href=\{`\/coach\/planner\?athleteId=\$\{detail\.athlete\.id\}`\}/);
  assert.doesNotMatch(athleteDetailPageSource, /CoachPlannerClient/);
  assert.doesNotMatch(athleteDetailPageSource, /plannerService/);
  assert.doesNotMatch(athleteDetailPageSource, /Hybrid week planner|Previous week|Next week/);
});

test('athlete routes gate discovery correctly and keep onboarding state in discovery page', async () => {
  const athletePageSource = await read('app/(app)/athlete/page.tsx');
  const discoveryPageSource = await read('app/(app)/athlete/find-coach/page.tsx');
  const discoveryClientSource = await read('app/(app)/athlete/find-coach/FindCoachClient.tsx');
  const athleteServiceSource = await read('lib/athlete-service.ts');

  assert.match(athletePageSource, /redirect\('\/athlete\/find-coach'\)/);
  assert.match(discoveryPageSource, /getCurrentUser/);
  assert.match(discoveryPageSource, /redirect\('\/athlete'\)/);
  assert.match(discoveryClientSource, /Messaging coming soon/);
  assert.match(discoveryClientSource, /href="\/profile"/);
  assert.match(athleteServiceSource, /loadCoachSearchState/);
  assert.match(athleteServiceSource, /findProfileByUserId/);
});

test('moved athlete pages still avoid direct prisma access', async () => {
  for (const relativePath of [
    'app/(app)/athlete/page.tsx',
    'app/(app)/athlete/find-coach/page.tsx',
    'app/(app)/profile/page.tsx',
  ]) {
    const source = await read(relativePath);
    assert.equal(source.includes('prisma.'), false, `${relativePath} still reaches Prisma directly`);
  }
});

test('profile and settings routes use shared account service and profile alias redirect', async () => {
  const accountServiceSource = await read('lib/account-service.ts');
  const apiAuthSource = await read('lib/api-auth.ts');
  const authSessionSource = await read('lib/auth-session.ts');
  const profileRouteSource = await read('app/api/account/profile/route.ts');
  const profilePageSource = await read('app/(app)/profile/page.tsx');
  const profileClientSource = await read('app/(app)/profile/ProfileClient.tsx');
  const settingsPageSource = await read('app/(app)/settings/page.tsx');
  const settingsClientSource = await read('app/(app)/settings/SettingsClient.tsx');
  const profileAliasSource = await read('app/(app)/athlete/profile/page.tsx');
  const authSource = await read('auth.ts');

  assert.match(accountServiceSource, /export function createAccountService/);
  assert.match(accountServiceSource, /updateDisplayName/);
  assert.match(apiAuthSource, /export async function requireSignedInUser/);
  assert.doesNotMatch(authSessionSource, /if \(!session\?\.user\?\.role\) return null/);
  assert.match(authSessionSource, /parseSessionPrincipal\(session\.user\)/);
  assert.match(profileRouteSource, /accountService\.updateDisplayName/);
  assert.match(profilePageSource, /ProfileClient/);
  assert.match(profileClientSource, /useSession\(\)/);
  assert.match(settingsPageSource, /SettingsClient/);
  assert.match(settingsClientSource, /metric|notification|overview/i);
  assert.match(profileAliasSource, /redirect\('\/profile'\)/);
  assert.match(authSource, /select: \{ role: true, name: true, email: true \}/);
});

test('legacy coach planner surfaces were removed after Tempo convergence', async () => {
  const plannerServiceSource = await read('lib/planner-service.ts');

  assert.equal(
    await exists('app/(app)/coach/athletes/[athleteId]/CoachPlannerClient.tsx'),
    false,
    'legacy coach planner client should be removed',
  );
  assert.equal(
    await exists('app/api/coach/athletes/[athleteId]/planner/weeks/[weekStart]/route.ts'),
    false,
    'legacy weekly-note route should be removed',
  );
  assert.equal(
    await exists('app/api/coach/athletes/[athleteId]/planner/weeks/[weekStart]/sessions/route.ts'),
    false,
    'legacy planner session route should be removed',
  );
  assert.equal(
    await exists('app/api/coach/athletes/[athleteId]/planner/weeks/[weekStart]/copy-previous/route.ts'),
    false,
    'legacy copy-previous route should be removed',
  );
  assert.doesNotMatch(plannerServiceSource, /async load\(/);
  assert.doesNotMatch(plannerServiceSource, /save-weekly-note/);
  assert.doesNotMatch(plannerServiceSource, /copy-previous-week/);
  assert.doesNotMatch(plannerServiceSource, /set-session-completion/);
});

test('coach session routes still delegate live save and delete flows through planner-service', async () => {
  const coachSessionRouteSource = await read('app/api/coach/sessions/[sessionId]/route.ts');

  assert.match(coachSessionRouteSource, /plannerService\.forWeek/);
  assert.match(coachSessionRouteSource, /type: 'save-session'/);
  assert.match(coachSessionRouteSource, /type: 'delete-session'/);
  assert.match(coachSessionRouteSource, /select: \{ id: true, athleteId: true, date: true \}/);
});

test('coach session routes verify the target athlete belongs to the signed-in coach', async () => {
  const coachSessionRouteSource = await read('app/api/coach/sessions/[sessionId]/route.ts');

  assert.match(coachSessionRouteSource, /const \{ user, error \} = await requireCoach\(\)/);
  assert.match(coachSessionRouteSource, /const parsedSessionId = Number\(sessionId\)/);
  assert.match(coachSessionRouteSource, /Number\.isInteger\(parsedSessionId\)/);
  assert.match(coachSessionRouteSource, /coachService\./);
  assert.match(coachSessionRouteSource, /hasAthlete\(/);
});

test('template and detail entry points validate dynamic ids before loading data', async () => {
  const templateRouteSource = await read('app/api/coach/templates/[templateId]/route.ts');
  const athleteSessionPageSource = await read('app/(app)/athlete/session/[sessionId]/page.tsx');
  const athleteLivePageSource = await read('app/(app)/athlete/live/[sessionId]/page.tsx');
  const coachAthletePageSource = await read('app/(app)/coach/athletes/[athleteId]/page.tsx');

  assert.match(templateRouteSource, /const parsedTemplateId = Number\(templateId\)/);
  assert.match(templateRouteSource, /Number\.isInteger\(parsedTemplateId\)/);
  assert.match(athleteSessionPageSource, /const parsedSessionId = Number\(sessionId\)/);
  assert.match(athleteSessionPageSource, /notFound\(\)/);
  assert.match(athleteLivePageSource, /const parsedSessionId = Number\(sessionId\)/);
  assert.match(athleteLivePageSource, /notFound\(\)/);
  assert.match(coachAthletePageSource, /const parsedAthleteId = Number\(athleteId\)/);
  assert.match(coachAthletePageSource, /notFound\(\)/);
});
