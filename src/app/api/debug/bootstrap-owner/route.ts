import { NextResponse } from 'next/server';
import { UserRole, UserStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const configuredSecret = process.env.OWNER_BOOTSTRAP_SECRET;
  const providedSecret = new URL(request.url).searchParams.get('secret');

  if (!configuredSecret) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  if (!providedSecret || providedSecret !== configuredSecret) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

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
