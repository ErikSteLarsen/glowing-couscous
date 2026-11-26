import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

// Persistence checks run against a disposable local PostgreSQL database, the
// datasource the schema declares. Each run pushes the schema into its own
// PostgreSQL schema and drops it afterwards. Set TEMPOBUILDER_TEST_DATABASE_URL to
// the disposable database (see docs/VERIFICATION.md); other targets are refused.
export const disposableDatabaseSkip = process.env.TEMPOBUILDER_TEST_DATABASE_URL
  ? undefined
  : 'set TEMPOBUILDER_TEST_DATABASE_URL to the disposable local PostgreSQL database (127.0.0.1:55432/tempo_acceptance)';

export async function withDisposableDatabase<T>(run: (db: PrismaClient) => Promise<T>): Promise<T> {
  const base = process.env.TEMPOBUILDER_TEST_DATABASE_URL;
  if (!base) throw new Error('TEMPOBUILDER_TEST_DATABASE_URL is not set.');
  const target = new URL(base);
  if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.port !== '55432' || target.pathname !== '/tempo_acceptance') {
    throw new Error('Persistence tests require the named disposable local PostgreSQL database.');
  }
  const schema = `test_${randomUUID().replaceAll('-', '')}`;
  target.searchParams.set('schema', schema);
  const url = target.toString();
  process.env.DATABASE_URL = url;
  process.env.DIRECT_URL = url;
  execFileSync(process.execPath, [
    path.join(process.cwd(), 'node_modules/prisma/build/index.js'),
    'db', 'push', '--skip-generate', '--schema', path.join(process.cwd(), 'prisma/schema.prisma'),
  ], { env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url }, stdio: 'pipe' });
  const db = new PrismaClient({ datasources: { db: { url } } });
  try {
    return await run(db);
  } finally {
    await db.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await db.$disconnect();
  }
}
