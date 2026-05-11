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

function bootstrapEnabled() {
  return process.env.ENABLE_BOOTSTRAP_OWNER_ROUTE === 'true';
}

function isAllowedIp(request: Request) {
  const allowedIps = (process.env.BOOTSTRAP_ALLOWED_IPS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (allowedIps.length === 0) return true;

  const forwardedFor = request.headers.get('x-forwarded-for') ?? '';
  const requestIp = forwardedFor.split(',')[0]?.trim();

  if (!requestIp) return false;

  return allowedIps.includes(requestIp);
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
  if (!bootstrapEnabled()) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  if (!isAllowedIp(request)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

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
