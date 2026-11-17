import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';

// Isolated real components: router navigation is outside this interaction test.
for (const width of [390, 1440]) test(`SDK controls preserve keyboard, focus, disabled and failed-delete behavior at ${width}px`, async () => {
  const directory = await mkdtemp(join(tmpdir(), 'tempo-ui-'));
  let browser;
  try {
    await build({ entryPoints: ['tests/fixtures/ui-sdk.tsx'], bundle: true, outfile: join(directory, 'fixture.js'), jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' }, plugins: [{ name: 'router', setup(builder) {
      builder.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'router', namespace: 'fixture' }));
      builder.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const useRouter = () => ({});' }));
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
    await page.getByRole('button', { name: 'Compare baseline and actual' }).click();
    const actual = page.getByRole('radio', { name: 'Actual', exact: true });
    await actual.waitFor();
    await actual.focus();
    await page.keyboard.press('ArrowLeft');
    assert.equal(await page.getByRole('radio', { name: 'Planned', exact: true }).getAttribute('aria-checked'), 'true');
    await page.getByRole('button', { name: 'Close comparison' }).click();
    const trigger = page.getByRole('button', { name: 'Remove session', exact: true });
    await trigger.focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('alertdialog');
    await dialog.waitFor();
    assert.equal(await page.getByRole('button', { name: 'Keep session' }).evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Shift+Tab');
    assert.equal(await dialog.evaluate(el => el.contains(document.activeElement)), true);
    await page.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
    await page.evaluate(() => {
      window.fetch = () => new Promise(resolve => { window.finishDelete = () => resolve(new Response(JSON.stringify({ error: 'Try again' }), { status: 409 })); });
    });
    await trigger.click();
    await dialog.getByRole('button', { name: 'Remove session', exact: true }).click();
    await page.keyboard.press('Escape');
    assert.equal(await dialog.isVisible(), true);
    await page.evaluate(() => window.finishDelete());
    await page.getByRole('alert').waitFor();
    assert.equal(await page.getByRole('alert').textContent(), 'Try again');
    assert.equal(await dialog.isVisible(), true);
    await page.evaluate(() => { window.fetch = async () => new Response('{}'); });
    await dialog.getByRole('button', { name: 'Remove session', exact: true }).click();
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await page.locator('output').textContent(), 'Morning run');
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    await rm(directory, { recursive: true, force: true });
  }
});
