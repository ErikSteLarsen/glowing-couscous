import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

test('shared layout primitives define centered width tiers', async () => {
  const uiSource = await read('components/ui.tsx');
  const layoutSource = await read('app/layout.tsx');

  assert.match(uiSource, /size\s*=\s*'default'/);
  assert.match(uiSource, /narrow:\s*'max-w-3xl'/);
  assert.match(uiSource, /default:\s*'max-w-5xl'/);
  assert.match(uiSource, /wide:\s*'max-w-\[1140px\]'/);
  assert.match(uiSource, /wall:\s*'max-w-\[1440px\]'/);
  assert.match(uiSource, /mx-auto w-full max-w-\[1440px\] px-5 sm:px-7 lg:px-10/);
  assert.match(uiSource, /pageHeadingClassName = 'text-\[40px\] font-normal leading-none tracking-\[-0\.045em\] text-\[var\(--text\)\] max-md:text-\[34px\]'/);
  assert.match(uiSource, /sectionHeadingClassName = 'text-\[20px\] font-semibold tracking-\[-0\.02em\] text-\[var\(--text\)\]'/);
  assert.match(uiSource, /ink-topbar min-h-\[72px\]/);
  assert.match(uiSource, /align\s*=\s*'left'/);
  assert.match(uiSource, /text-center/);
  assert.doesNotMatch(layoutSource, /max-w-screen-2xl/);
});

test('page shells opt into narrow auth layouts and wider planner layouts', async () => {
  const loginSource = await read('app/(auth)/login/page.tsx');
  const signupSource = await read('app/(auth)/signup/page.tsx');
  const setupSource = await read('app/(auth)/setup/page.tsx');
  const athletePageSource = await read('app/(app)/athlete/page.tsx');
  const coachPageSource = await read('app/(app)/coach/page.tsx');
  const coachTemplatesPageSource = await read('app/(app)/coach/templates/page.tsx');
  const coachPlannerPageSource = await read('app/(app)/coach/athletes/[athleteId]/page.tsx');
  const wallPageSources = await Promise.all([
    'app/(app)/athlete/calendar/page.tsx',
    'app/(app)/athlete/planner/page.tsx',
    'app/(app)/athlete/workouts/page.tsx',
    'app/(app)/coach/planner/page.tsx',
    'app/(app)/coach/workouts/page.tsx',
  ].map(read));

  assert.match(loginSource, /<PageShell size="narrow"/);
  assert.match(loginSource, /align="center"/);
  assert.match(signupSource, /<PageShell size="narrow"/);
  assert.match(signupSource, /align="center"/);
  assert.match(setupSource, /<PageShell size="narrow"/);
  assert.match(setupSource, /align="center"/);
  assert.match(athletePageSource, /<PageShell size="wall"/);
  assert.match(coachPageSource, /<PageShell size="wide"/);
  assert.match(coachTemplatesPageSource, /<PageShell size="wide"/);
  assert.match(coachPlannerPageSource, /<PageShell size="wall"/);
  for (const pageSource of wallPageSources) {
    assert.match(pageSource, /<PageShell size="wall">/);
  }
});

test('athlete Home uses the shared header scale and section heading scale', async () => {
  const uiSource = await read('components/ui.tsx');
  const athletePageSource = await read('app/(app)/athlete/page.tsx');

  assert.match(uiSource, /<h1 className=\{pageHeadingClassName\}>\{title\}<\/h1>/);
  assert.match(athletePageSource, /className=\{sectionHeadingClassName\}>Today/);
  assert.match(athletePageSource, /className=\{sectionHeadingClassName\}>Week at a glance/);
  assert.doesNotMatch(uiSource, /ink-topbar__title/);
  assert.doesNotMatch(athletePageSource, /className="text-\[20px\] font-semibold tracking-\[-0\.02em\]/);
  assert.doesNotMatch(athletePageSource, /week-glance-heading" className="[^"]*border-b/);
});

test('session block bars show colored zones without a gray track', async () => {
  const barSource = await read('components/tempo/SessionBlockBar.tsx');

  assert.match(barSource, /bg-transparent/);
  assert.doesNotMatch(barSource, /bg-\[var\(--sunken\)\]/);
});

test('signed-in routes use grouped app shell while auth pages stay centered', async () => {
  const rootLayoutSource = await read('app/layout.tsx');
  const signedInLayoutSource = await read('app/(app)/layout.tsx');
  const shellSource = await read('components/AppShell.tsx');
  const sidebarSource = await read('components/AppSidebar.tsx');
  const profileMenuSource = await read('components/AppProfileMenu.tsx');

  assert.match(rootLayoutSource, /SessionProviderWrapper/);
  assert.doesNotMatch(rootLayoutSource, /max-w-screen-2xl|max-w-7xl/);

  assert.match(signedInLayoutSource, /redirect\('\/login'\)/);
  assert.match(signedInLayoutSource, /redirect\('\/setup'\)/);
  assert.match(signedInLayoutSource, /AppShell/);
  assert.match(signedInLayoutSource, /athleteService\.findProfileByUserId/);

  assert.match(shellSource, /useState\(false\)/);
  assert.match(shellSource, /AppSidebar/);
  assert.match(shellSource, /md:grid-cols-\[/);
  assert.match(sidebarSource, /getPrimaryNavigation/);
  assert.match(sidebarSource, /props\.mobileOpen/);
  assert.match(sidebarSource, /onClick=\{props\.onClose\}|onClick=\{onNavigate\}/);
  assert.match(profileMenuSource, /profileActions/);
  assert.match(profileMenuSource, /SignOutButton/);
});
