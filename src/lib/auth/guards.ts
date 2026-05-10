import { redirect } from 'next/navigation';
import { UserRole, UserStatus } from '@prisma/client';
import { getAppSessionUser } from '@/lib/auth/session';
import { getActiveLandlordWorkspace } from '@/lib/auth/workspace';
import { prisma } from '@/lib/db/prisma';
import { isPrimarySuperadminEmail } from '@/lib/identity/sync';

export type AuthContext = {
  userId: string;
  email: string;
  role: UserRole;
  status: UserStatus;
};

export async function getActiveUser(): Promise<AuthContext | null> {
  const user = await getAppSessionUser();
  if (!user?.email) return null;

  if (isPrimarySuperadminEmail(user.email) && (user.role !== UserRole.SUPERADMIN || user.status !== UserStatus.ACTIVE)) {
    const fixed = await prisma.user.update({
      where: { id: user.id },
      data: {
        role: UserRole.SUPERADMIN,
        status: UserStatus.ACTIVE,
        disabledAt: null,
        disabledBy: null,
        disabledById: null,
        disabledReason: null,
      },
      select: { id: true, email: true, role: true, status: true },
    });
    return { userId: fixed.id, email: fixed.email, role: fixed.role, status: fixed.status };
  }

  return { userId: user.id, email: user.email, role: user.role, status: user.status };
}

export async function requireAuth(): Promise<AuthContext> {
  const user = await getActiveUser();
  if (!user) redirect('/login');
  if (user.status !== UserStatus.ACTIVE) redirect('/login?error=disabled');
  return user;
}

export async function requireRole(allowed: UserRole[]) {
  const user = await requireAuth();
  if (!allowed.includes(user.role)) redirect('/unauthorized');
  return user;
}

export async function requireSuperadmin() {
  return requireRole([UserRole.SUPERADMIN]);
}

export async function getUserLandlordMemberships(userId?: string) {
  const user = userId ? null : await requireAuth();
  return prisma.landlordMembership.findMany({
    where: {
      userId: userId ?? user!.userId,
      status: 'ACTIVE',
      landlord: { status: 'ACTIVE' },
    },
    include: { landlord: true },
    orderBy: { createdAt: 'asc' },
  });
}

export async function requireLandlordAccess(landlordId: string) {
  const user = await requireRole([UserRole.SUPERADMIN, UserRole.LANDLORD, UserRole.PROPERTY_MANAGER, UserRole.ACCOUNTANT]);
  if (user.role === UserRole.SUPERADMIN) return user;

  const membership = await prisma.landlordMembership.findFirst({
    where: { landlordId, userId: user.userId, status: 'ACTIVE', landlord: { status: 'ACTIVE' } },
  });

  if (!membership) redirect('/unauthorized');
  return user;
}

export async function requireTenantAccess(tenantId: string) {
  const user = await requireRole([UserRole.TENANT, UserRole.SUPERADMIN]);
  if (user.role === UserRole.SUPERADMIN) return user;

  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId, userId: user.userId, status: 'ACTIVE' },
  });

  if (!tenant) redirect('/unauthorized');
  return user;
}

export async function getCurrentLandlordWorkspace() {
  const user = await requireRole([UserRole.LANDLORD, UserRole.PROPERTY_MANAGER, UserRole.ACCOUNTANT]);
  const memberships = await getUserLandlordMemberships(user.userId);
  const active = getActiveLandlordWorkspace(memberships.map((membership) => membership.landlordId));
  if (!active) redirect('/register?error=no-workspace');
  return { user, landlordId: active, membership: memberships.find((membership) => membership.landlordId === active)! };
}
