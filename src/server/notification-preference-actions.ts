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
