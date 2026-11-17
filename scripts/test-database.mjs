import { spawnSync } from 'node:child_process';

let target;
try {
  target = new URL(process.env.TEMPO_TEST_DATABASE_URL || process.env.DATABASE_URL || '');
  if (!process.env.TEMPO_TEST_DATABASE_URL) target.pathname = '/tempo_acceptance';
  if (!['postgres:', 'postgresql:'].includes(target.protocol)
    || !['localhost', '127.0.0.1'].includes(target.hostname)
    || target.port !== '55432'
    || target.pathname !== '/tempo_acceptance') throw new Error();
} catch {
  console.error('Database tests require localhost:55432/tempo_acceptance. Set TEMPO_TEST_DATABASE_URL, or configure a local DATABASE_URL in .env.');
  process.exit(1);
}

const result = spawnSync('pnpm', ['test'], {
  stdio: 'inherit',
  env: { ...process.env, TEMPO_TEST_DATABASE_URL: target.toString() },
});
if (result.error) console.error('Could not start pnpm test.');
process.exit(result.status ?? 1);
