'use server';

import { revalidatePath } from 'next/cache';
import { DocumentSource, DocumentVisibility, Prisma, RecordStatus } from '@prisma/client';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { documentKey, putDocumentBlob } from '@/lib/storage/blobs';
import { validateUploadFile } from '@/lib/storage/validate';

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

async function audit(
  actorUserId: string,
  actorEmail: string,
  action: string,
  entityType: string,
  entityId: string,
  landlordId?: string,
  details: Prisma.InputJsonValue = {},
) {
  await prisma.auditLog.create({
    data: { actorUserId, actorEmail, action, entityType, entityId, landlordId, details },
  });
}

function resolveVisibility(formData: FormData, tenantId: string | null): DocumentVisibility {
  const wantsTenantVisible = text(formData, 'visibility') === 'tenant';
  return wantsTenantVisible && tenantId
    ? DocumentVisibility.TENANT_VISIBLE
    : DocumentVisibility.LANDLORD_ONLY;
}

export async function createDocumentAction(formData: FormData) {
  const { landlordId, user } = await getCurrentLandlordWorkspace();

  const documentType = text(formData, 'documentType');
  const fileName = text(formData, 'fileName');
  const fileUrl = text(formData, 'fileUrl');

  if (!documentType) throw new Error('Document type is required.');
  if (!fileName) throw new Error('File name is required.');
  if (!fileUrl) throw new Error('File URL is required.');

  const tenantId = nullableText(formData, 'tenantId');
  const visibility = resolveVisibility(formData, tenantId);

  const doc = await prisma.document.create({
    data: {
      landlordId,
      propertyId: nullableText(formData, 'propertyId'),
      unitId: nullableText(formData, 'unitId'),
      tenantId,
      leaseId: nullableText(formData, 'leaseId'),
      documentType,
      fileName,
      fileUrl,
      source: DocumentSource.EXTERNAL,
      visibility,
      uploadedBy: user.userId,
    },
  });

  await audit(user.userId, user.email, 'document.created_external', 'Document', doc.id, landlordId, {
    documentType,
    visibility,
  });

  revalidatePath('/documents');
}

export async function uploadDocumentAction(formData: FormData) {
  const { landlordId, user } = await getCurrentLandlordWorkspace();

  const documentType = text(formData, 'documentType');
  const file = getUploadedFile(formData);

  if (!documentType) throw new Error('Document type is required.');
  if (!file) throw new Error('Please select a file to upload.');

  validateUploadFile(file);

  const tenantId = nullableText(formData, 'tenantId');
  const visibility = resolveVisibility(formData, tenantId);

  const doc = await prisma.document.create({
    data: {
      landlordId,
      propertyId: nullableText(formData, 'propertyId'),
      unitId: nullableText(formData, 'unitId'),
      tenantId,
      leaseId: nullableText(formData, 'leaseId'),
      documentType,
      fileName: file.name,
      fileUrl: '',
      source: DocumentSource.STORED,
      visibility,
      uploadedBy: user.userId,
    },
  });

  const key = documentKey(landlordId, doc.id, file.name);

  let size: number;
  let contentType: string;
  try {
    const result = await putDocumentBlob(key, file);
    size = result.size;
    contentType = result.contentType;
  } catch (error) {
    await prisma.document.delete({ where: { id: doc.id } });
    throw new Error(
      `Upload failed — the file could not be stored, so no record was kept. ${
        error instanceof Error ? error.message : 'Unknown storage error.'
      }`,
    );
  }

  await prisma.document.update({
    where: { id: doc.id },
    data: { storageKey: key, fileSize: size, contentType },
  });

  await audit(user.userId, user.email, 'document.uploaded', 'Document', doc.id, landlordId, {
    documentType,
    visibility,
    fileSize: size,
    contentType,
  });

  revalidatePath('/documents');
}

export async function deleteBrokenPlaceholderAction(formData: FormData) {
  const { landlordId, user } = await getCurrentLandlordWorkspace();
  const documentId = text(formData, 'documentId');

  if (!documentId) throw new Error('Document ID is required.');

  const result = await prisma.document.deleteMany({
    where: {
      id: documentId,
      landlordId,
      source: DocumentSource.BROKEN_PLACEHOLDER,
    },
  });

  if (result.count > 0) {
    await audit(
      user.userId,
      user.email,
      'document.broken_placeholder_removed',
      'Document',
      documentId,
      landlordId,
      {},
    );
  }

  revalidatePath('/documents');
}

export async function archiveDocumentAction(formData: FormData) {
  const { landlordId, user } = await getCurrentLandlordWorkspace();
  const documentId = text(formData, 'documentId');

  if (!documentId) throw new Error('Document ID is required.');

  const result = await prisma.document.updateMany({
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

  if (result.count > 0) {
    await audit(user.userId, user.email, 'document.archived', 'Document', documentId, landlordId, {});
  }

  revalidatePath('/documents');
}
