'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { isValidSeverity } from '@/lib/notifications/preferences';

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function multiText(formData: FormData, key: string): string[] {
  return formData.getAll(key).map((value) => String(value).trim()).filter(Boolean);
}

export async function updateAlertPreferencesAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();

  const digestEnabled = text(formData, 'digestEnabled') === 'on';
  const rawSeverity = text(formData, 'minSeverity') || 'WARNING';
  if (!isValidSeverity(rawSeverity)) {
    throw new Error('Invalid minimum severity.');
  }

  const suppressedTypes = multiText(formData, 'suppressedTypes');

  await prisma.alertPreference.upsert({
    where: {
      landlordId_userId: { landlordId, userId: user.userId },
    },
    create: {
      landlordId,
      userId: user.userId,
      digestEnabled,
      minSeverity: rawSeverity,
      suppressedTypes,
    },
    update: {
      digestEnabled,
      minSeverity: rawSeverity,
      suppressedTypes,
    },
  });

  await prisma.auditLog.create({
    data: {
      landlordId,
      actorUserId: user.userId,
      actorEmail: user.email,
      action: 'notification.preferences_updated',
      entityType: 'AlertPreference',
      entityId: user.userId,
      details: {
        digestEnabled,
        minSeverity: rawSeverity,
        suppressedTypes,
      },
    },
  });

  revalidatePath('/account/notifications');
  redirect('/account/notifications?updated=1');
}

const ESCALATION_ROLE_OPTIONS = ['LANDLORD', 'PROPERTY_MANAGER', 'ACCOUNTANT'];
const ESCALATION_CHANNEL_OPTIONS = ['EMAIL', 'SMS', 'WHATSAPP'];

function boundedInt(value: string, label: string, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} must be a whole number between ${min} and ${max}.`);
  }
  return parsed;
}

export async function updateEscalationPolicyAction(formData: FormData) {
  const { user, landlordId } = await getCurrentLandlordWorkspace();

  const enabled = text(formData, 'enabled') === 'on';

  const rawSeverity = text(formData, 'minSeverity') || 'URGENT';
  if (!isValidSeverity(rawSeverity)) {
    throw new Error('Invalid minimum severity.');
  }

  const thresholdHours = boundedInt(
    text(formData, 'thresholdHours') || '24',
    'Threshold hours',
    1,
    720,
  );

  const repeatRaw = text(formData, 'repeatHours');
  const repeatHours =
    repeatRaw === '' ? null : boundedInt(repeatRaw, 'Repeat hours', 1, 720);

  const notifyRoles = multiText(formData, 'notifyRoles').filter((r) =>
    ESCALATION_ROLE_OPTIONS.includes(r),
  );
  const channels = multiText(formData, 'channels').filter((c) =>
    ESCALATION_CHANNEL_OPTIONS.includes(c),
  );

  if (notifyRoles.length === 0) {
    throw new Error('Select at least one role to notify.');
  }
  if (channels.length === 0) {
    throw new Error('Select at least one delivery channel.');
  }

  await prisma.escalationPolicy.upsert({
    where: { landlordId },
    create: {
      landlordId,
      enabled,
      minSeverity: rawSeverity,
      thresholdHours,
      repeatHours,
      notifyRoles,
      channels,
      updatedBy: user.userId,
    },
    update: {
      enabled,
      minSeverity: rawSeverity,
      thresholdHours,
      repeatHours,
      notifyRoles,
      channels,
      updatedBy: user.userId,
    },
  });

  await prisma.auditLog.create({
    data: {
      landlordId,
      actorUserId: user.userId,
      actorEmail: user.email,
      action: 'escalation_policy.updated',
      entityType: 'EscalationPolicy',
      entityId: landlordId,
      details: {
        enabled,
        minSeverity: rawSeverity,
        thresholdHours,
        repeatHours,
        notifyRoles,
        channels,
      },
    },
  });

  revalidatePath('/account/notifications');
  redirect('/account/notifications?updated=1');
}
