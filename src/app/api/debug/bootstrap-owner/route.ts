import { NextResponse } from 'next/server';
import { UserRole, UserStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

export async function GET() {
  const user = await prisma.user.upsert({
    where: {
      email: 'info@cayworks.com',
    },
    update: {
      role: UserRole.SUPERADMIN,
      status: UserStatus.ACTIVE,
      disabledAt: null,
      disabledBy: null,
      disabledById: null,
      disabledReason: null,
    },
    create: {
      email: 'info@cayworks.com',
      name: 'Platform Owner',
      fullName: 'Platform Owner',
      role: UserRole.SUPERADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  return NextResponse.json({
    ok: true,
    email: user.email,
    role: user.role,
    status: user.status,
  });
}
