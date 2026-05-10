import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { UserRole, UserStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function timingSafeEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

async function writeBootstrapAudit(user: { id: string; email: string }) {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: user.id,
        actorEmail: user.email,
        action: 'owner_bootstrapped',
        entityType: 'User',
        entityId: user.id,
        details: { source: 'api/admin/bootstrap-owner' },
      },
    });
  } catch {
    // Audit logging should not expose internals or block emergency repair.
  }
}

export async function POST(request: Request) {
  const configuredEmail = normalizeEmail(process.env.SUPER_ADMIN_EMAIL ?? '');
  const configuredMasterKey = process.env.SUPERADMIN_MASTER_KEY ?? '';

  if (!configuredEmail || !configuredMasterKey) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const submittedMasterKey = typeof body?.masterKey === 'string' ? body.masterKey : '';

  if (!submittedMasterKey || !timingSafeEquals(submittedMasterKey, configuredMasterKey)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const user = await prisma.user.upsert({
    where: { email: configuredEmail },
    update: {
      role: UserRole.SUPERADMIN,
      status: UserStatus.ACTIVE,
      disabledAt: null,
      disabledBy: null,
      disabledById: null,
      disabledReason: null,
    },
    create: {
      email: configuredEmail,
      name: 'Platform Owner',
      fullName: 'Platform Owner',
      role: UserRole.SUPERADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  await writeBootstrapAudit(user);

  return NextResponse.json({
    ok: true,
    email: user.email,
    role: user.role,
    status: user.status,
  });
}
