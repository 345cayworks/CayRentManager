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

  const email = authEmail.toLowerCase();

  return prisma.$transaction(async (tx) => {
    const currentInvitation = await tx.tenantInvitation.findUnique({ where: { id: invitation.id } });
    if (!currentInvitation) throw new Error('Invite not found');
    if (currentInvitation.status !== InvitationStatus.PENDING) throw new Error('Invite is not pending');
    if (currentInvitation.expiresAt < new Date()) throw new Error('Invite expired');
    if (currentInvitation.email.toLowerCase() !== email) throw new Error('Email mismatch');

    const existingUser = await tx.user.findUnique({ where: { email } });
    const user = existingUser
      ? await tx.user.update({
          where: { id: existingUser.id },
          data: {
            netlifyUserId: netlifyUserId ?? existingUser.netlifyUserId,
            fullName,
            name: fullName,
            role: UserRole.TENANT,
            status: existingUser.status === UserStatus.DISABLED ? UserStatus.DISABLED : UserStatus.ACTIVE,
            lastLoginAt: new Date(),
          },
        })
      : await tx.user.create({
          data: {
            netlifyUserId,
            email,
            name: fullName,
            fullName,
            role: UserRole.TENANT,
            status: UserStatus.ACTIVE,
            lastLoginAt: new Date(),
          },
        });

    const existingTenant = await tx.tenant.findUnique({
      where: { landlordId_email: { landlordId: currentInvitation.landlordId, email } },
    });

    const tenant = existingTenant
      ? await tx.tenant.update({
          where: { id: existingTenant.id },
          data: { userId: user.id, fullName, status: RecordStatus.ACTIVE },
        })
      : await tx.tenant.create({
          data: {
            landlordId: currentInvitation.landlordId,
            userId: user.id,
            fullName,
            email,
            status: RecordStatus.ACTIVE,
          },
        });

    await tx.tenantInvitation.update({
      where: { id: currentInvitation.id },
      data: { status: InvitationStatus.ACCEPTED, acceptedAt: new Date() },
    });

    return { user, tenant };
  });
}
