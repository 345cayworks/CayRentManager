import { describe, expect, it } from 'vitest';
import { UserRole } from '@prisma/client';
import { propertyPhotoKey, unitPhotoKey } from '@/lib/storage/blobs';
import { validateImageFile } from '@/lib/storage/validate';
import { canAccessPropertyPhoto } from '@/lib/storage/access';

describe('validateImageFile', () => {
  it('passes a valid PNG', () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'x.png', { type: 'image/png' });
    expect(() => validateImageFile(file)).not.toThrow();
  });

  it('throws on an empty image', () => {
    const file = new File([], 'x.png', { type: 'image/png' });
    expect(() => validateImageFile(file)).toThrow(/empty/i);
  });

  it('throws on an oversize image', () => {
    const big = new File([new Uint8Array(8 * 1024 * 1024 + 1)], 'big.jpg', {
      type: 'image/jpeg',
    });
    expect(() => validateImageFile(big)).toThrow(/8MB/i);
  });

  it('throws on an unsupported type (PDF)', () => {
    const file = new File([new Uint8Array([1])], 'x.pdf', {
      type: 'application/pdf',
    });
    expect(() => validateImageFile(file)).toThrow(/Unsupported image type/i);
  });
});

describe('propertyPhotoKey / unitPhotoKey', () => {
  it('produces a landlord/property/<id>/<photoId>/<sanitized> shape', () => {
    expect(propertyPhotoKey('land1', 'prop1', 'photo1', 'Front View.jpg')).toBe(
      'land1/property/prop1/photo1/Front_View.jpg',
    );
  });

  it('produces a landlord/unit/<id>/<photoId>/<sanitized> shape', () => {
    expect(unitPhotoKey('land1', 'unit1', 'photo1', 'kitchen (1).png')).toBe(
      'land1/unit/unit1/photo1/kitchen__1_.png',
    );
  });
});

describe('canAccessPropertyPhoto', () => {
  it('denies a null user', () => {
    expect(canAccessPropertyPhoto(null, 'land1', [])).toBe(false);
  });

  it('allows SUPERADMIN even with no membership', () => {
    expect(
      canAccessPropertyPhoto({ userId: 'a', role: UserRole.SUPERADMIN }, 'land1', []),
    ).toBe(true);
  });

  it('allows LANDLORD with matching membership', () => {
    expect(
      canAccessPropertyPhoto({ userId: 'a', role: UserRole.LANDLORD }, 'land1', ['land1']),
    ).toBe(true);
  });

  it('denies LANDLORD without matching membership', () => {
    expect(
      canAccessPropertyPhoto({ userId: 'a', role: UserRole.LANDLORD }, 'land1', ['other']),
    ).toBe(false);
  });

  it('treats PROPERTY_MANAGER like LANDLORD', () => {
    expect(
      canAccessPropertyPhoto({ userId: 'a', role: UserRole.PROPERTY_MANAGER }, 'land1', ['land1']),
    ).toBe(true);
    expect(
      canAccessPropertyPhoto({ userId: 'a', role: UserRole.PROPERTY_MANAGER }, 'land1', []),
    ).toBe(false);
  });

  it('treats ACCOUNTANT like LANDLORD', () => {
    expect(
      canAccessPropertyPhoto({ userId: 'a', role: UserRole.ACCOUNTANT }, 'land1', ['land1']),
    ).toBe(true);
    expect(
      canAccessPropertyPhoto({ userId: 'a', role: UserRole.ACCOUNTANT }, 'land1', []),
    ).toBe(false);
  });

  it('denies TENANT', () => {
    expect(
      canAccessPropertyPhoto({ userId: 't', role: UserRole.TENANT }, 'land1', ['land1']),
    ).toBe(false);
  });

  it('denies VENDOR', () => {
    expect(
      canAccessPropertyPhoto({ userId: 'v', role: UserRole.VENDOR }, 'land1', ['land1']),
    ).toBe(false);
  });
});
