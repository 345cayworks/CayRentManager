import { getConnectionString } from '@netlify/database';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

const expectedTables = [
  'User',
  'Account',
  'Session',
  'VerificationToken',
  'AppSession',
  'LandlordProfile',
  'LandlordMembership',
  'Property',
  'Unit',
  'Tenant',
  'TenantInvitation',
  'Lease',
  'Payment',
  'Expense',
  'MaintenanceRequest',
  'Document',
  'Message',
  'AuditLog',
];

export const dynamic = 'force-dynamic';

export async function GET() {
  let netlifyDatabaseFallbackAvailable = false;
  let prismaQueryOk = false;
  let prismaErrorName: string | null = null;
  let tables: string[] = [];

  try {
    netlifyDatabaseFallbackAvailable = Boolean(getConnectionString());
  } catch {
    netlifyDatabaseFallbackAvailable = false;
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    prismaQueryOk = true;

    const rows = await prisma.$queryRaw<Array<{ table_name: string }>>`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `;
    tables = rows.map((row) => row.table_name);
  } catch (error) {
    prismaErrorName = error instanceof Error ? error.name : 'UnknownError';
  }

  return NextResponse.json({
    database: {
      hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
      hasNetlifyDbUrl: Boolean(process.env.NETLIFY_DB_URL),
      netlifyDatabaseFallbackAvailable,
      prismaQueryOk,
      prismaErrorName,
      expectedTablesExist: expectedTables.every((table) => tables.includes(table)),
      expectedTables: Object.fromEntries(expectedTables.map((table) => [table, tables.includes(table)])),
    },
    auth: {
      hasAppSessionSecret: Boolean(process.env.APP_SESSION_SECRET),
    },
  });
}
