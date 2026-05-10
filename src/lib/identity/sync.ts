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

export function getPrimarySuperadminEmail() {
  return normalizeEmail(process.env.SUPER_ADMIN_EMAIL ?? '');
}

export function isPrimarySuperadminEmail(email: string) {
  const primaryEmail = getPrimarySuperadminEmail();
  return Boolean(primaryEmail) && normalizeEmail(email) === primaryEmail;
}

async function writeAudit(actorUserId: string, actorEmail: string, action: string, entityType: string, entityId: string, landlordId?: string, details = {}) {
  await prisma.auditLog.create({
    data: { actorUserId, actorEmail, action, entityType, entityId, landlordId, details },
  });
}

export async function bootstrapPrimaryOwner(input: IdentitySyncInput, action = 'owner_bootstrapped') {
  const email = normalizeEmail(input.email);
  if (!getPrimarySuperadminEmail()) throw new Error('SUPER_ADMIN_EMAIL is required.');
  if (!isPrimarySuperadminEmail(email)) throw new Error('Only the primary platform owner can be bootstrapped.');
  if (!input.netlifyUserId) throw new Error('Netlify Identity id is required.');

  const fullName = input.fullName?.trim() || 'Platform Owner';
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { netlifyUserId: input.netlifyUserId }] },
    include: { memberships: true },
  });

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          netlifyUserId: input.netlifyUserId,
          email,
          name: existing.name ?? fullName,
          fullName: existing.fullName ?? fullName,
          role: UserRole.SUPERADMIN,
          status: UserStatus.ACTIVE,
          lastLoginAt: new Date(),
          disabledAt: null,
          disabledBy: null,
          disabledById: null,
          disabledReason: null,
        },
        include: { memberships: true },
      })
    : await prisma.user.create({
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

  await writeAudit(user.id, user.email, action, 'User', user.id);
  return user;
}

export async function syncIdentityUser(input: IdentitySyncInput) {
  const email = normalizeEmail(input.email);
  if (!input.netlifyUserId || !email) throw new Error('Netlify Identity id and email are required.');

  const fullName = input.fullName?.trim() || email;
  const isPrimarySuperadmin = isPrimarySuperadminEmail(email);

  if (isPrimarySuperadmin) {
    const user = await bootstrapPrimaryOwner({ ...input, fullName }, 'superadmin_bootstrapped');
    await writeAudit(user.id, user.email, 'identity_user_synced', 'User', user.id);
    return { user, createdWorkspace: false };
  }

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { netlifyUserId: input.netlifyUserId }] },
    include: { memberships: true },
  });

  if (existing) {
    const user = await prisma.user.update({
      where: { id: existing.id },
      data: {
        netlifyUserId: input.netlifyUserId,
        email,
        name: existing.name ?? fullName,
        fullName: existing.fullName ?? fullName,
        role: existing.role,
        status: existing.status,
        lastLoginAt: new Date(),
      },
      include: { memberships: true },
    });

    await writeAudit(user.id, user.email, 'identity_user_synced', 'User', user.id);
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
