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
  assert.match(navSource, /label: 'Calendar'/);
  assert.doesNotMatch(navSource, /label: 'Planner'/);
  assert.match(navSource, /label: 'Workouts'/);
  assert.match(navSource, /href: '\/athlete\/workouts'/);
  assert.match(navSource, /href: '\/athlete\/calendar'/);
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

  assert.match(navSource, /label: 'Calendar'.*href: '\/athlete\/calendar'/s);
  assert.match(navSource, /label: 'Activity'.*href: '\/athlete\/activity'/s);
  assert.match(shellSource, /getMobileNavigation\(user\.role\)/);
  assert.match(shellSource, /import Link from 'next\/link'/);
  assert.match(shellSource, /<Link/);
  assert.doesNotMatch(shellSource, /<a\s/);
});

test('mobile navigation maps task routes by role without leaking athlete destinations to coaches', () => {
  const athleteItems = getMobileNavigation('ATHLETE');
  assert.deepEqual(athleteItems.map((item) => item.label), ['Home', 'Calendar', 'Workouts', 'Activity']);
  assert.equal(isNavigationItemActive('/athlete/templates', athleteItems[2], athleteItems), true);
  assert.equal(isNavigationItemActive('/athlete/import', athleteItems[3], athleteItems), true);
  assert.equal(isNavigationItemActive('/athlete/workouts', athleteItems[0], athleteItems), false);

  const coachItems = getMobileNavigation('COACH');
  assert.deepEqual(coachItems.map((item) => item.href), ['/coach', '/coach/planner', '/coach/workouts']);
  assert.equal(coachItems.some((item) => item.href.startsWith('/athlete')), false);
});

test('Workouts is a standalone library destination and session detail keeps its entry context', async () => {
  const workoutsPageSource = await read('app/(app)/athlete/workouts/page.tsx');
  const workoutsClientSource = await read('components/WorkoutLibraryClient.tsx');
  const sessionPageSource = await read('app/(app)/athlete/session/[sessionId]/page.tsx');
  const calendarPageSource = await read('app/(app)/athlete/calendar/AthleteCalendar.tsx');
  const calendarSource = await read('app/(app)/athlete/calendar/AthleteCalendar.tsx');
  const profileMenuSource = await read('components/AppProfileMenu.tsx');

  const navigationSource = await read('lib/app-navigation.ts');

  assert.match(workoutsPageSource, /workoutLibraryService\.listForOwner\('athlete', user\.id\)/);
  assert.doesNotMatch(workoutsPageSource, /athleteService\.loadWorkoutList|Scheduled work|SessionRow|from=workouts/);
  assert.doesNotMatch(navigationSource, /activeMatchPrefixes: \['\/athlete\/session', '\/athlete\/live'\]/);
  assert.match(sessionPageSource, /resolveBackTarget\(\{ route: 'session', from \}\)/);
  assert.match(sessionPageSource, /searchParams/);
  assert.match(calendarSource, /from=calendar/);
  assert.match(profileMenuSource, /isProfileActionActive/);
  assert.match(profileMenuSource, /aria-current=\{isActive \? 'page' : undefined\}/);
  assert.match(workoutsClientSource, /const \[editorOpen, setEditorOpen\] = useState\(\(\) => initialWorkout !== null\)/);
  assert.match(workoutsPageSource, /initialWorkoutId=\{initialWorkoutId\}/);
  assert.match(workoutsClientSource, /if \(editorOpen && isDirty\)/);
  assert.match(workoutsClientSource, /Discard unsaved changes\?/);
  assert.match(workoutsClientSource, /Keep editing/);
  assert.match(workoutsClientSource, /Discard changes/);
  assert.match(workoutsClientSource, /sticky bottom-\[var\(--mobile-nav-clearance\)\]/);
  assert.match(workoutsClientSource, /md:bottom-0/);
});

test('Workouts has one New workout entry, a visible Schedule action and sharing in the row menu', async () => {
  const workoutsClientSource = await read('components/WorkoutLibraryClient.tsx');

  assert.match(workoutsClientSource, /New workout/);
  assert.match(workoutsClientSource, /Build with guidance/);
  assert.match(workoutsClientSource, /Build from scratch/);
  assert.match(workoutsClientSource, />\s*Schedule\s*<\/Link>/);
  assert.doesNotMatch(workoutsClientSource, /Plan this|Build guided workout|Create manually/);
  assert.match(workoutsClientSource, /<MenuItem onSelect=\{share\.createLink\}>/);
  assert.doesNotMatch(workoutsClientSource, /<ShareLinkButton/);
});

