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
  assert.match(profile, /Training metrics/);
  assert.match(profile, /Maximum heart rate/);
  assert.match(profile, /Running pace zones/);
  const profileMethod = service.slice(service.indexOf('async updatePerformanceProfile'));
  assert.match(profileMethod, /data: \{ performanceProfileJson: serializePerformanceProfile\(profile\) \}/);
  assert.doesNotMatch(profileMethod, /data: \{ prefsJson/);
});
