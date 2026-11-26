import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';

// Isolated real components: router navigation is outside this interaction test.
for (const width of [390, 1440]) test(`TempoBuilder controls preserve keyboard, focus, and workout actions at ${width}px`, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tempobuilder-ui-'));
  let browser;
  try {
    await build({ entryPoints: ['tests/fixtures/ui-sdk.tsx'], bundle: true, outfile: join(directory, 'fixture.js'), jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' }, plugins: [{ name: 'router', setup(builder) {
      builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'router', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const useRouter = () => ({ refresh() {} });' }));
    } }] });
    await writeFile(join(directory, 'index.html'), '<div id="root"></div><script src="fixture.js"></script>');
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(join(directory, 'index.html')).href);
    const setting = page.getByRole('switch', { name: 'Weekly summary' });
    await setting.focus();
    await page.keyboard.press('Space');
    assert.equal(await setting.getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByRole('switch', { name: 'Disabled setting' }).isDisabled(), true);
    await page.getByRole('button', { name: 'Compare plan and result' }).click();
    const actual = page.getByRole('radio', { name: 'Result', exact: true });
    await actual.waitFor();
    await actual.focus();
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.getByRole('radio', { name: 'Plan', exact: true }).getAttribute('aria-checked'), 'true');
    await page.getByRole('button', { name: 'Close comparison' }).click();
    const trigger = page.getByRole('button', { name: 'Remove workout', exact: true });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('alertdialog');
    await dialog.waitFor();
    assert.equal(await page.getByRole('button', { name: 'Keep workout' }).evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true);
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
    await page.evaluate(() => {
      window.fetch = () => new Promise(resolve => { window.finishDelete = () => resolve(new Response(JSON.stringify({ error: 'Try again' }), { status: 409 })); });
    });
    await trigger.click();
    await dialog.getByRole('button', { name: 'Remove workout', exact: true }).click();
    await page.keyboard.press('Escape');
    assert.equal(await dialog.isVisible(), true);
    await page.evaluate(() => window.finishDelete());
    await page.getByRole('alert').waitFor();
    assert.equal(await page.getByRole('alert').textContent(), 'Try again');
    assert.equal(await dialog.isVisible(), true);
    await page.evaluate(() => { window.fetch = async () => new Response('{}'); });
    await dialog.getByRole('button', { name: 'Remove workout', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await page.locator('output').textContent(), 'Morning run');

    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'bluetooth', {
        value: {
          requestDevice() {
            if (!navigator.userActivation.isActive) throw new Error('Missing user activation');
            throw new DOMException('Pairing denied', 'NotAllowedError');
          },
        },
      });
    });
    await page.goto(`${pathToFileURL(join(directory, 'index.html')).href}?ride`);
    const connections = page.getByRole('button', { name: 'Connections' });
    const connectionsDialog = page.getByRole('dialog', { name: 'Connections' });
    await connections.focus();
    await page.keyboard.press('Enter');
    await connectionsDialog.getByRole('button', { name: 'Connect trainer / power' }).click();
    await connectionsDialog.getByText('Pairing denied').waitFor();
    assert.equal(await connectionsDialog.getByRole('button', { name: 'Connect heart rate' }).isVisible(), true);
    assert.equal(await connectionsDialog.getByRole('button', { name: 'Connect cadence' }).isVisible(), true);
    await page.keyboard.press('Escape');
    await connectionsDialog.waitFor({ state: 'hidden' });
    assert.equal(await connections.evaluate(el => el === document.activeElement), true);
    await page.getByRole('button', { name: 'Start without devices' }).click();
    await page.getByRole('button', { name: 'Pause', exact: true }).waitFor();
    const intensity = page.getByRole('button', { name: 'Increase intensity 1%' });
    assert.equal(await intensity.isVisible(), false);
    await page.getByText('Advanced options', { exact: true }).click();
    await intensity.click();
    assert.equal(await page.getByRole('group', { name: 'Intensity' }).getByText('+1%').isVisible(), true);
    await page.getByRole('region', { name: 'Workout', exact: true }).getByText('0:01', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.reload();
    await page.getByRole('button', { name: 'Resume ride', exact: true }).click();
    await page.getByRole('button', { name: 'Resume', exact: true }).waitFor();
    await page.evaluate(() => {
      window.fetch = async () => new Response(JSON.stringify({ error: 'Save rejected' }), { status: 409 });
    });
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: 'Finish', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Save rejected' }).waitFor();
    await page.evaluate(() => {
      window.fetch = async () => new Response(JSON.stringify({ sessionId: 1 }));
    });
    await page.getByRole('button', { name: 'Try again', exact: true }).click();
    await page.getByText('Saved. The workout is marked as done.').waitFor();

    await page.goto(`${pathToFileURL(join(directory, 'index.html')).href}?live`);
    const warmup = page.getByRole('region', { name: 'Warm-up' });
    await warmup.getByText('50% FTP').waitFor();
    const workoutSteps = page.getByRole('list');
    assert.equal(await workoutSteps.isVisible(), false);
    await page.getByText('Workout blocks', { exact: true }).click();
    assert.equal(await workoutSteps.locator('[aria-current="step"]').count(), 1);
    await page.getByText('Workout blocks', { exact: true }).click();
    const controls = page.getByRole('navigation', { name: 'Workout controls' });
    await controls.getByRole('button', { name: 'Start', exact: true }).click();
    await controls.getByRole('button', { name: 'Pause', exact: true }).click();
    await page.reload();
    await controls.getByRole('button', { name: 'Resume', exact: true }).waitFor();
    const next = controls.getByRole('button', { name: 'Next block', exact: true });
    await next.click();
    await page.getByText('No set time', { exact: true }).first().waitFor();
    await controls.getByRole('button', { name: 'Previous block' }).click();
    await controls.getByRole('button', { name: 'Start', exact: true }).click();
    await page.getByRole('button', { name: 'More workout options' }).focus();
    await page.keyboard.press('Enter');
    const restart = page.getByRole('menuitem', { name: 'Restart workout' });
    await restart.waitFor();
    await restart.press('Enter');
    await controls.getByRole('button', { name: 'Start', exact: true }).waitFor();
    await next.click();
    await next.click();
    await page.getByRole('heading', { name: 'All blocks done' }).waitFor();
    assert.equal(await page.getByText('Workout marked as done.').isVisible(), false);
    await page.getByRole('button', { name: 'Mark as done' }).click();
    await page.getByText('Workout marked as done.').waitFor();
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await rm(directory, { recursive: true, force: true });
  }
});
