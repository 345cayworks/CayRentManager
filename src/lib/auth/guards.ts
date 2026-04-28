import { redirect } from 'next/navigation';
import type { AppRole } from '@/lib/rbac/roles';

export type AuthContext = {
  userId: string;
  email: string;
  role: AppRole;
  status: 'active' | 'disabled' | 'inactive';
};

export async function requireAuth(context: AuthContext | null): Promise<AuthContext> {
  if (!context) {
    redirect('/login');
  }

  if (context.status !== 'active') {
    redirect('/login?error=disabled');
  }

  return context;
}

export async function requireRole(context: AuthContext | null, allowed: AppRole[]) {
  const user = await requireAuth(context);

  if (!allowed.includes(user.role)) {
    redirect('/dashboard?error=forbidden');
  }

  return user;
}

export async function requireSuperadmin(context: AuthContext | null) {
  return requireRole(context, ['superadmin']);
}

export async function requireLandlordAccess(context: AuthContext | null, landlordId: string, membershipLandlordIds: string[]) {
  const user = await requireRole(context, ['superadmin', 'landlord', 'property_manager', 'accountant']);

  if (user.role !== 'superadmin' && !membershipLandlordIds.includes(landlordId)) {
    redirect('/dashboard?error=landlord-scope');
  }

  return user;
}

export async function requireTenantAccess(context: AuthContext | null, tenantId: string, currentTenantId: string | null) {
  const user = await requireRole(context, ['tenant', 'superadmin']);

  if (user.role !== 'superadmin' && tenantId !== currentTenantId) {
    redirect('/tenant/dashboard?error=tenant-scope');
  }

  return user;
}

export function getActiveLandlordWorkspace(membershipLandlordIds: string[], requestedLandlordId?: string) {
  if (requestedLandlordId && membershipLandlordIds.includes(requestedLandlordId)) {
    return requestedLandlordId;
  }

  return membershipLandlordIds[0] ?? null;
}
