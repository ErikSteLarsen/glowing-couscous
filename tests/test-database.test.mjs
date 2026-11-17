import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

for (const explicit of [false, true]) {
  test(`database runner isolates every child datasource (${explicit ? 'explicit' : 'derived'} target)`, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'tempo-test-runner-'));
    const expected = 'postgresql://test:test@127.0.0.1:55432/tempo_acceptance';
    try {
      await writeFile(join(directory, 'pnpm'), `#!/usr/bin/env node
console.log(JSON.stringify({ args: process.argv.slice(2), database: process.env.DATABASE_URL, direct: process.env.DIRECT_URL, test: process.env.TEMPO_TEST_DATABASE_URL }));
`, { mode: 0o755 });
      const result = spawnSync(process.execPath, ['scripts/test-database.mjs'], {
        encoding: 'utf8',
        env: { ...process.env, PATH: `${directory}:${process.env.PATH}`,
          TEMPO_TEST_DATABASE_URL: explicit ? expected : '',
          DATABASE_URL: explicit ? 'postgresql://unused:unused@remote.example/production' : expected.replace('/tempo_acceptance', '/tempo_dev'),
          DIRECT_URL: 'postgresql://unused:unused@remote.example/production' },
      });
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(result.stdout), { args: ['test'], database: expected, direct: expected, test: expected });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
}
