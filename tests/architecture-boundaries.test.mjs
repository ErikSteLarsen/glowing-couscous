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
      'app/(app)/athlete/page.tsx',
      'app/(app)/athlete/workouts/page.tsx',
      'app/(app)/athlete/find-coach/page.tsx',
    'app/(app)/athlete/profile/page.tsx',
    'app/(app)/coach/page.tsx',
    'app/(app)/coach/templates/page.tsx',
    'app/api/coaches/route.ts',
    'app/api/athlete/coach-requests/route.ts',
    'app/api/coach/requests/route.ts',
    'app/api/coach/requests/[requestId]/route.ts',
    'app/api/account/profile/route.ts',
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

test('workout flow previews share one public interactive surface', async () => {
  const [componentSource, flowlineSource, workbenchSource, trailSource] = await Promise.all([
    read('components/design/WorkoutFlowPreviews.tsx'),
    read('app/design/workout-flow/flowline/page.tsx'),
    read('app/design/workout-flow/workbench/page.tsx'),
    read('app/design/workout-flow/trail/page.tsx'),
  ]);

  for (const routeSource of [flowlineSource, workbenchSource, trailSource]) {
    assert.match(routeSource, /WorkoutFlowPreviews/);
    assert.match(routeSource, /direction=/);
  }
  assert.match(componentSource, /DndContext/);
  assert.match(componentSource, /suppressPresetClick/);
  assert.match(componentSource, /onPaletteAdd/);
  assert.match(componentSource, /aria-pressed/);
  assert.match(componentSource, /trailIntention/);
});

test('workbench previews preserve the library and inspector while varying the center surface', async () => {
  const [componentSource, terrainSource, ribbonSource, stagingSource] = await Promise.all([
    read('components/design/WorkoutFlowPreviews.tsx'),
    read('app/design/workout-flow/workbench/terrain/page.tsx'),
    read('app/design/workout-flow/workbench/ribbon/page.tsx'),
    read('app/design/workout-flow/workbench/staging/page.tsx'),
  ]);

  assert.match(terrainSource, /workbenchVariant="terrain"/);
  assert.match(ribbonSource, /workbenchVariant="ribbon"/);
  assert.match(stagingSource, /workbenchVariant="staging"/);
  assert.match(componentSource, /function WorkbenchPalette/);
  assert.match(componentSource, /function Inspector/);
  assert.match(componentSource, /function TerrainWorkbench/);
  assert.match(componentSource, /function RibbonWorkbench/);
  assert.match(componentSource, /function StagingWorkbench/);
  assert.match(componentSource, /function SelectionTray/);
  assert.match(componentSource, /function StagingShelf/);
  assert.match(componentSource, /--terrain-height/);
  assert.match(componentSource, /onToggleSelect/);
  assert.match(componentSource, /onCommitStaged/);
});

test('coach request decision flow guards resolved requests and invalid route params', async () => {
  const serviceSource = await read('lib/coach-request-service.ts');
  const routeSource = await read('app/api/coach/requests/[requestId]/route.ts');

  assert.match(serviceSource, /request\.status !== 'PENDING'/);
  assert.match(serviceSource, /status: 409/);
  assert.match(routeSource, /parsePositiveInteger\(requestId\)/);
  assert.match(routeSource, /parsedRequestId === null/);
  assert.match(routeSource, /status: 400/);
});

