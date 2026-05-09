import { RecordStatus, UserRole, UserStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

export type IdentitySyncInput = {
  netlifyUserId: string;
  email: string;
  fullName?: string | null;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function writeAudit(actorUserId: string, actorEmail: string, action: string, entityType: string, entityId: string, landlordId?: string, details = {}) {
  await prisma.auditLog.create({
    data: { actorUserId, actorEmail, action, entityType, entityId, landlordId, details },
  });
}

export async function syncIdentityUser(input: IdentitySyncInput) {
  const email = normalizeEmail(input.email);
  if (!input.netlifyUserId || !email) throw new Error('Netlify Identity id and email are required.');

  const fullName = input.fullName?.trim() || email;
  const isPrimarySuperadmin = email === 'info@cayworks.com';
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { netlifyUserId: input.netlifyUserId }] },
    include: { memberships: true },
  });

  if (existing) {
    const role = isPrimarySuperadmin ? UserRole.SUPERADMIN : existing.role;
    const status = isPrimarySuperadmin ? UserStatus.ACTIVE : existing.status;
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        netlifyUserId: input.netlifyUserId,
        email,
        name: existing.name ?? fullName,
        fullName: existing.fullName ?? fullName,
        role,
        status,
        lastLoginAt: new Date(),
        ...(isPrimarySuperadmin ? { disabledAt: null, disabledBy: null, disabledById: null, disabledReason: null } : {}),
      },
      include: { memberships: true },
    });

    await writeAudit(user.id, user.email, 'identity_user_synced', 'User', user.id);
    if (isPrimarySuperadmin) await writeAudit(user.id, user.email, 'superadmin_bootstrapped', 'User', user.id);
    return { user, createdWorkspace: false };
  }

  if (isPrimarySuperadmin) {
    const user = await prisma.user.create({
      data: {
        netlifyUserId: input.netlifyUserId,
        email,
        name: fullName,
        fullName,
        role: UserRole.SUPERADMIN,
        status: UserStatus.ACTIVE,
        lastLoginAt: new Date(),
      },
      include: { memberships: true },
    });
    await writeAudit(user.id, user.email, 'identity_user_synced', 'User', user.id);
    await writeAudit(user.id, user.email, 'superadmin_bootstrapped', 'User', user.id);
    return { user, createdWorkspace: false };
  }

  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        netlifyUserId: input.netlifyUserId,
        email,
        name: fullName,
        fullName,
        role: UserRole.LANDLORD,
        status: UserStatus.ACTIVE,
        lastLoginAt: new Date(),
      },
    });

    const landlord = await tx.landlordProfile.create({
      data: {
        ownerUserId: user.id,
        companyName: `${fullName}'s Workspace`,
        displayName: `${fullName}'s Workspace`,
        status: RecordStatus.ACTIVE,
        memberships: {
          create: { userId: user.id, role: UserRole.LANDLORD, status: RecordStatus.ACTIVE },
        },
      },
    });

    await tx.auditLog.createMany({
      data: [
        { actorUserId: user.id, actorEmail: user.email, action: 'identity_user_synced', entityType: 'User', entityId: user.id, details: {} },
        { actorUserId: user.id, actorEmail: user.email, action: 'landlord_workspace_created', entityType: 'LandlordProfile', entityId: landlord.id, landlordId: landlord.id, details: {} },
      ],
    });

    return { user, landlord };
  });

  return { user: { ...result.user, memberships: [] }, createdWorkspace: true };
}
