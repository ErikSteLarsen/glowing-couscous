import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { getMobileNavigation, isNavigationItemActive } from '../lib/app-navigation.ts';

const root = process.cwd();
const read = (relativePath) => readFile(path.join(root, relativePath), 'utf8');
const exists = async (relativePath) =>
  access(path.join(root, relativePath))
    .then(() => true)
    .catch(() => false);

test('root route and app navigation define one signed-in personal workspace', async () => {
  const homeSource = await read('app/page.tsx');
  const navSource = await read('lib/app-navigation.ts');

  assert.match(homeSource, /getCurrentUser/);
  assert.match(homeSource, /redirect\('\/login'\)/);
  assert.match(homeSource, /redirect\('\/setup'\)/);
  assert.match(homeSource, /redirect\('\/athlete'\)/);

  assert.match(navSource, /export function getPrimaryNavigation/);
  assert.match(navSource, /export function getPrimaryNavigation\(\)/);
  assert.doesNotMatch(navSource, /hasActiveCoach/);
  assert.doesNotMatch(navSource, /label: 'Coach'/);
  assert.doesNotMatch(navSource, /label: 'Athletes'/);
  assert.match(navSource, /label: 'Planner'/);
  assert.match(navSource, /label: 'Workouts'/);
  assert.match(navSource, /href: '\/athlete\/workouts'/);
  assert.match(navSource, /href: '\/athlete\/planner'/);
  assert.match(navSource, /href: '\/athlete\/templates'/);
  assert.match(navSource, /href: '\/profile'/);
  assert.match(navSource, /href: '\/settings'/);
  assert.doesNotMatch(navSource, /activeMatchPrefixes: \['\/athlete\/session', '\/athlete\/live'\]/);

  const primaryNavigationSource = navSource.split('export const profileActions')[0];
  assert.doesNotMatch(primaryNavigationSource, /Settings/);
});

test('navigation matching prefers the most specific active destination', async () => {
  const navSource = await read('lib/app-navigation.ts');
  const sidebarSource = await read('components/AppSidebar.tsx');

  assert.match(navSource, /export function isNavigationItemActive/);
  assert.match(navSource, /getMatchSpecificity\(candidate\) > getMatchSpecificity\(item\)/);
  assert.match(sidebarSource, /isNavigationItemActive\(props\.pathname, item, navItems\)/);
});

test('mobile navigation keeps the main personal training jobs directly reachable', async () => {
  const navSource = await read('lib/app-navigation.ts');
  const shellSource = await read('components/AppShell.tsx');

  assert.match(navSource, /label: 'Plan'.*href: '\/athlete\/calendar'/s);
  assert.match(navSource, /label: 'History'.*href: '\/athlete\/activity'/s);
  assert.match(shellSource, /getMobileNavigation\(user\.role\)/);
  assert.match(shellSource, /import Link from 'next\/link'/);
  assert.match(shellSource, /<Link/);
  assert.doesNotMatch(shellSource, /<a\s/);
});

test('mobile navigation maps task routes by role without leaking athlete destinations to coaches', () => {
  const athleteItems = getMobileNavigation('ATHLETE');
  assert.deepEqual(athleteItems.map((item) => item.label), ['Home', 'Plan', 'Workouts', 'History']);
  assert.equal(isNavigationItemActive('/athlete/templates', athleteItems[2], athleteItems), true);
  assert.equal(isNavigationItemActive('/athlete/import', athleteItems[3], athleteItems), true);
  assert.equal(isNavigationItemActive('/athlete/planner', athleteItems[1], athleteItems), true);
  assert.equal(isNavigationItemActive('/athlete/workouts', athleteItems[0], athleteItems), false);

  const coachItems = getMobileNavigation('COACH');
  assert.deepEqual(coachItems.map((item) => item.href), ['/coach', '/coach/planner', '/coach/workouts', '/coach/templates']);
  assert.equal(isNavigationItemActive('/coach/templates', coachItems[2], coachItems), false);
  assert.equal(isNavigationItemActive('/coach/templates', coachItems[3], coachItems), true);
  assert.equal(coachItems.some((item) => item.href.startsWith('/athlete')), false);
});

test('Workouts is a standalone library destination and session detail keeps its entry context', async () => {
  const workoutsPageSource = await read('app/(app)/athlete/workouts/page.tsx');
  const workoutsClientSource = await read('components/WorkoutLibraryClient.tsx');
  const sessionPageSource = await read('app/(app)/athlete/session/[sessionId]/page.tsx');
  const calendarPageSource = await read('app/(app)/athlete/calendar/page.tsx');
  const profileMenuSource = await read('components/AppProfileMenu.tsx');

  const navigationSource = await read('lib/app-navigation.ts');

  assert.match(workoutsPageSource, /workoutLibraryService\.listForOwner\('athlete', user\.id\)/);
  assert.doesNotMatch(workoutsPageSource, /athleteService\.loadWorkoutList|Scheduled work|SessionRow|from=workouts/);
  assert.doesNotMatch(navigationSource, /activeMatchPrefixes: \['\/athlete\/session', '\/athlete\/live'\]/);
  assert.match(sessionPageSource, /getSessionReturnTarget/);
  assert.match(sessionPageSource, /searchParams/);
  assert.match(calendarPageSource, /from=calendar/);
  assert.match(profileMenuSource, /isProfileActionActive/);
  assert.match(profileMenuSource, /aria-current=\{isActive \? 'page' : undefined\}/);
  assert.match(workoutsClientSource, /const \[editorOpen, setEditorOpen\] = useState\(\(\) => initialWorkout !== null\)/);
  assert.match(workoutsPageSource, /initialWorkoutId=\{initialWorkoutId\}/);
  assert.match(workoutsClientSource, /if \(editorOpen && isDirty\)/);
  assert.match(workoutsClientSource, /Discard unsaved changes\?/);
  assert.match(workoutsClientSource, /Keep editing/);
  assert.match(workoutsClientSource, /Discard changes/);
  assert.match(workoutsClientSource, /sticky bottom-0/);
});

