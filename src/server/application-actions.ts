'use server';

import crypto from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { TenantApplicationStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { createTenantInvitation } from '@/lib/services/invitations';
import { processOutboundNotifications, queueEmailNotification } from '@/lib/notifications/outbox';
import {
  canDecide,
  isLinkOpen,
  nextStatuses,
  type AppStatus,
} from '@/lib/applications/application-rules';

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function requiredText(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

async function audit(
  actorUserId: string,
  actorEmail: string,
  action: string,
  entityType: string,
  entityId: string,
  landlordId?: string,
  details = {},
) {
  await prisma.auditLog.create({
    data: { actorUserId, actorEmail, action, entityType, entityId, landlordId, details },
  });
}

const decidableDecisions: TenantApplicationStatus[] = [
  TenantApplicationStatus.UNDER_REVIEW,
  TenantApplicationStatus.APPROVED,
  TenantApplicationStatus.REJECTED,
];

/**
 * PUBLIC — no auth guard. Anyone with a valid open application link may submit.
 * Structured fields only; no file uploads.
 */
export async function submitTenantApplicationAction(formData: FormData) {
  const token = requiredText(formData, 'token');

  const link = await prisma.tenantApplicationLink.findUnique({ where: { token } });
  if (!link || !isLinkOpen({ active: link.active, expiresAt: link.expiresAt })) {
    throw new Error('This application link is no longer accepting submissions.');
  }

  const applicantName = requiredText(formData, 'applicantName');
  const email = requiredText(formData, 'email').toLowerCase();

  const phone = text(formData, 'phone') || null;
  const currentAddress = text(formData, 'currentAddress') || null;
  const employer = text(formData, 'employer') || null;
  const references = text(formData, 'references') || null;
  const notes = text(formData, 'notes') || null;

  const monthlyIncomeRaw = text(formData, 'monthlyIncome');
  const monthlyIncome =
    monthlyIncomeRaw && Number.isFinite(Number(monthlyIncomeRaw))
      ? Number(monthlyIncomeRaw)
      : null;

  const occupantsRaw = text(formData, 'occupants');
  const occupants =
    occupantsRaw && Number.isFinite(Number(occupantsRaw))
      ? Math.trunc(Number(occupantsRaw))
      : null;

  const desiredMoveInRaw = text(formData, 'desiredMoveIn');
  const desiredMoveIn = desiredMoveInRaw ? new Date(desiredMoveInRaw) : null;
  const desiredMoveInValid =
    desiredMoveIn && !Number.isNaN(desiredMoveIn.getTime()) ? desiredMoveIn : null;

  await prisma.tenantApplication.create({
    data: {
      linkId: link.id,
      landlordId: link.landlordId,
      propertyId: link.propertyId,
      unitId: link.unitId,
      applicantName,
      email,
      phone,
      currentAddress,
      employer,
      monthlyIncome,
      desiredMoveIn: desiredMoveInValid,
      occupants,
      references,
      notes,
      status: TenantApplicationStatus.SUBMITTED,
    },
  });

  // Best-effort landlord notification — never block the public submission.
  try {
    const landlord = await prisma.landlordProfile.findUnique({
      where: { id: link.landlordId },
      select: { displayName: true, email: true, owner: { select: { email: true } } },
    });
    const recipientEmail = landlord?.email || landlord?.owner?.email;
    if (recipientEmail) {
      const subject = 'New tenant application';
      const body = `${applicantName} (${email}) submitted a tenant application. Review it in your CayRentManager workspace under Applications.`;
      await queueEmailNotification({
        landlordId: link.landlordId,
        recipientEmail,
        subject,
        body,
        bodyHtml: `<p>${applicantName} (${email}) submitted a tenant application.</p><p>Review it in your CayRentManager workspace under <strong>Applications</strong>.</p>`,
        notificationKind: 'TENANT_APPLICATION',
        relatedAlertKeys: [],
      });
      await processOutboundNotifications({ limit: 5 });
    }
  } catch (err) {
    console.warn(
      `[tenant-application] notify failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  redirect(`/apply/${token}?submitted=1`);
}

export async function createApplicationLinkAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();

  const propertyId = text(formData, 'propertyId') || null;
  const unitId = text(formData, 'unitId') || null;
  const label = text(formData, 'label') || null;
  const expiresAtRaw = text(formData, 'expiresAt');
  const expiresAtDate = expiresAtRaw ? new Date(expiresAtRaw) : null;
  const expiresAt =
    expiresAtDate && !Number.isNaN(expiresAtDate.getTime()) ? expiresAtDate : null;

  if (propertyId) {
    const property = await prisma.property.findFirst({
      where: { id: propertyId, landlordId },
      select: { id: true },
    });
    if (!property) throw new Error('Property not found for this workspace.');
  }
  if (unitId) {
    const unit = await prisma.unit.findFirst({
      where: { id: unitId, landlordId },
      select: { id: true },
    });
    if (!unit) throw new Error('Unit not found for this workspace.');
  }

  const link = await prisma.tenantApplicationLink.create({
    data: {
      landlordId,
      propertyId,
      unitId,
      token: crypto.randomUUID(),
      label,
      expiresAt,
      createdByUserId: user.userId,
    },
  });

  await audit(
    user.userId,
    user.email,
    'application_link_created',
    'TenantApplicationLink',
    link.id,
    landlordId,
  );
  revalidatePath('/applications');
}

export async function toggleApplicationLinkAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const linkId = requiredText(formData, 'linkId');
  const active = text(formData, 'active') === 'true';

  const result = await prisma.tenantApplicationLink.updateMany({
    where: { id: linkId, landlordId },
    data: { active },
  });
  if (result.count !== 1) throw new Error('Application link not found for this workspace.');

  await audit(
    user.userId,
    user.email,
    'application_link_updated',
    'TenantApplicationLink',
    linkId,
    landlordId,
    { active },
  );
  revalidatePath('/applications');
}

export async function decideApplicationAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const applicationId = requiredText(formData, 'applicationId');
  const decisionRaw = requiredText(formData, 'decision');
  const decisionNote = text(formData, 'decisionNote') || null;

  const decision = decidableDecisions.find((value) => value === decisionRaw);
  if (!decision) throw new Error('Invalid decision.');

  const application = await prisma.tenantApplication.findFirst({
    where: { id: applicationId, landlordId },
  });
  if (!application) throw new Error('Application not found for this workspace.');

  const current = application.status as AppStatus;
  if (!canDecide(current)) {
    throw new Error('This application can no longer be decided.');
  }
  if (!nextStatuses(current).includes(decision as AppStatus)) {
    throw new Error('That decision is not allowed from the current status.');
  }

  let createdInvitationId: string | null = application.createdInvitationId;

  if (decision === TenantApplicationStatus.APPROVED) {
    // Best-effort: creating + emailing the invite must never break the decision.
    try {
      const invitation = await createTenantInvitation(
        landlordId,
        application.email,
        application.propertyId ?? undefined,
        application.unitId ?? undefined,
      );
      createdInvitationId = invitation.id;
    } catch (err) {
      console.warn(
        `[tenant-application] invite on approval failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  await prisma.tenantApplication.update({
    where: { id: application.id },
    data: {
      status: decision,
      decisionByUserId: user.userId,
      decisionAt: new Date(),
      decisionNote,
      createdInvitationId,
    },
  });

  await audit(
    user.userId,
    user.email,
    'application_decided',
    'TenantApplication',
    application.id,
    landlordId,
    { decision },
  );
  revalidatePath('/applications');
  redirect(`/applications/${application.id}`);
}

export async function withdrawApplicationAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const applicationId = requiredText(formData, 'applicationId');

  const application = await prisma.tenantApplication.findFirst({
    where: { id: applicationId, landlordId },
    select: { id: true, status: true },
  });
  if (!application) throw new Error('Application not found for this workspace.');
  if (!canDecide(application.status as AppStatus)) {
    throw new Error('This application can no longer be withdrawn.');
  }

  await prisma.tenantApplication.update({
    where: { id: application.id },
    data: {
      status: TenantApplicationStatus.WITHDRAWN,
      decisionByUserId: user.userId,
      decisionAt: new Date(),
    },
  });

  await audit(
    user.userId,
    user.email,
    'application_withdrawn',
    'TenantApplication',
    application.id,
    landlordId,
  );
  revalidatePath('/applications');
  redirect(`/applications/${application.id}`);
}
