import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

test('workspace geometry has one shared owner and authentication has a separate frame', async () => {
  const uiSource = await read('components/ui.tsx');
  const css = await read('app/globals.css');
  // The merged overhaul gives PageShell named width tiers; it remains the only width owner.
  assert.match(uiSource, /const pageShellWidthClasses = \{/);
  assert.match(uiSource, /export function PageShell\(/);
  assert.match(uiSource, /mx-auto w-full max-w-\[1440px\] px-5 sm:px-7 lg:px-10/);
  assert.match(css, /max-width: var\(--page-max-width\)/);
  assert.match(css, /min-height: var\(--page-header-height\)/);
  assert.match(uiSource, /export function AuthPageShell/);
});

test('production routes do not override page width and auth uses its own frame', async () => {
  for (const route of ['login', 'signup', 'setup']) {
    const source = await read(`app/(auth)/${route}/page.tsx`);
    assert.match(source, /<AuthPageShell>/);
    assert.match(source, /align="center"/);
  }
  const { readdir } = await import('node:fs/promises');
  for (const file of await readdir(path.join(root, 'app/(app)'), { recursive: true })) {
    if (!file.endsWith('.tsx')) continue;
    const source = await read(`app/(app)/${file}`);
    // Pages choose a named width tier; they must not override width or padding through className.
    assert.doesNotMatch(source, /<PageShell[^>]*className="[^"]*(?:max-w|px-|py-|gap-)/);
  }
});

test('athlete Home uses the selected Monolith header and section scale', async () => {
  const uiSource = await read('components/ui.tsx');
  const athletePageSource = await read('app/(app)/athlete/page.tsx');

  assert.match(uiSource, /<h1 className=\{pageHeadingClassName\}>\{title\}<\/h1>/);
  assert.match(athletePageSource, /<TopBar/);
  assert.match(athletePageSource, /<PageShell size="wall">/);
  assert.doesNotMatch(uiSource, /ink-topbar__title/);
});

test('session block bars show colored zones without a gray track', async () => {
  const barSource = await read('components/tempo/SessionBlockBar.tsx');

  assert.match(barSource, /bg-transparent/);
  assert.doesNotMatch(barSource, /bg-\[var\(--sunken\)\]/);
  assert.match(barSource, /intensityColor\(segment\.zone, segment\.intensityFraction\)/);
  assert.match(barSource, /segment\.intensityFraction \?\? 0\.5/);
  assert.doesNotMatch(barSource, /height: isIntensityTimeline/);
  assert.match(barSource, /authoring: 'h-40 px-1 pt-2'/);
});

test('workout authoring gates details behind basics and exposes direct block controls', async () => {
  const builderSource = await read('components/WorkoutBuilder.tsx');
  const canvasSource = await read('components/WorkoutCanvasEditor.tsx');

  // The rendered builder is the local dnd-kit editor: basics gate the details, and block controls sit in the sequence.
  assert.match(builderSource, /Start with the basics/);
  assert.match(builderSource, /basicsReady/);
  assert.match(builderSource, /Edit basics/);
  assert.match(builderSource, /Workout sequence/);
  assert.match(builderSource, /aria-label="Canvas commands"/);
  assert.match(builderSource, /Duplicate/);
  assert.match(builderSource, /Repeat once/);
  assert.match(builderSource, /aria-label=\{`Drag block \$\{index \+ 1\}`\}/);
  assert.match(builderSource, /<DragOverlay dropAnimation=\{null\}>/);
  // The remote canvas module is kept for its own consumers and keeps its direct block controls.
  assert.match(canvasSource, /createSessionEditorBlock/);
  assert.match(canvasSource, /updateSessionEditorBlock/);
  assert.match(canvasSource, /canvas-preview__session--score/);
  assert.doesNotMatch(canvasSource, /canvas-preview__concepts/);
  assert.match(canvasSource, /aria-label="Block details"/);
  assert.match(canvasSource, /max="30"/);
  assert.match(canvasSource, /Apply repeats/);
  assert.match(canvasSource, /Pause between sets/);
  assert.match(canvasSource, /Add before/);
  assert.match(canvasSource, /Add after/);
  assert.match(canvasSource, /canvas-preview__target-trigger/);
  assert.match(canvasSource, /blockTargetDialogRef/);
  assert.doesNotMatch(canvasSource, /More block details|canvas-preview__advanced/);
  assert.match(canvasSource, /Duplicate selected/);
  assert.match(canvasSource, /className="canvas-preview__preset-button" \{\.\.\.attributes\} \{\.\.\.listeners\}/);
  assert.doesNotMatch(canvasSource, /<button[^>]*className="canvas-preview__preset-grip"/);
  assert.match(canvasSource, /<DragOverlay dropAnimation=\{null\}>/);
  assert.match(canvasSource, /<ChartPlacement block=\{placementBlock\}/);
  assert.match(canvasSource, /<PresetContent zone=\{zone\}/);
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
  assert.doesNotMatch(signedInLayoutSource, /athleteService\.findProfileByUserId/);

  assert.match(shellSource, /useState\(false\)/);
  assert.match(shellSource, /AppSidebar/);
  const shellCss = await read('app/globals.css');
  assert.match(shellSource, /tempo-shell/);
  // The merged rail sizes the fixed sidebar and the content offset with one variable.
  assert.match(shellCss, /--sidebar: 14rem;/);
  assert.match(shellCss, /\.with-sidebar \{/);
  assert.match(shellCss, /data-menu-hidden="true"\] \.with-sidebar \{ padding-left: 0; \}/);
  assert.match(sidebarSource, /getPrimaryNavigation/);
  assert.match(sidebarSource, /props\.mobileOpen/);
  assert.match(sidebarSource, /onClick=\{props\.onClose\}|onClick=\{onNavigate\}/);
  assert.match(profileMenuSource, /profileActions/);
  assert.match(profileMenuSource, /SignOutButton/);
});
