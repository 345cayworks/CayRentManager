'use server';

import { revalidatePath } from 'next/cache';
import { LeaseEventType, LeaseNoticeType, LeaseRenewalStatus } from '@prisma/client';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { requireOwnedLease } from '@/lib/auth/ownership';
import { prisma } from '@/lib/db/prisma';

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function requiredText(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) throw new Error(`${key} is required.`);
  return value;
}

function positiveNumber(value: string, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error(`${label} must be a positive number.`);
  return parsed;
}

function validEnumValue<T extends Record<string, string>>(enumObject: T, value: string, label: string) {
  if (!Object.values(enumObject).includes(value)) throw new Error(`Invalid ${label}.`);
  return value as T[keyof T];
}

async function audit(actorUserId: string, actorEmail: string, action: string, entityType: string, entityId: string, landlordId?: string, details = {}) {
  await prisma.auditLog.create({
    data: { actorUserId, actorEmail, action, entityType, entityId, landlordId, details },
  });
}

export async function createLeaseEventAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const leaseId = requiredText(formData, 'leaseId');
  await requireOwnedLease(landlordId, leaseId);

  const eventType = validEnumValue(LeaseEventType, requiredText(formData, 'eventType'), 'lease event type');
  const eventDate = new Date(requiredText(formData, 'eventDate'));
  if (Number.isNaN(eventDate.getTime())) throw new Error('Event date is invalid.');

  const event = await prisma.leaseEvent.create({
    data: {
      landlordId,
      leaseId,
      eventType,
      eventDate,
      description: text(formData, 'description') || null,
    },
  });

  await audit(user.userId, user.email, 'lease_event.created', 'LeaseEvent', event.id, landlordId, { leaseId, eventType });
  revalidatePath('/leases');
  revalidatePath(`/leases/${leaseId}`);
}

export async function createLeaseRenewalAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const leaseId = requiredText(formData, 'leaseId');
  await requireOwnedLease(landlordId, leaseId);

  const renewalStartDate = new Date(requiredText(formData, 'renewalStartDate'));
  const renewalEndDate = new Date(requiredText(formData, 'renewalEndDate'));
  if (Number.isNaN(renewalStartDate.getTime()) || Number.isNaN(renewalEndDate.getTime())) throw new Error('Renewal dates are invalid.');
  if (renewalEndDate <= renewalStartDate) throw new Error('Renewal end date must be after renewal start date.');

  const status = text(formData, 'status')
    ? validEnumValue(LeaseRenewalStatus, text(formData, 'status'), 'renewal status')
    : LeaseRenewalStatus.DRAFT;

  const renewal = await prisma.leaseRenewal.create({
    data: {
      landlordId,
      leaseId,
      renewalStartDate,
      renewalEndDate,
      proposedRentAmount: text(formData, 'proposedRentAmount') ? positiveNumber(text(formData, 'proposedRentAmount'), 'Proposed rent amount') : null,
      status,
      notes: text(formData, 'notes') || null,
    },
  });

  await audit(user.userId, user.email, 'lease_renewal.created', 'LeaseRenewal', renewal.id, landlordId, { leaseId, status });
  revalidatePath('/leases');
  revalidatePath(`/leases/${leaseId}`);
}

export async function createLeaseNoticeAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const leaseId = requiredText(formData, 'leaseId');
  await requireOwnedLease(landlordId, leaseId);

  const noticeType = validEnumValue(LeaseNoticeType, requiredText(formData, 'noticeType'), 'notice type');
  const noticeDate = new Date(requiredText(formData, 'noticeDate'));
  if (Number.isNaN(noticeDate.getTime())) throw new Error('Notice date is invalid.');

  const notice = await prisma.leaseNotice.create({
    data: {
      landlordId,
      leaseId,
      noticeType,
      noticeDate,
      content: requiredText(formData, 'content'),
      sentAt: text(formData, 'sentAt') ? new Date(text(formData, 'sentAt')) : null,
    },
  });

  await audit(user.userId, user.email, 'lease_notice.created', 'LeaseNotice', notice.id, landlordId, { leaseId, noticeType });
  revalidatePath('/leases');
  revalidatePath(`/leases/${leaseId}`);
}

export async function createLeaseDocumentVersionAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();
  const leaseId = requiredText(formData, 'leaseId');
  await requireOwnedLease(landlordId, leaseId);

  const latest = await prisma.leaseDocumentVersion.findFirst({
    where: { leaseId, landlordId },
    orderBy: { versionNumber: 'desc' },
  });

  const document = await prisma.leaseDocumentVersion.create({
    data: {
      landlordId,
      leaseId,
      fileUrl: requiredText(formData, 'fileUrl'),
      fileName: text(formData, 'fileName') || null,
      documentType: text(formData, 'documentType') || null,
      versionNumber: latest ? latest.versionNumber + 1 : 1,
    },
  });

  await audit(user.userId, user.email, 'lease_document_version.created', 'LeaseDocumentVersion', document.id, landlordId, { leaseId, versionNumber: document.versionNumber });
  revalidatePath('/leases');
  revalidatePath(`/leases/${leaseId}`);
}
