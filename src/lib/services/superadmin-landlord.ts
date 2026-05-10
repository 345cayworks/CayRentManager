import crypto from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { RecordStatus, UserRole, UserStatus } from '@prisma/client';

export type LandlordInviteInput = {
  fullName: string;
  email: string;
  phone?: string;
  companyName: string;
  displayName?: string;
  temporaryPassword?: string;
};

export function generateTemporaryPassword() {
  return crypto.randomBytes(12).toString('base64url');
}

export function hashTemporaryPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export async function ensureLandlordTarget(targetUserId: string) {
  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) throw new Error('Landlord account not found.');
  if (target.role !== UserRole.LANDLORD) throw new Error('Target user is not a landlord.');
  return target;
}

export async function createLandlordInvite(
  actorUserId: string,
  actorEmail: string,
  input: LandlordInviteInput,
  baseUrl: string,
) {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error('Landlord email is required.');
  if (!input.fullName) throw new Error('Landlord name is required.');
  if (!input.companyName) throw new Error('Company / property group is required.');

  const temporaryPassword = input.temporaryPassword?.trim() || generateTemporaryPassword();
  const temporaryPasswordHash = hashTemporaryPassword(temporaryPassword);

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.user.findUnique({ where: { email } });

    if (existing && existing.role === UserRole.SUPERADMIN) {
      throw new Error('Cannot invite a superadmin account.');
    }

    if (existing && existing.role !== UserRole.LANDLORD) {
      throw new Error('A user with this email already exists with a different role.');
    }

    if (existing && existing.role === UserRole.LANDLORD && existing.status === UserStatus.ACTIVE) {
      throw new Error('This landlord account is already active.');
    }

    const user = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: {
            name: input.fullName,
            fullName: input.fullName,
            phone: input.phone || existing.phone,
            role: UserRole.LANDLORD,
            status: UserStatus.PENDING_INVITE,
            mustChangePassword: true,
            temporaryPasswordHash,
            temporaryPasswordSetAt: new Date(),
            disabledAt: null,
            disabledBy: null,
            disabledById: null,
            disabledReason: null,
          },
        })
      : await tx.user.create({
          data: {
            email,
            name: input.fullName,
            fullName: input.fullName,
            phone: input.phone || null,
            role: UserRole.LANDLORD,
            status: UserStatus.PENDING_INVITE,
            mustChangePassword: true,
            temporaryPasswordHash,
            temporaryPasswordSetAt: new Date(),
          },
        });

    let landlord = await tx.landlordProfile.findFirst({ where: { ownerUserId: user.id } });
    if (landlord) {
      landlord = await tx.landlordProfile.update({
        where: { id: landlord.id },
        data: {
          companyName: input.companyName,
          displayName: input.displayName ?? input.companyName,
          status: RecordStatus.ACTIVE,
        },
      });
    } else {
      landlord = await tx.landlordProfile.create({
        data: {
          ownerUserId: user.id,
          companyName: input.companyName,
          displayName: input.displayName ?? input.companyName,
          status: RecordStatus.ACTIVE,
          memberships: {
            create: {
              userId: user.id,
              role: UserRole.LANDLORD,
              status: RecordStatus.ACTIVE,
            },
          },
        },
      });
    }

    await tx.auditLog.create({
      data: {
        actorUserId,
        actorEmail,
        targetUserId: user.id,
        targetEmail: user.email,
        action: 'invite_landlord',
        entityType: 'User',
        entityId: user.id,
        landlordId: landlord.id,
        details: {
          companyName: input.companyName,
          phone: input.phone,
        },
      },
    });

    return { user, landlord };
  });

  return {
    temporaryPassword,
    invitationUrl: `${baseUrl}/register?email=${encodeURIComponent(email)}`,
    userId: result.user.id,
    email: result.user.email,
  };
}

export async function setLandlordAccountStatus(
  actorUserId: string,
  actorEmail: string,
  targetUserId: string,
  status: UserStatus,
) {
  const target = await ensureLandlordTarget(targetUserId);
  if (target.id === actorUserId) {
    throw new Error('You cannot modify your own account.');
  }

  const allowedStatuses = [UserStatus.ACTIVE, UserStatus.INACTIVE, UserStatus.SUSPENDED, UserStatus.PENDING_INVITE] as UserStatus[];
  if (!allowedStatuses.includes(status)) {
    throw new Error('Invalid landlord account status.');
  }

  const data: Record<string, unknown> = { status };
  if (status === UserStatus.ACTIVE) {
    data.disabledAt = null;
    data.disabledBy = null;
    data.disabledById = null;
    data.disabledReason = null;
  } else {
    data.disabledAt = new Date();
    data.disabledBy = actorEmail;
    data.disabledById = actorUserId;
    data.disabledReason = status === UserStatus.SUSPENDED ? 'Suspended by superadmin' : 'Deactivated by superadmin';
  }

  const update = await prisma.user.update({ where: { id: targetUserId }, data });

  const actionType =
    status === UserStatus.ACTIVE
      ? 'activate_landlord'
      : status === UserStatus.INACTIVE
      ? 'deactivate_landlord'
      : status === UserStatus.SUSPENDED
      ? 'suspend_landlord'
      : 'invite_landlord';

  await prisma.auditLog.create({
    data: {
      actorUserId,
      actorEmail,
      targetUserId: update.id,
      targetEmail: update.email,
      action: actionType,
      entityType: 'User',
      entityId: update.id,
      details: { status },
    },
  });

  return update;
}

export async function setLandlordTemporaryPassword(
  actorUserId: string,
  actorEmail: string,
  targetUserId: string,
  password?: string,
) {
  const target = await ensureLandlordTarget(targetUserId);
  if (target.role !== UserRole.LANDLORD) throw new Error('Target user is not a landlord.');

  const temporaryPassword = password?.trim() || generateTemporaryPassword();
  const temporaryPasswordHash = hashTemporaryPassword(temporaryPassword);

  const update = await prisma.user.update({
    where: { id: target.id },
    data: {
      mustChangePassword: true,
      temporaryPasswordHash,
      temporaryPasswordSetAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId,
      actorEmail,
      targetUserId: update.id,
      targetEmail: update.email,
      action: 'set_temporary_password',
      entityType: 'User',
      entityId: update.id,
      details: { temporaryPasswordSetAt: update.temporaryPasswordSetAt?.toISOString() },
    },
  });

  return { temporaryPassword, update };
}

export async function markPasswordResetRequired(
  actorUserId: string,
  actorEmail: string,
  targetUserId: string,
) {
  const target = await ensureLandlordTarget(targetUserId);

  const update = await prisma.user.update({
    where: { id: target.id },
    data: {
      mustChangePassword: true,
      temporaryPasswordSetAt: new Date(),
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId,
      actorEmail,
      targetUserId: update.id,
      targetEmail: update.email,
      action: 'reset_password',
      entityType: 'User',
      entityId: update.id,
      details: {},
    },
  });

  return update;
}
