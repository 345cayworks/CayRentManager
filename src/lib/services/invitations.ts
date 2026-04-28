import crypto from 'node:crypto';
import { AppRole, RecordStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

export async function createTenantInvitation(landlordId: string, email: string, propertyId?: string, unitId?: string) {
  return prisma.tenantInvitation.create({
    data: {
      landlordId,
      email: email.toLowerCase(),
      propertyId,
      unitId,
      inviteToken: crypto.randomUUID(),
      status: RecordStatus.pending,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    },
  });
}

export async function acceptTenantInvitation(token: string, authEmail: string, fullName: string) {
  const invitation = await prisma.tenantInvitation.findUnique({ where: { inviteToken: token } });

  if (!invitation) throw new Error('Invite not found');
  if (invitation.status !== RecordStatus.pending) throw new Error('Invite is not pending');
  if (invitation.expiresAt < new Date()) throw new Error('Invite expired');
  if (invitation.email.toLowerCase() !== authEmail.toLowerCase()) throw new Error('Email mismatch');

  const user = await prisma.appUser.upsert({
    where: { email: authEmail.toLowerCase() },
    update: { fullName, role: AppRole.tenant, status: RecordStatus.active },
    create: {
      email: authEmail.toLowerCase(),
      fullName,
      role: AppRole.tenant,
      status: RecordStatus.active,
    },
  });

  const tenant = await prisma.tenant.create({
    data: {
      landlordId: invitation.landlordId,
      userId: user.id,
      fullName,
      email: authEmail.toLowerCase(),
      status: RecordStatus.active,
    },
  });

  await prisma.tenantInvitation.update({
    where: { id: invitation.id },
    data: { status: RecordStatus.active, acceptedAt: new Date() },
  });

  return { user, tenant };
}
