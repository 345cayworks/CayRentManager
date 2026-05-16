import { describe, expect, it } from 'vitest';
import { UserRole } from '@prisma/client';
import { canAccessDocument, type DocAccessDoc } from '@/lib/storage/access';

const tenantVisibleDoc: DocAccessDoc = {
  landlordId: 'land1',
  visibility: 'TENANT_VISIBLE',
  tenantUserId: 'tenant-user-1',
};

const landlordOnlyDoc: DocAccessDoc = {
  landlordId: 'land1',
  visibility: 'LANDLORD_ONLY',
  tenantUserId: 'tenant-user-1',
};

describe('canAccessDocument', () => {
  it('denies a null user', () => {
    expect(canAccessDocument(null, tenantVisibleDoc, [])).toBe(false);
  });

  it('allows SUPERADMIN even with no membership and LANDLORD_ONLY', () => {
    expect(
      canAccessDocument({ userId: 'a', role: UserRole.SUPERADMIN }, landlordOnlyDoc, []),
    ).toBe(true);
  });

  it('allows LANDLORD with matching membership', () => {
    expect(
      canAccessDocument({ userId: 'a', role: UserRole.LANDLORD }, landlordOnlyDoc, ['land1']),
    ).toBe(true);
  });

  it('denies LANDLORD without matching membership', () => {
    expect(
      canAccessDocument({ userId: 'a', role: UserRole.LANDLORD }, landlordOnlyDoc, ['other']),
    ).toBe(false);
  });

  it('treats PROPERTY_MANAGER like LANDLORD', () => {
    expect(
      canAccessDocument({ userId: 'a', role: UserRole.PROPERTY_MANAGER }, landlordOnlyDoc, ['land1']),
    ).toBe(true);
    expect(
      canAccessDocument({ userId: 'a', role: UserRole.PROPERTY_MANAGER }, landlordOnlyDoc, []),
    ).toBe(false);
  });

  it('treats ACCOUNTANT like LANDLORD', () => {
    expect(
      canAccessDocument({ userId: 'a', role: UserRole.ACCOUNTANT }, landlordOnlyDoc, ['land1']),
    ).toBe(true);
    expect(
      canAccessDocument({ userId: 'a', role: UserRole.ACCOUNTANT }, landlordOnlyDoc, []),
    ).toBe(false);
  });

  it('allows the owning TENANT for a TENANT_VISIBLE doc', () => {
    expect(
      canAccessDocument({ userId: 'tenant-user-1', role: UserRole.TENANT }, tenantVisibleDoc, []),
    ).toBe(true);
  });

  it('denies a non-owning TENANT for a TENANT_VISIBLE doc', () => {
    expect(
      canAccessDocument({ userId: 'tenant-user-2', role: UserRole.TENANT }, tenantVisibleDoc, []),
    ).toBe(false);
  });

  it('denies the owning TENANT for a LANDLORD_ONLY doc', () => {
    expect(
      canAccessDocument({ userId: 'tenant-user-1', role: UserRole.TENANT }, landlordOnlyDoc, []),
    ).toBe(false);
  });

  it('denies VENDOR', () => {
    expect(
      canAccessDocument({ userId: 'v', role: UserRole.VENDOR }, tenantVisibleDoc, ['land1']),
    ).toBe(false);
  });
});
