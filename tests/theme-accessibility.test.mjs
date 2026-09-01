import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

test('shared form tokens and helpers support the light theme', async () => {
  const globalsSource = await read('app/globals.css');
  const uiSource = await read('components/ui.tsx');

  assert.match(globalsSource, /--field-surface:/);
  assert.match(globalsSource, /--field-border:/);
  assert.match(globalsSource, /--field-focus:/);
  assert.match(globalsSource, /--status-danger:/);
  assert.match(globalsSource, /--status-success:/);

  assert.match(uiSource, /export const formFieldClassName/);
  assert.match(uiSource, /export const formTextareaClassName/);
  assert.match(uiSource, /export const primaryButtonClassName/);
  assert.match(uiSource, /export const secondaryButtonClassName/);
  assert.match(uiSource, /export function getSegmentedChoiceClassName/);
  assert.match(uiSource, /focus-visible:ring-2/);
  assert.match(uiSource, /focus-visible:ring-\[var\(--brand\)\]/);
  assert.match(uiSource, /focus-visible:ring-offset-2/);
});

test('shared action tokens keep interactive colors explicit and reusable', async () => {
  const uiSource = await read('components/ui.tsx');
  const signOutSource = await read('components/SignOutButton.tsx');
  const requestsSource = await read('components/CoachRequestsPanel.tsx');

  assert.match(uiSource, /export const dangerButtonClassName/);
  assert.match(uiSource, /export const compactPrimaryButtonClassName/);
  assert.match(uiSource, /export const compactSecondaryButtonClassName/);
  assert.match(uiSource, /export const compactDangerButtonClassName/);
  assert.match(uiSource, /export const compactListButtonClassName/);
  assert.match(uiSource, /focus-visible:ring-2/);
  assert.doesNotMatch(uiSource, /brand-strong/);
  assert.match(signOutSource, /primaryButtonClassName/);
  assert.match(signOutSource, /secondaryButtonClassName/);
  assert.match(requestsSource, /compactDangerButtonClassName/);
});

test('anchor color inheritance stays in the base layer so link utilities can win', async () => {
  const globalsSource = await read('app/globals.css');

  assert.match(globalsSource, /@layer base[\s\S]*a\s*\{[\s\S]*color:\s*inherit;/);
  assert.doesNotMatch(globalsSource, /(?:^|\n)a \{\n  color: inherit;/);
});

test('auth pages reuse shared accessible form styling and document demo athlete access', async () => {
  const loginSource = await read('app/(auth)/login/page.tsx');
  const signupSource = await read('app/(auth)/signup/page.tsx');
  const setupSource = await read('app/(auth)/setup/page.tsx');

  for (const source of [loginSource, signupSource, setupSource]) {
    assert.doesNotMatch(source, /border-white\/10|bg-white\/5|text-slate-\d+|bg-indigo-|text-indigo-|text-red-400/);
  }

  assert.match(loginSource, /formFieldClassName/);
  assert.match(loginSource, /primaryButtonClassName/);
  assert.match(loginSource, /secondaryButtonClassName/);
  assert.match(loginSource, /Demo athlete/);
  assert.match(loginSource, /mara@demo\.local/);
  assert.match(loginSource, /demo1234/);

  assert.match(signupSource, /formFieldClassName/);
  assert.match(signupSource, /primaryButtonClassName/);
  assert.match(signupSource, /getSegmentedChoiceClassName/);

  assert.match(setupSource, /primaryButtonClassName/);
  assert.match(setupSource, /getSegmentedChoiceClassName/);
});

test('input-heavy app screens reuse shared form field helpers', async () => {
  const profileSource = await read('app/(app)/profile/ProfileClient.tsx');
  const findCoachSource = await read('app/(app)/athlete/find-coach/FindCoachClient.tsx');
  const sessionDetailSource = await read('app/(app)/athlete/session/[sessionId]/SessionDetailClient.tsx');
  const coachTemplatesSource = await read('app/(app)/coach/templates/CoachTemplatesClient.tsx');

  for (const source of [profileSource, findCoachSource, sessionDetailSource, coachTemplatesSource]) {
    assert.match(source, /form(Field|Textarea|Select)ClassName/);
  }
});
