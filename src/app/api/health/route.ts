import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  let database: 'ok' | 'error' = 'ok';

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = 'error';
  }

  return NextResponse.json({
    app: 'ok',
    database,
    timestamp: new Date().toISOString(),
  });
}
