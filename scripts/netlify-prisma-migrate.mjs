import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { getConnectionString } from '@netlify/database';

const migrationPath = 'prisma/migrations/20260428000000_init/migration.sql';
const BILLING_FOUNDATION_MIGRATION = '20260513_billing_foundation';

console.log('Preparing Prisma migration deploy.');
console.log(`Migration file present: ${existsSync(migrationPath)}`);
if (existsSync(migrationPath)) {
  console.log(`Migration file bytes: ${statSync(migrationPath).size}`);
}

let databaseUrl = process.env.DATABASE_URL || '';

if (!databaseUrl) {
  try {
    console.log('DATABASE_URL is not set; using Netlify Database connection string fallback.');
    databaseUrl = getConnectionString();
  } catch {
    databaseUrl = '';
  }
} else if (databaseUrl) {
  console.log('Using DATABASE_URL for Prisma migrations.');
}

if (!databaseUrl) {
  console.error('DATABASE_URL is required for Prisma migrations.');
  process.exit(1);
}

function runPrismaCommand(args, options = {}) {
  return spawnSync('npx', ['prisma', ...args], {
    stdio: options.stdio ?? 'inherit',
    shell: process.platform === 'win32',
    encoding: options.stdio === 'pipe' ? 'utf8' : undefined,
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
  });
}

function hasFailedBillingMigration(statusResult) {
  const output = `${statusResult.stdout ?? ''}\n${statusResult.stderr ?? ''}`;
  return (
    output.includes(BILLING_FOUNDATION_MIGRATION) &&
    /failed|P3009|P3018/i.test(output)
  );
}

console.log('Checking Prisma migration status before deploy.');

const statusResult = runPrismaCommand(['migrate', 'status'], { stdio: 'pipe' });

if (hasFailedBillingMigration(statusResult)) {
  console.log(`Detected failed migration state for ${BILLING_FOUNDATION_MIGRATION}; resolving as rolled back before deploy.`);

  const resolveResult = runPrismaCommand([
    'migrate',
    'resolve',
    '--rolled-back',
    BILLING_FOUNDATION_MIGRATION,
  ]);

  if ((resolveResult.status ?? 1) !== 0) {
    console.error(`Unable to resolve failed migration state for ${BILLING_FOUNDATION_MIGRATION}.`);
    process.exit(resolveResult.status ?? 1);
  }
} else if ((statusResult.status ?? 0) !== 0) {
  console.log('Prisma migration status returned a non-zero result, but no failed billing migration marker was detected. Continuing to migrate deploy so Prisma can report the authoritative error if deploy fails.');
} else {
  console.log('No failed billing migration state detected.');
}

const deployResult = runPrismaCommand(['migrate', 'deploy']);

process.exit(deployResult.status ?? 1);
