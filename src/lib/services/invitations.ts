import crypto from 'node:crypto';
import { InvitationStatus, RecordStatus, UserRole, UserStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { buildTenantInviteEmail } from '@/lib/notifications/invite-email';
import { processOutboundNotifications, queueEmailNotification } from '@/lib/notifications/outbox';

export async function createTenantInvitation(landlordId: string, email: string, propertyId?: string, unitId?: string) {
  const invitation = await prisma.tenantInvitation.create({
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

  // Best-effort: emailing must never break invite creation. sendTenantInviteEmail
  // is internally try/catch-wrapped and never throws, but we also keep the
  // create result returned unchanged regardless of email outcome.
  await sendTenantInviteEmail(invitation.id);

  return invitation;
}

/**
 * Best-effort tenant-invite email. Reuses the Phase 6 outbox: queues a PENDING
 * notification then drains it promptly so the invite sends without waiting for
 * the daily digest cron. Fully swallows any error — it must NEVER throw, so a
 * failed or unconfigured email can never break invite creation. The copyable
 * invite link on /tenants remains the fallback.
 */
export async function sendTenantInviteEmail(invitationId: string): Promise<void> {
  try {
    const invitation = await prisma.tenantInvitation.findUnique({
      where: { id: invitationId },
      include: {
        landlord: { select: { displayName: true, timezone: true } },
        unit: { include: { property: true } },
        property: true,
      },
    });
    if (!invitation) {
      console.warn(`[tenant-invite-email] failed for ${invitationId}: invitation not found`);
      return;
    }

    const locationLabel = invitation.unit
      ? `${invitation.unit.property.name} / ${invitation.unit.unitName}`
      : invitation.property
        ? invitation.property.name
        : null;

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '');
    const invitePath = `/invite/${invitation.inviteToken}`;
    const inviteUrl = appUrl ? `${appUrl}${invitePath}` : invitePath;

    const landlordName = invitation.landlord?.displayName?.trim() || 'Your landlord';
    const timezone = invitation.landlord?.timezone || 'America/Cayman';

    const { subject, body, bodyHtml } = buildTenantInviteEmail({
      landlordName,
      locationLabel,
      inviteUrl,
      expiresAt: invitation.expiresAt,
      timezone,
    });

    await queueEmailNotification({
      landlordId: invitation.landlordId,
      recipientEmail: invitation.email,
      subject,
      body,
      bodyHtml,
      notificationKind: 'TENANT_INVITE',
      relatedAlertKeys: [],
    });

    await processOutboundNotifications({ limit: 5 });
  } catch (err) {
    console.warn(`[tenant-invite-email] failed for ${invitationId}: ${err instanceof Error ? err.message : String(err)}`);
  }
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
