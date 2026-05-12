'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db/prisma';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

async function updateAlertStatus(formData: FormData, status: 'REVIEWED' | 'DISMISSED') {
  const { landlordId } = await getCurrentLandlordWorkspace();
  const alertId = text(formData, 'alertId');

  if (!alertId) throw new Error('alertId is required.');

  const now = new Date();

  await prisma.leaseAlertSnapshot.updateMany({
    where: {
      id: alertId,
      landlordId,
    },
    data: status === 'REVIEWED'
      ? {
          status: 'REVIEWED',
          reviewedAt: now,
        }
      : {
          status: 'DISMISSED',
          dismissedAt: now,
        },
  });

  revalidatePath('/alerts');
  revalidatePath('/leases');
}

export async function markAlertReviewedAction(formData: FormData) {
  await updateAlertStatus(formData, 'REVIEWED');
}

export async function dismissAlertAction(formData: FormData) {
  await updateAlertStatus(formData, 'DISMISSED');
}
