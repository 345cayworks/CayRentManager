'use server';

import { revalidatePath } from 'next/cache';
import { RecordStatus } from '@prisma/client';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function nullableText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value.length > 0 ? value : null;
}

export async function createDocumentAction(formData: FormData) {
  const { landlordId, user } = await getCurrentLandlordWorkspace();

  const documentType = text(formData, 'documentType');
  const fileName = text(formData, 'fileName');
  const fileUrl = text(formData, 'fileUrl');

  if (!documentType) throw new Error('Document type is required.');
  if (!fileName) throw new Error('File name is required.');
  if (!fileUrl) throw new Error('File URL is required.');

  await prisma.document.create({
    data: {
      landlordId,
      propertyId: nullableText(formData, 'propertyId'),
      unitId: nullableText(formData, 'unitId'),
      tenantId: nullableText(formData, 'tenantId'),
      leaseId: nullableText(formData, 'leaseId'),
      documentType,
      fileName,
      fileUrl,
      uploadedBy: user.id,
    },
  });

  revalidatePath('/documents');
}

export async function archiveDocumentAction(formData: FormData) {
  const { landlordId, user } = await getCurrentLandlordWorkspace();
  const documentId = text(formData, 'documentId');

  if (!documentId) throw new Error('Document ID is required.');

  await prisma.document.updateMany({
    where: {
      id: documentId,
      landlordId,
    },
    data: {
      status: RecordStatus.ARCHIVED,
      archivedAt: new Date(),
      archivedBy: user.id,
    },
  });

  revalidatePath('/documents');
}
