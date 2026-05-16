import { getStore } from '@netlify/blobs';

const DOCUMENT_STORE = 'crm-documents';
const MAINTENANCE_STORE = 'crm-maintenance-attachments';
const PROPERTY_PHOTO_STORE = 'crm-property-photos';

export function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120) || 'file';
}

export function documentKey(landlordId: string, documentId: string, fileName: string): string {
  return `${landlordId}/${documentId}/${sanitizeFileName(fileName)}`;
}

export function maintenanceAttachmentKey(
  landlordId: string,
  requestId: string,
  attachmentId: string,
  fileName: string,
): string {
  return `${landlordId}/${requestId}/${attachmentId}/${sanitizeFileName(fileName)}`;
}

function docStore() {
  return getStore({ name: DOCUMENT_STORE, consistency: 'strong' });
}

function maintenanceStore() {
  return getStore({ name: MAINTENANCE_STORE, consistency: 'strong' });
}

export async function putDocumentBlob(key: string, file: File) {
  const buf = Buffer.from(await file.arrayBuffer());
  await docStore().set(key, buf, { metadata: { contentType: file.type, fileName: file.name } });
  return { size: buf.length, contentType: file.type };
}

export async function getDocumentBlob(
  key: string,
): Promise<{ data: ArrayBuffer; metadata: Record<string, unknown> } | null> {
  const res = await docStore().getWithMetadata(key, { type: 'arrayBuffer' });
  if (!res) return null;
  return { data: res.data as ArrayBuffer, metadata: (res.metadata ?? {}) as Record<string, unknown> };
}

export async function deleteDocumentBlob(key: string) {
  await docStore().delete(key);
}

export async function putMaintenanceBlob(key: string, file: File) {
  const buf = Buffer.from(await file.arrayBuffer());
  await maintenanceStore().set(key, buf, { metadata: { contentType: file.type, fileName: file.name } });
  return { size: buf.length, contentType: file.type };
}

export async function getMaintenanceBlob(
  key: string,
): Promise<{ data: ArrayBuffer; metadata: Record<string, unknown> } | null> {
  const res = await maintenanceStore().getWithMetadata(key, { type: 'arrayBuffer' });
  if (!res) return null;
  return { data: res.data as ArrayBuffer, metadata: (res.metadata ?? {}) as Record<string, unknown> };
}

export async function deleteMaintenanceBlob(key: string) {
  await maintenanceStore().delete(key);
}

export function propertyPhotoKey(
  landlordId: string,
  propertyId: string,
  photoId: string,
  fileName: string,
): string {
  return `${landlordId}/property/${propertyId}/${photoId}/${sanitizeFileName(fileName)}`;
}

export function unitPhotoKey(
  landlordId: string,
  unitId: string,
  photoId: string,
  fileName: string,
): string {
  return `${landlordId}/unit/${unitId}/${photoId}/${sanitizeFileName(fileName)}`;
}

function photoStore() {
  return getStore({ name: PROPERTY_PHOTO_STORE, consistency: 'strong' });
}

export async function putPhotoBlob(key: string, file: File) {
  const buf = Buffer.from(await file.arrayBuffer());
  await photoStore().set(key, buf, { metadata: { contentType: file.type, fileName: file.name } });
  return { size: buf.length, contentType: file.type };
}

export async function getPhotoBlob(
  key: string,
): Promise<{ data: ArrayBuffer; metadata: Record<string, unknown> } | null> {
  const res = await photoStore().getWithMetadata(key, { type: 'arrayBuffer' });
  if (!res) return null;
  return { data: res.data as ArrayBuffer, metadata: (res.metadata ?? {}) as Record<string, unknown> };
}

export async function deletePhotoBlob(key: string) {
  await photoStore().delete(key);
}
