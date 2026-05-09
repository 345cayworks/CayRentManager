import { PrismaClient } from '@prisma/client';
import { getConnectionString } from '@netlify/database';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function getDatasourceUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  if (process.env.NETLIFY) return getConnectionString();
  return undefined;
}

const datasourceUrl = getDatasourceUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    ...(datasourceUrl ? { datasources: { db: { url: datasourceUrl } } } : {}),
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
