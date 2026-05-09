import { spawnSync } from 'node:child_process';
import { getConnectionString } from '@netlify/database';

const databaseUrl = process.env.DATABASE_URL || (process.env.NETLIFY ? getConnectionString() : '');

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