test('athlete planner only places defined sources on selected dates', async () => {
  const plannerPageSource = await read('app/(app)/athlete/planner/page.tsx');
  const plannerClientSource = await read('app/(app)/athlete/planner/AthletePlannerClient.tsx');
  const templatesPageSource = await read('app/(app)/athlete/templates/page.tsx');

  assert.match(plannerPageSource, /athletePlannerService\.loadWorkspace/);
  assert.match(plannerPageSource, /AthletePlannerClient/);
  assert.doesNotMatch(plannerClientSource, /WorkoutBuilder|Start from scratch|Create session/);
  assert.match(plannerClientSource, /PlannerDesk/);
  assert.match(plannerClientSource, /calendarDays/);
  assert.match(plannerClientSource, /workout/);
  assert.match(plannerClientSource, /template/);
  assert.match(templatesPageSource, /apiBasePath="\/api\/athlete\/templates"/);
});

test('desktop sidebar stays within the viewport and owns its overflow', async () => {
  const sidebarSource = await read('components/AppSidebar.tsx');

  assert.match(
    sidebarSource,
    /overflow-y-auto.*md:sticky md:top-0 md:h-screen md:max-h-screen md:self-start/,
  );
  assert.match(sidebarSource, /flex min-h-full flex-col/);
});

test('coach pages rely on shared shell and keep only contextual local actions', async () => {
  const coachPageSource = await read('app/(app)/coach/page.tsx');
  const templatesPageSource = await read('app/(app)/coach/templates/page.tsx');
  const plannerPageSource = await read('app/(app)/coach/athletes/[athleteId]/page.tsx');

  assert.doesNotMatch(coachPageSource, /SignOutButton/);
  assert.doesNotMatch(coachPageSource, /ActionLink href="\/coach\/(templates|planner)"/);
  assert.doesNotMatch(templatesPageSource, /SignOutButton/);
  assert.doesNotMatch(plannerPageSource, /Back to dashboard|Open planner/);
  assert.doesNotMatch(plannerPageSource, /SignOutButton/);
});

test('workspace pages do not repeat sibling destinations in their headers', async () => {
  const pageSources = await Promise.all([
    'app/(app)/athlete/page.tsx',
    'app/(app)/athlete/activity/page.tsx',
    'app/(app)/athlete/templates/page.tsx',
    'app/(app)/athlete/workouts/page.tsx',
    'app/(app)/coach/page.tsx',
    'app/(app)/coach/athletes/[athleteId]/page.tsx',
    'app/(app)/coach/planner/page.tsx',
    'app/(app)/coach/templates/page.tsx',
    'app/(app)/coach/workouts/page.tsx',
  ].map(read));

  for (const source of pageSources) {
    assert.doesNotMatch(source, /actions=\{/);
  }
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

test('coach discovery is hidden while the personal workspace stays available', async () => {
  const athletePageSource = await read('app/(app)/athlete/page.tsx');
  const discoveryPageSource = await read('app/(app)/athlete/find-coach/page.tsx');
  const navigationSource = await read('lib/app-navigation.ts');

  assert.doesNotMatch(athletePageSource, /find-coach/);
  assert.match(discoveryPageSource, /redirect\('\/athlete'\)/);
  assert.doesNotMatch(navigationSource, /find-coach/);
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
  assert.match(authSource, /select: \{ role: true, name: true, email: true, sessionVersion: true \}/);
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
  assert.match(coachSessionRouteSource, /parsePositiveInteger\(sessionId\)/);
  assert.match(coachSessionRouteSource, /parsedSessionId === null/);
  assert.match(coachSessionRouteSource, /coachService\./);
  assert.match(coachSessionRouteSource, /hasAthlete\(/);
});

test('template and detail entry points validate dynamic ids before loading data', async () => {
  const templateRouteSource = await read('app/api/coach/templates/[templateId]/route.ts');
  const athleteSessionPageSource = await read('app/(app)/athlete/session/[sessionId]/page.tsx');
  const athleteLivePageSource = await read('app/(app)/athlete/live/[sessionId]/page.tsx');
  const coachAthletePageSource = await read('app/(app)/coach/athletes/[athleteId]/page.tsx');

  assert.match(templateRouteSource, /parsePositiveInteger\(templateId\)/);
  assert.match(templateRouteSource, /parsedTemplateId === null/);
  assert.match(athleteSessionPageSource, /const parsedSessionId = Number\(sessionId\)/);
  assert.match(athleteSessionPageSource, /notFound\(\)/);
  assert.match(athleteLivePageSource, /const parsedSessionId = Number\(sessionId\)/);
  assert.match(athleteLivePageSource, /notFound\(\)/);
  assert.match(coachAthletePageSource, /const parsedAthleteId = Number\(athleteId\)/);
  assert.match(coachAthletePageSource, /notFound\(\)/);
});