test('the workout editor replaces the list and its header, returning to the list position on Back', async () => {
  const workoutsClientSource = await read('components/WorkoutLibraryClient.tsx');
  const focusSource = await read('components/FocusWorkouts.tsx');

  assert.match(workoutsClientSource, /\{editorOpen \? null : listIntro\}/);
  assert.match(workoutsClientSource, /\{!editorOpen \? <section/);
  assert.match(workoutsClientSource, /<BackButton destination="Workouts" onClick=\{\(\) => requestDraftAction\(\{ kind: 'close' \}\)\}/);
  assert.match(workoutsClientSource, /rememberListPosition/);
  assert.match(workoutsClientSource, /<MenuItem destructive onSelect=\{deleteWorkout\}>/);
  assert.match(workoutsClientSource, /window\.confirm\(`Delete "\$\{workoutName\}"/);
  assert.match(focusSource, /listIntro=\{listIntro\}/);
});

test('Calendar placement only places defined sources on selected dates', async () => {
  const plannerPageSource = await read('app/(app)/athlete/calendar/page.tsx');
  const retiredPlannerSource = await read('app/(app)/athlete/planner/page.tsx');
  const plannerClientSource = await read('app/(app)/athlete/calendar/CalendarPlacement.tsx');
  const plannerDeskSource = await read('components/PlannerDesk.tsx');
  const workoutsClientSource = await read('components/WorkoutLibraryClient.tsx');
  const templatesClientSource = await read('components/TrainingTemplatesClient.tsx');

  assert.match(plannerPageSource, /athletePlannerService\.loadWorkspace/);
  assert.match(plannerPageSource, /workoutLibraryService\.listForOwner\('athlete', userId\)/);
  assert.match(plannerPageSource, /resolvePlannerSourceSelection\(source/);
  assert.match(plannerPageSource, /<CalendarPlacement/);
  assert.match(retiredPlannerSource, /redirect\(getPlannerRedirectHref\(/);
  assert.doesNotMatch(plannerClientSource, /WorkoutBuilder|Start from scratch|Create session/);
  // Athlete placement is its own short flow; PlannerDesk stays the coach desk.
  assert.doesNotMatch(plannerClientSource, /PlannerDesk/);
  assert.match(plannerClientSource, /\/api\/athlete\/planner\/assignments/);
  assert.match(plannerPageSource, /initialSourceKey=\{initialSource\?\.key \?\? ''\}/);
  assert.match(plannerDeskSource, /templateDatesForSelection\(initialSource\.cadence \?\? 'day', initialDate\)/);
  assert.match(plannerDeskSource, /setSelectedDates\(dates\)/);
  assert.match(plannerDeskSource, /Month navigation/);
  assert.match(plannerDeskSource, /params\.set\('source', selectedSource\.key\)/);
  assert.match(workoutsClientSource, /getCalendarPlacementHref\(`workout:\$\{workout\.id\}`\)/);
  assert.match(templatesClientSource, /getCalendarPlacementHref\(`template:\$\{template\.id\}`\)/);
  assert.doesNotMatch(templatesClientSource, /\/athlete\/calendar\?add=1&template=/);
});

test('desktop sidebar stays within the viewport and owns its overflow', async () => {
  const sidebarSource = await read('components/AppSidebar.tsx');

  // The merged rail keeps the sidebar fixed to the viewport height and lets it scroll internally.
  assert.match(sidebarSource, /fixed inset-y-0 .*overflow-y-auto/);
  assert.match(sidebarSource, /flex min-h-full flex-col/);
});

test('coach pages rely on shared shell and keep only contextual local actions', async () => {
  const coachPageSource = await read('app/(app)/coach/page.tsx');
  const templatesPageSource = await read('app/(app)/athlete/templates/page.tsx');
  const plannerPageSource = await read('app/(app)/coach/athletes/[athleteId]/page.tsx');

  assert.doesNotMatch(coachPageSource, /SignOutButton/);
  assert.doesNotMatch(coachPageSource, /ActionLink href="\/coach\/(templates|planner)"/);
  assert.doesNotMatch(templatesPageSource, /SignOutButton/);
  assert.doesNotMatch(plannerPageSource, /Back to dashboard|Open planner/);
  assert.doesNotMatch(plannerPageSource, /SignOutButton/);
});

test('workspace pages keep shared navigation while Activity exposes its primary logging action', async () => {
  const pageSources = await Promise.all([
    'app/(app)/athlete/page.tsx',
    'app/(app)/athlete/activity/page.tsx',
    'app/(app)/athlete/templates/page.tsx',
    'app/(app)/athlete/workouts/page.tsx',
    'app/(app)/coach/page.tsx',
    'app/(app)/coach/athletes/[athleteId]/page.tsx',
    'app/(app)/coach/planner/page.tsx',
    'app/(app)/athlete/templates/page.tsx',
    'app/(app)/coach/workouts/page.tsx',
  ].map(read));

  for (const source of pageSources.filter((_, index) => index !== 0 && index !== 1)) {
    assert.doesNotMatch(source, /actions=\{/);
  }
  assert.match(pageSources[0], /href="\/athlete\/events"/);
  assert.match(pageSources[1], /actions=\{<AddActivity/);
  assert.doesNotMatch(pageSources[1], /<ManualActivityForm|<ActivityImportForm/);
  assert.doesNotMatch(pageSources[1], /ActionLink href="\/(athlete\/calendar|athlete\/planner)"/);
});

test('Add activity offers all three intake paths and preserves prior entry hashes', async () => {
  const [chooser, manual, imports] = await Promise.all([
    'app/(app)/athlete/activity/AddActivity.tsx',
    'app/(app)/athlete/activity/ManualActivityForm.tsx',
    'app/(app)/athlete/import/page.tsx',
  ].map(read));

  assert.match(chooser, /Log manually/);
  assert.match(chooser, /href="\/athlete\/import\?from=activity#activity-files"/);
  assert.match(chooser, /href="\/athlete\/import\?from=activity#strava"/);
  assert.match(chooser, /hash === '#log-activity'/);
  assert.match(chooser, /hash === '#import-activity'.*summary=1#import-summary/);
  assert.match(manual, /<details.*>[\s\S]*More details[\s\S]*name="distanceKm"[\s\S]*name="rpe"[\s\S]*name="notes"[\s\S]*<\/details>/);
  assert.match(manual, /Keep as a separate activity/);
  assert.match(imports, /Advanced options[\s\S]*Import summary only/);
});

test('summary-only activity outcomes do not offer structured comparison or editing', async () => {
  const activityPage = await read('app/(app)/athlete/activity/page.tsx');
  const athleteSession = await read('app/(app)/athlete/session/[sessionId]/page.tsx');
  const coachDetail = await read('app/(app)/coach/athletes/[athleteId]/page.tsx');

  assert.match(activityPage, /\['manual-unplanned', 'manual-paired', 'tcx-import', 'fit-import', 'gpx-import'\]\.includes\(activity\.metricsSource\) \? null : <SessionComparisonDialog/);
  assert.match(athleteSession, /\['manual-unplanned', 'manual-paired', 'tcx-import', 'fit-import', 'gpx-import'\]\.includes\(detail\.session\.metricsSource \?\? ''\) \? null : <ShareLinkButton/);
  assert.match(athleteSession, /<Surface id="session-outcome" className="space-y-3">/);
  assert.match(athleteSession, /\['manual-unplanned', 'manual-paired', 'tcx-import', 'fit-import', 'gpx-import'\]\.includes\(detail\.session\.metricsSource \?\? ''\) \? null : <SessionDetailClient/);
  assert.match(athleteSession, /\['manual-unplanned', 'manual-paired', 'tcx-import', 'fit-import', 'gpx-import'\]\.includes\(detail\.session\.metricsSource \?\? ''\) && detail\.session\.blocks\.length === 0/);
  assert.match(athleteSession, /Summary-only activity has no recorded workout blocks\./);
  assert.match(coachDetail, /function hasNoPlannedBaseline\(metricsSource: string \| null \| undefined\)/);
  assert.match(coachDetail, /hasNoPlannedBaseline\(session\.metricsSource\) \? null : <SessionComparisonDialog/);
  assert.match(coachDetail, /hasNoPlannedBaseline\(session\.metricsSource\) \? null : <ShareLinkButton/);
  assert.match(coachDetail, /formatDuration\(hasNoPlannedBaseline\(session\.metricsSource\) \? session\.actualDurationSec \?\? session\.durationSec : session\.durationSec\)/);
  assert.match(coachDetail, /hasNoPlannedBaseline\(session\.metricsSource\) \? 'No planned comparison'/);
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
  assert.match(profileRouteSource, /accountService\.updateProfile/);
  assert.match(profilePageSource, /ProfileClient/);
  assert.match(profileClientSource, /useSession\(\)/);
  assert.match(settingsPageSource, /SettingsClient/);
  assert.match(settingsClientSource, /metric|notification|overview/i);
  assert.match(profileAliasSource, /redirect\('\/profile'\)/);
  assert.match(authSource, /select: \{ role: true, name: true, email: true, sessionVersion: true \}/);
});

test('Settings owns Strava connection management and Import retains the inbox', async () => {
  const [settings, connections, imports, inbox] = await Promise.all([
    'app/(app)/settings/page.tsx',
    'app/(app)/settings/StravaConnectionSettings.tsx',
    'app/(app)/athlete/import/page.tsx',
    'components/StravaImportPanel.tsx',
  ].map(read));

  assert.match(settings, /<StravaConnectionSettings/);
  assert.match(connections, /id="connections"/);
  assert.match(connections, /href="\/api\/strava\/connect"/);
  assert.match(connections, /fetch\('\/api\/strava\/connection', \{ method: 'DELETE' \}/);
  assert.match(connections, /href="\/athlete\/import#strava"/);
  assert.match(imports, /redirect\(`\/settings\?strava=\$\{encodeURIComponent\(query\.strava\)\}#connections`\)/);
  assert.match(inbox, /href="\/settings#connections"/);
  assert.doesNotMatch(inbox, /\/api\/strava\/(connect|connection)\b/);
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
  const templateRouteSource = await read('app/api/athlete/templates/[templateId]/route.ts');
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
