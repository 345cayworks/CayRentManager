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

function runPrismaCommand(args) {
  return spawnSync('npx', ['prisma', ...args], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
    },
  });
}

console.log('Resolving previously failed billing migration if necessary.');

const resolveResult = runPrismaCommand([
  'migrate',
  'resolve',
  '--rolled-back',
  BILLING_FOUNDATION_MIGRATION,
]);

if ((resolveResult.status ?? 1) === 0) {
  console.log(`Resolved migration state for ${BILLING_FOUNDATION_MIGRATION}.`);
} else {
  console.log('No failed billing migration state needed resolution.');
}

const deployResult = runPrismaCommand(['migrate', 'deploy']);

process.exit(deployResult.status ?? 1);
