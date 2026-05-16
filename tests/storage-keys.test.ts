import { describe, expect, it } from 'vitest';
import {
  documentKey,
  maintenanceAttachmentKey,
  sanitizeFileName,
} from '@/lib/storage/blobs';
import { isInlinePreviewable, validateUploadFile } from '@/lib/storage/validate';

describe('sanitizeFileName', () => {
  it('strips unsafe characters', () => {
    expect(sanitizeFileName('my report (final)!.pdf')).toBe('my_report__final__.pdf');
  });

  it('preserves safe characters', () => {
    expect(sanitizeFileName('lease-2024_v1.PDF')).toBe('lease-2024_v1.PDF');
  });

  it('falls back to "file" for empty/all-unsafe names', () => {
    expect(sanitizeFileName('')).toBe('file');
    expect(sanitizeFileName('///')).toBe('___');
  });

  it('truncates very long names to the trailing 120 chars', () => {
    const long = `${'a'.repeat(200)}.pdf`;
    const result = sanitizeFileName(long);
    expect(result.length).toBe(120);
    expect(result.endsWith('.pdf')).toBe(true);
  });
});

describe('documentKey / maintenanceAttachmentKey', () => {
  it('produces a landlord/document/file shape', () => {
    expect(documentKey('land1', 'doc1', 'Lease Agreement.pdf')).toBe(
      'land1/doc1/Lease_Agreement.pdf',
    );
  });

  it('produces a landlord/request/attachment/file shape', () => {
    expect(maintenanceAttachmentKey('land1', 'req1', 'att1', 'photo 1.jpg')).toBe(
      'land1/req1/att1/photo_1.jpg',
    );
  });
});

describe('validateUploadFile', () => {
  it('passes a valid PDF', () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'x.pdf', { type: 'application/pdf' });
    expect(() => validateUploadFile(file)).not.toThrow();
  });

  it('throws on an empty file', () => {
    const file = new File([], 'x.pdf', { type: 'application/pdf' });
    expect(() => validateUploadFile(file)).toThrow(/empty/i);
  });

  it('throws on an oversize file', () => {
    const big = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'big.pdf', {
      type: 'application/pdf',
    });
    expect(() => validateUploadFile(big)).toThrow(/10MB/i);
  });

  it('throws on an unsupported type', () => {
    const file = new File([new Uint8Array([1])], 'x.exe', {
      type: 'application/x-msdownload',
    });
    expect(() => validateUploadFile(file)).toThrow(/Unsupported file type/i);
  });
});

describe('isInlinePreviewable', () => {
  it('is true for PDF and images', () => {
    expect(isInlinePreviewable('application/pdf')).toBe(true);
    expect(isInlinePreviewable('image/png')).toBe(true);
    expect(isInlinePreviewable('image/jpeg')).toBe(true);
  });

  it('is false for docx and null/undefined', () => {
    expect(
      isInlinePreviewable(
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ),
    ).toBe(false);
    expect(isInlinePreviewable(null)).toBe(false);
    expect(isInlinePreviewable(undefined)).toBe(false);
  });
});
