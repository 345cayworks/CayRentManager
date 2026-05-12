'use server';

import { revalidatePath } from 'next/cache';
import { RecordStatus } from '@prisma/client';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const ALLOWED_UPLOAD_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function nullableText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value.length > 0 ? value : null;
}

function getUploadedFile(formData: FormData) {
  const value = formData.get('file');

  if (!(value instanceof File)) return null;
  if (value.size === 0) return null;

  return value;
}

function validateUploadFile(file: File) {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('File exceeds the 10MB upload limit.');
  }

  if (!ALLOWED_UPLOAD_TYPES.has(file.type)) {
    throw new Error('Unsupported file type. Use PDF, JPG, PNG, WEBP, DOC, or DOCX.');
  }
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
      uploadedBy: user.userId,
    },
  });

  revalidatePath('/documents');
}

export async function createUploadedDocumentPlaceholderAction(formData: FormData) {
  const { landlordId, user } = await getCurrentLandlordWorkspace();

  const documentType = text(formData, 'documentType');
  const file = getUploadedFile(formData);

  if (!documentType) throw new Error('Document type is required.');
  if (!file) throw new Error('Please select a file to upload.');

  validateUploadFile(file);

  await prisma.document.create({
    data: {
      landlordId,
      propertyId: nullableText(formData, 'propertyId'),
      unitId: nullableText(formData, 'unitId'),
      tenantId: nullableText(formData, 'tenantId'),
      leaseId: nullableText(formData, 'leaseId'),
      documentType,
      fileName: file.name,
      fileUrl: `pending-blob-upload://${landlordId}/${Date.now()}-${file.name}`,
      uploadedBy: user.userId,
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
      archivedBy: user.userId,
    },
  });

  revalidatePath('/documents');
}
