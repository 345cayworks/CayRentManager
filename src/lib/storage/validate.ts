export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED_UPLOAD_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

export function validateUploadFile(file: File): void {
  if (file.size === 0) throw new Error('Selected file is empty.');
  if (file.size > MAX_UPLOAD_BYTES) throw new Error('File exceeds the 10MB upload limit.');
  if (!ALLOWED_UPLOAD_TYPES.has(file.type)) {
    throw new Error('Unsupported file type. Use PDF, JPG, PNG, WEBP, DOC, or DOCX.');
  }
}

export function isInlinePreviewable(contentType: string | null | undefined): boolean {
  return contentType === 'application/pdf' || (contentType?.startsWith('image/') ?? false);
}
