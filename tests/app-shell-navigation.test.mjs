import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) => readFile(path.join(root, relativePath), 'utf8');

test('root route and app navigation define signed-in entry points and role-aware menus', async () => {
  const homeSource = await read('app/page.tsx');
  const navSource = await read('lib/app-navigation.ts');

  assert.match(homeSource, /getCurrentUser/);
  assert.match(homeSource, /redirect\('\/login'\)/);
  assert.match(homeSource, /redirect\('\/setup'\)/);
  assert.match(homeSource, /redirect\(user\.role === 'COACH' \? '\/coach' : '\/athlete'\)/);

  assert.match(navSource, /export function getPrimaryNavigation/);
  assert.match(navSource, /hasActiveCoach/);
  assert.match(navSource, /Coach discovery/);
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
  assert.doesNotMatch(coachPageSource, /href="\/coach\/templates"/);
  assert.doesNotMatch(templatesPageSource, /SignOutButton/);
  assert.match(plannerPageSource, /Back to dashboard/);
  assert.doesNotMatch(plannerPageSource, /SignOutButton/);
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
  const profileAliasSource = await read('app/(app)/athlete/profile/page.tsx');
  const authSource = await read('auth.ts');

  assert.match(accountServiceSource, /export function createAccountService/);
  assert.match(accountServiceSource, /updateDisplayName/);
  assert.match(apiAuthSource, /export async function requireSignedInUser/);
  assert.doesNotMatch(authSessionSource, /if \(!session\?\.user\?\.role\) return null/);
  assert.match(authSessionSource, /role: isAppRole\(session\.user\.role\) \? session\.user\.role : null/);
  assert.match(profileRouteSource, /accountService\.updateDisplayName/);
  assert.match(profilePageSource, /ProfileClient/);
  assert.match(profileClientSource, /useSession\(\)/);
  assert.match(settingsPageSource, /metric|kilometer|notification/i);
  assert.match(profileAliasSource, /redirect\('\/profile'\)/);
  assert.match(authSource, /select: \{ role: true, name: true, email: true \}/);
});
