import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

test('account profile API keeps performance metrics in the account service and outside preferences', async () => {
  const root = process.cwd();
  const [service, route, profile] = await Promise.all([
    readFile(path.join(root, 'lib/account-service.ts'), 'utf8'),
    readFile(path.join(root, 'app/api/account/profile/route.ts'), 'utf8'),
    readFile(path.join(root, 'app/(app)/profile/ProfileClient.tsx'), 'utf8'),
  ]);
  assert.match(service, /performanceProfileJson/);
  assert.match(service, /updatePerformanceProfile/);
  assert.match(route, /accountService\.updateProfile/);
  assert.match(service, /validatePerformanceProfile/);
  assert.match(profile, /Training targets/);
  assert.match(profile, /Maximum heart rate/);
  assert.match(profile, /Running pace zones/);
  const profileMethod = service.slice(service.indexOf('async updatePerformanceProfile'));
  assert.match(profileMethod, /data: \{ performanceProfileJson: serializePerformanceProfile\(profile\) \}/);
  assert.doesNotMatch(profileMethod, /data: \{ prefsJson/);
});

test('Profile shows one row per sport and keeps validation and recovery visible', async () => {
  const root = process.cwd();
  const [profile, page] = await Promise.all([
    readFile(path.join(root, 'app/(app)/profile/ProfileClient.tsx'), 'utf8'),
    readFile(path.join(root, 'app/(app)/profile/page.tsx'), 'utf8'),
  ]);
  for (const section of ['heart-rate', 'running', 'cycling', 'swimming']) {
    assert.match(profile, new RegExp(`<TargetRow id="${section}"`), `${section} has its own row`);
  }
  assert.match(profile, /<AdvancedTargets id="running"/, 'pace overrides and threshold HR sit under Advanced targets');
  assert.match(profile, /id="training-metrics"/, 'the existing #training-metrics deep link still lands on the targets');
  assert.match(profile, /showError\(profileError\)/, 'validation errors open the section holding the field');
  assert.match(profile, /changedTargetSections\(savedSnapshot, recovered\)/, 'restored drafts open the sections they change');
  assert.match(page, /href="#account"/, 'Profile has a visible Account shortcut');
});
