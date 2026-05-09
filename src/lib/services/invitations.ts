import crypto from 'node:crypto';
import { InvitationStatus, RecordStatus, UserRole, UserStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

export async function createTenantInvitation(landlordId: string, email: string, propertyId?: string, unitId?: string) {
  return prisma.tenantInvitation.create({
    data: {
      landlordId,
      email: email.toLowerCase(),
      propertyId,
      unitId,
      inviteToken: crypto.randomUUID(),
      status: InvitationStatus.PENDING,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    },
  });
}

export async function acceptTenantInvitation(token: string, authEmail: string, fullName: string, netlifyUserId?: string) {
  const invitation = await prisma.tenantInvitation.findUnique({ where: { inviteToken: token } });

  if (!invitation) throw new Error('Invite not found');
  if (invitation.status !== InvitationStatus.PENDING) throw new Error('Invite is not pending');
  if (invitation.expiresAt < new Date()) throw new Error('Invite expired');
  if (invitation.email.toLowerCase() !== authEmail.toLowerCase()) throw new Error('Email mismatch');

  const existing = await prisma.user.findUnique({ where: { email: authEmail.toLowerCase() } });
  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: {
          netlifyUserId: netlifyUserId ?? existing.netlifyUserId,
          fullName,
          name: fullName,
          role: UserRole.TENANT,
          status: existing.status === UserStatus.DISABLED ? UserStatus.DISABLED : UserStatus.ACTIVE,
          lastLoginAt: new Date(),
        },
      })
    : await prisma.user.create({
      data: {
      netlifyUserId,
      email: authEmail.toLowerCase(),
      name: fullName,
      fullName,
      role: UserRole.TENANT,
      status: UserStatus.ACTIVE,
      lastLoginAt: new Date(),
    },
  });

  const tenant = await prisma.tenant.create({
    data: {
      landlordId: invitation.landlordId,
      userId: user.id,
      fullName,
      email: authEmail.toLowerCase(),
      status: RecordStatus.ACTIVE,
    },
  });

  await prisma.tenantInvitation.update({
    where: { id: invitation.id },
    data: { status: InvitationStatus.ACCEPTED, acceptedAt: new Date() },
  });

  return { user, tenant };
}
