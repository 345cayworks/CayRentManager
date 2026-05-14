import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InvitationStatus, RecordStatus, UserRole, UserStatus } from '@prisma/client';

vi.mock('@/lib/db/prisma', () => {
  const prisma = {
    tenantInvitation: { findUnique: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    tenant: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(async (handler: (tx: typeof prisma) => Promise<unknown>) => handler(prisma)),
  };

  return { prisma };
});

import { prisma } from '@/lib/db/prisma';
import { acceptTenantInvitation } from '@/lib/services/invitations';

const mockedPrisma = vi.mocked(prisma as any, true);

function aliveInvitation(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'inv_1',
    landlordId: 'landlord_a',
    email: 'tenant@example.com',
    inviteToken: 'token_1',
    status: InvitationStatus.PENDING,
    expiresAt: new Date(Date.now() + 86_400_000),
    propertyId: null,
    unitId: null,
    ...overrides,
  };
}

describe('acceptTenantInvitation edge cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects when the token is unknown', async () => {
    mockedPrisma.tenantInvitation.findUnique.mockResolvedValueOnce(null);

    await expect(
      acceptTenantInvitation('missing-token', 'tenant@example.com', 'Tenant Test')
    ).rejects.toThrow('Invite not found');

    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects an invite that has already been accepted', async () => {
    mockedPrisma.tenantInvitation.findUnique.mockResolvedValueOnce(
      aliveInvitation({ status: InvitationStatus.ACCEPTED })
    );

    await expect(
      acceptTenantInvitation('token_1', 'tenant@example.com', 'Tenant Test')
    ).rejects.toThrow('Invite is not pending');

    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects an invite that has expired', async () => {
    mockedPrisma.tenantInvitation.findUnique.mockResolvedValueOnce(
      aliveInvitation({ expiresAt: new Date(Date.now() - 1_000) })
    );

    await expect(
      acceptTenantInvitation('token_1', 'tenant@example.com', 'Tenant Test')
    ).rejects.toThrow('Invite expired');

    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects when the authenticated email does not match the invite', async () => {
    mockedPrisma.tenantInvitation.findUnique.mockResolvedValueOnce(aliveInvitation());

    await expect(
      acceptTenantInvitation('token_1', 'someone-else@example.com', 'Tenant Test')
    ).rejects.toThrow('Email mismatch');

    expect(mockedPrisma.$transaction).not.toHaveBeenCalled();
  });

  it('treats invite email comparisons case-insensitively', async () => {
    mockedPrisma.tenantInvitation.findUnique
      .mockResolvedValueOnce(aliveInvitation({ email: 'tenant@example.com' }))
      // Inside the transaction re-read:
      .mockResolvedValueOnce(aliveInvitation({ email: 'tenant@example.com' }));
    mockedPrisma.user.findUnique.mockResolvedValueOnce(null);
    mockedPrisma.user.create.mockResolvedValueOnce({
      id: 'user_1',
      email: 'tenant@example.com',
      role: UserRole.TENANT,
      status: UserStatus.ACTIVE,
    });
    mockedPrisma.tenant.findUnique.mockResolvedValueOnce(null);
    mockedPrisma.tenant.create.mockResolvedValueOnce({
      id: 'tenant_1',
      landlordId: 'landlord_a',
      email: 'tenant@example.com',
      status: RecordStatus.ACTIVE,
    });
    mockedPrisma.tenantInvitation.update.mockResolvedValueOnce({} as never);

    const result = await acceptTenantInvitation(
      'token_1',
      'Tenant@Example.COM',
      'Tenant Test'
    );

    expect(result.user.email).toBe('tenant@example.com');
    expect(mockedPrisma.$transaction).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.tenantInvitation.update).toHaveBeenCalledWith({
      where: { id: 'inv_1' },
      data: { status: InvitationStatus.ACCEPTED, acceptedAt: expect.any(Date) },
    });
  });

  it('re-checks the invite inside the transaction and rejects if it was claimed mid-flight', async () => {
    mockedPrisma.tenantInvitation.findUnique
      .mockResolvedValueOnce(aliveInvitation())
      // Inside the transaction another process flipped it to ACCEPTED.
      .mockResolvedValueOnce(aliveInvitation({ status: InvitationStatus.ACCEPTED }));

    await expect(
      acceptTenantInvitation('token_1', 'tenant@example.com', 'Tenant Test')
    ).rejects.toThrow('Invite is not pending');

    expect(mockedPrisma.user.create).not.toHaveBeenCalled();
    expect(mockedPrisma.tenant.create).not.toHaveBeenCalled();
  });

  it('does not re-enable a disabled user account when accepting an invite', async () => {
    mockedPrisma.tenantInvitation.findUnique
      .mockResolvedValueOnce(aliveInvitation())
      .mockResolvedValueOnce(aliveInvitation());
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      id: 'user_existing',
      email: 'tenant@example.com',
      status: UserStatus.DISABLED,
      netlifyUserId: null,
    });
    mockedPrisma.user.update.mockResolvedValueOnce({
      id: 'user_existing',
      email: 'tenant@example.com',
      status: UserStatus.DISABLED,
    });
    mockedPrisma.tenant.findUnique.mockResolvedValueOnce(null);
    mockedPrisma.tenant.create.mockResolvedValueOnce({
      id: 'tenant_1',
      landlordId: 'landlord_a',
      email: 'tenant@example.com',
      status: RecordStatus.ACTIVE,
    });
    mockedPrisma.tenantInvitation.update.mockResolvedValueOnce({} as never);

    await acceptTenantInvitation('token_1', 'tenant@example.com', 'Tenant Test');

    const updateCall = mockedPrisma.user.update.mock.calls[0]?.[0] as {
      data: { status: UserStatus };
    };
    expect(updateCall.data.status).toBe(UserStatus.DISABLED);
  });
});