test('athlete request services support re-opened rejected requests and shared request-state reads', async () => {
  const coachRequestServiceSource = await read('lib/coach-request-service.ts');
  const athleteServiceSource = await read('lib/athlete-service.ts');

  assert.match(coachRequestServiceSource, /existingRequest/);
  assert.match(coachRequestServiceSource, /existingPendingRequest/);
  assert.match(coachRequestServiceSource, /existingRequest\.status === 'REJECTED'/);
  assert.match(coachRequestServiceSource, /db\.coachRequest\.update\(/);
  assert.match(athleteServiceSource, /loadCoachSearchState/);
  assert.match(athleteServiceSource, /request\.status === 'PENDING'/);
  assert.match(athleteServiceSource, /listForAthlete/);
});

test('coach discovery remains implemented but is not exposed from the personal workspace', async () => {
  const profileSource = await read('app/(app)/profile/ProfileClient.tsx');
  const discoveryPageSource = await read('app/(app)/athlete/find-coach/page.tsx');
  const searchSource = await read('app/(app)/athlete/find-coach/FindCoachClient.tsx');
  const routeSource = await read('app/api/athlete/coach-requests/route.ts');

  assert.doesNotMatch(profileSource, /Request pending|Waiting for|Find a coach/);
  assert.match(discoveryPageSource, /redirect\('\/athlete'\)/);
  assert.match(searchSource, /Request pending|Send request again|Back to profile|Wait for current request/);
  assert.match(searchSource, /fetch\('\/api\/athlete\/coach-requests'\)/);
  assert.match(routeSource, /athleteService/);
  assert.match(routeSource, /loadCoachSearchState/);
  assert.match(routeSource, /Request already pending/);
});

test('coach request UI surfaces failures and blocks duplicate actions', async () => {
  const panelSource = await read('components/CoachRequestsPanel.tsx');
  const discoverySource = await read('app/(app)/athlete/find-coach/FindCoachClient.tsx');

  assert.match(panelSource, /Failed to load athlete requests/);
  assert.match(panelSource, /actingRequestId/);
  assert.match(panelSource, /disabled=\{actingRequestId !== null\}/);
  assert.match(discoverySource, /requestingCoachId/);
  assert.match(discoverySource, /Failed to send request/);
});

test('athlete home uses the selected Monolith composition and explicit session actions', async () => {
  const athleteRouteSource = await read('app/(app)/athlete/page.tsx');
  const athletePageSource = await read('components/FocusHome.tsx');
  const sessionRowSource = await read('components/tempo/SessionRow.tsx');
  const statusBadgeSource = await read('components/tempo/StatusBadge.tsx');

  assert.match(athleteRouteSource, /<FocusHome dashboard=\{dashboard\}/);
  assert.match(athletePageSource, /Welcome/);
  assert.match(athletePageSource, /Today/);
  assert.match(athletePageSource, /This week/);
  assert.match(athletePageSource, /nextActionLabel/);
  assert.match(athletePageSource, /Nothing is scheduled today/);
  assert.match(athletePageSource, /Plan training/);
  assert.match(athletePageSource, /athlete\/session/);
  assert.match(athletePageSource, /StatusBadge/);
  assert.doesNotMatch(sessionRowSource, /StatusBadge|showStatus/);
  assert.match(statusBadgeSource, /status === 'completed'/);
  assert.match(sessionRowSource, /break-words text-\[13px\] font-semibold/);
});

test('template workflow supports duplication and library filtering', async () => {
  const templateServiceSource = await read('lib/template-service.ts');
  const duplicateRouteSource = await read('app/api/coach/templates/[templateId]/duplicate/route.ts');
  const templatesClientSource = await read('app/(app)/coach/templates/CoachTemplatesClient.tsx');

  assert.match(templateServiceSource, /duplicateForCoach/);
  assert.match(duplicateRouteSource, /templateService\.duplicateForCoach/);
  assert.match(templatesClientSource, /setMessage/);
  assert.match(templatesClientSource, /filterText/);
  assert.match(templatesClientSource, /Duplicate/);
});

test('planner places sources while libraries own live editing', async () => {
  const plannerSource = await read('app/(app)/coach/planner/PlannerClient.tsx');
  const plannerDeskSource = await read('components/PlannerDesk.tsx');
  const templatesClientSource = await read('app/(app)/coach/templates/CoachTemplatesClient.tsx');

  assert.match(plannerSource, /PlannerDesk/);
  assert.match(plannerDeskSource, /selectedDates/);
  assert.match(plannerDeskSource, /SourceDock/);
  assert.match(plannerDeskSource, /\/api\/coach\/assignments/);
  assert.doesNotMatch(plannerSource, /WorkoutBuilder|Switching workspace will reset/);
  assert.match(plannerDeskSource, /training-plan/);
  assert.match(plannerDeskSource, /Monday/);
  assert.match(templatesClientSource, /openEditor/);
  assert.match(templatesClientSource, /saveEditor/);
  assert.match(templatesClientSource, /openEditor\(template\)/);
});

test('live route delegates execution state to an accessible client', async () => {
  const livePageSource = await read('app/(app)/athlete/live/[sessionId]/page.tsx');
  const liveClientSource = await read('app/(app)/athlete/live/[sessionId]/LiveSessionClient.tsx');
  const stepperSource = await read('components/tempo/Stepper.tsx');

  assert.match(livePageSource, /LiveSessionClient/);
  assert.match(liveClientSource, /advanceExecution/);
  assert.match(liveClientSource, /previousExecution/);
  assert.match(liveClientSource, /restartExecution/);
  assert.match(liveClientSource, /completion/);
  assert.match(liveClientSource, /Previous block/);
  assert.match(liveClientSource, /Next block/);
  assert.match(stepperSource, /aria-current/);
});

test('account route avoids direct prisma access in route handlers', async () => {
  const routeSource = await read('app/api/account/profile/route.ts');
  assert.equal(routeSource.includes('prisma.'), false);
  assert.match(routeSource, /requireSignedInUser/);
  assert.match(routeSource, /accountService/);
});

test('package scripts include the architecture test command', async () => {
  const packageJson = await read('package.json');

  assert.match(
    packageJson,
    /"test": "node --experimental-strip-types --test tests\/\*\.test\.mjs tests\/\*\.test\.ts"/,
  );
});

test('planner service keeps a nonzero fallback duration for legacy blocks without a total duration', async () => {
  const plannerServiceSource = await read('lib/planner-service.ts');

  assert.match(plannerServiceSource, /fallbackDurationSec \|\| 600/);
  assert.match(plannerServiceSource, /Math\.max\(\s*fallbackDurationSec \|\| 600,\s*totalDurationSec -/);
});

test('planner service preserves adjusted state when a coach edits an existing session', async () => {
  const plannerServiceSource = await read('lib/planner-service.ts');

  assert.match(plannerServiceSource, /activity: \{ select: \{ id: true \} \}/);
  assert.match(plannerServiceSource, /adjusted: existing\.adjusted/);
  assert.match(plannerServiceSource, /Completed sessions are immutable/);
});

test('completion writes planned status through the completion service', async () => {
  const completionRouteSource = await read('app/api/athlete/sessions/[sessionId]/completion/route.ts');
  const completionServiceSource = await read('lib/athlete-completion-service.ts');

  assert.match(completionRouteSource, /athleteCompletionService\.reopenSession/);
  assert.match(completionRouteSource, /typeof isDone !== 'boolean'/);
  assert.match(completionServiceSource, /data: \{ status: 'planned', athleteNotes: retainedNotes \}/);
  assert.match(completionServiceSource, /metricsSource: 'manual-actual'/);
  assert.doesNotMatch(completionRouteSource, /prisma\./);
  assert.doesNotMatch(completionRouteSource, /session\.adjusted \? 'planned' : 'planned'/);
});

test('compatibility planner reassigns cross-week edits and protects template ownership', async () => {
  const plannerServiceSource = await read('lib/planner-service.ts');

  assert.match(plannerServiceSource, /scheduledWeekStart = startOfWeek\(scheduledDate/);
  assert.match(plannerServiceSource, /ownerId: athlete\.coachId/);
  assert.match(plannerServiceSource, /Template not found/);
  assert.match(plannerServiceSource, /Completed sessions are immutable/);
});
