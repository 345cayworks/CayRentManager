import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as healthGet } from '@/app/api/health/route';
import { GET as meGet } from '@/app/api/identity/me/route';
import { POST as bootstrapPost } from '@/app/api/admin/bootstrap-owner/route';
import { getAppSessionUser } from '@/lib/auth/session';
import { prisma } from '@/lib/db/prisma';

vi.mock('@/lib/auth/session', () => ({
  getAppSessionUser: vi.fn(),
}));

vi.mock('@/lib/db/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
    user: {
      upsert: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

const mockedGetAppSessionUser = vi.mocked(getAppSessionUser);
const mockedPrisma = vi.mocked(prisma, true);

describe('safe API status endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SUPER_ADMIN_EMAIL;
    delete process.env.SUPERADMIN_MASTER_KEY;
  });

  it('returns a safe health response without exposing internals', async () => {
    mockedPrisma.$queryRaw.mockResolvedValueOnce([{ ok: 1 }]);

    const response = await healthGet();
    const body = await response.json();

    expect(body.app).toBe('ok');
    expect(body.database).toBe('ok');
    expect(body.timestamp).toEqual(expect.any(String));
    expect(JSON.stringify(body)).not.toContain('DATABASE_URL');
    expect(JSON.stringify(body)).not.toContain('APP_SESSION_SECRET');
    expect(JSON.stringify(body)).not.toContain('SUPERADMIN_MASTER_KEY');
  });

  it('returns unauthenticated identity status without ids or tokens', async () => {
    mockedGetAppSessionUser.mockResolvedValueOnce(null);

    const response = await meGet();
    const body = await response.json();

    expect(body).toEqual({ authenticated: false });
  });

  it('returns authenticated identity status with safe user fields only', async () => {
    mockedGetAppSessionUser.mockResolvedValueOnce({
      id: 'user_123',
      email: 'owner@example.com',
      role: 'SUPERADMIN',
      status: 'ACTIVE',
      netlifyUserId: 'netlify_123',
    } as any);

    const response = await meGet();
    const body = await response.json();

    expect(body).toEqual({
      authenticated: true,
      user: {
        email: 'owner@example.com',
        role: 'SUPERADMIN',
        status: 'ACTIVE',
      },
    });
    expect(JSON.stringify(body)).not.toContain('user_123');
    expect(JSON.stringify(body)).not.toContain('netlify_123');
  });
});

describe('protected owner bootstrap endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SUPER_ADMIN_EMAIL;
    delete process.env.SUPERADMIN_MASTER_KEY;
    // Final Phase 1 bootstrap policy: the route is opt-in via an explicit env
    // gate. These tests cover the in-policy behavior with the route enabled.
    process.env.ENABLE_BOOTSTRAP_OWNER_ROUTE = 'true';
  });

  afterEach(() => {
    delete process.env.ENABLE_BOOTSTRAP_OWNER_ROUTE;
  });

  function request(masterKey: string) {
    return new Request('https://cayrentmanager.test/api/admin/bootstrap-owner', {
      method: 'POST',
      body: JSON.stringify({ masterKey }),
    });
  }

  it('returns 404 when the env gate is not enabled (route off by default)', async () => {
    delete process.env.ENABLE_BOOTSTRAP_OWNER_ROUTE;
    process.env.SUPER_ADMIN_EMAIL = 'Owner@Example.com';
    process.env.SUPERADMIN_MASTER_KEY = 'correct-key';

    const response = await bootstrapPost(request('correct-key'));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ ok: false });
    expect(mockedPrisma.user.upsert).not.toHaveBeenCalled();
  });

  it('does not run when bootstrap environment is missing', async () => {
    const response = await bootstrapPost(request('anything'));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ ok: false });
    expect(mockedPrisma.user.upsert).not.toHaveBeenCalled();
  });

  it('rejects invalid master keys without returning secret material', async () => {
    process.env.SUPER_ADMIN_EMAIL = 'Owner@Example.com';
    process.env.SUPERADMIN_MASTER_KEY = 'correct-key';

    const response = await bootstrapPost(request('wrong-key'));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ ok: false });
    expect(JSON.stringify(body)).not.toContain('correct-key');
    expect(mockedPrisma.user.upsert).not.toHaveBeenCalled();
  });

  it('bootstraps only the env-configured owner email and returns safe JSON', async () => {
    process.env.SUPER_ADMIN_EMAIL = 'Owner@Example.com';
    process.env.SUPERADMIN_MASTER_KEY = 'correct-key';
    mockedPrisma.user.upsert.mockResolvedValueOnce({
      id: 'user_123',
      email: 'owner@example.com',
      role: 'SUPERADMIN',
      status: 'ACTIVE',
    } as any);
    mockedPrisma.auditLog.create.mockResolvedValueOnce({} as any);

    const response = await bootstrapPost(request('correct-key'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockedPrisma.user.upsert).toHaveBeenCalledWith({
      where: { email: 'owner@example.com' },
      update: expect.objectContaining({
        role: 'SUPERADMIN',
        status: 'ACTIVE',
        disabledAt: null,
        disabledBy: null,
        disabledById: null,
        disabledReason: null,
      }),
      create: expect.objectContaining({
        email: 'owner@example.com',
        role: 'SUPERADMIN',
        status: 'ACTIVE',
      }),
    });
    expect(body).toEqual({
      ok: true,
      email: 'owner@example.com',
      role: 'SUPERADMIN',
      status: 'ACTIVE',
    });
    expect(JSON.stringify(body)).not.toContain('correct-key');
    expect(JSON.stringify(body)).not.toContain('user_123');
  });
});
