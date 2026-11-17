import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

for (const url of [
  'postgresql://private:secret@remote.example:55432/tempo_acceptance',
  'postgresql://private:secret@127.0.0.1:5432/tempo_acceptance',
  'postgresql://private:secret@127.0.0.1:55432/tempo_dev',
  'https://private:secret@127.0.0.1:55432/tempo_acceptance',
  'invalid',
]) {
  test(`database test runner refuses unsafe explicit target ${new URL(url === 'invalid' ? 'https://invalid' : url).pathname}`, () => {
    const result = spawnSync(process.execPath, ['scripts/test-database.mjs'], {
      encoding: 'utf8', env: { ...process.env, TEMPO_TEST_DATABASE_URL: url },
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /require localhost:55432\/tempo_acceptance/);
    assert.doesNotMatch(result.stderr + result.stdout, /private|secret|remote\.example/);
    assert.doesNotMatch(result.stdout, /tempo@|tests passed/);
  });
}
