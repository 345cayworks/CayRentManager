import { spawnSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { getConnectionString } from '@netlify/database';

const migrationPath = 'prisma/migrations/20260428000000_init/migration.sql';

console.log('Preparing Prisma migration deploy.');
console.log(`Migration file present: ${existsSync(migrationPath)}`);
if (existsSync(migrationPath)) {
  console.log(`Migration file bytes: ${statSync(migrationPath).size}`);
}

let databaseUrl = process.env.DATABASE_URL || '';

if (!databaseUrl && process.env.NETLIFY) {
  console.log('DATABASE_URL is not set; using Netlify Database connection string fallback.');
  databaseUrl = getConnectionString();
} else if (databaseUrl) {
  console.log('Using DATABASE_URL for Prisma migrations.');
}

if (!databaseUrl) {
  console.error('DATABASE_URL is required for Prisma migrations.');
  process.exit(1);
}

const result = spawnSync('npx', ['prisma', 'migrate', 'deploy'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: {
    ...process.env,
    DATABASE_URL: databaseUrl,
  },
});

process.exit(result.status ?? 1);
