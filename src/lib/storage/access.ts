import { UserRole } from '@prisma/client';

export type DocAccessUser = { userId: string; role: UserRole } | null;

export type DocAccessDoc = {
  landlordId: string;
  visibility: 'LANDLORD_ONLY' | 'TENANT_VISIBLE';
  tenantUserId: string | null; // document.tenant?.userId
};

/** Pure decision function — no IO. membershipLandlordIds = landlord workspaces the user can manage. */
export function canAccessDocument(
  user: DocAccessUser,
  doc: DocAccessDoc,
  membershipLandlordIds: string[],
): boolean {
  if (!user) return false;
  if (user.role === UserRole.SUPERADMIN) return true;
  const landlordRoles: UserRole[] = [
    UserRole.LANDLORD,
    UserRole.PROPERTY_MANAGER,
    UserRole.ACCOUNTANT,
  ];
  if (landlordRoles.includes(user.role)) {
    return membershipLandlordIds.includes(doc.landlordId);
  }
  if (user.role === UserRole.TENANT) {
    return doc.visibility === 'TENANT_VISIBLE' && doc.tenantUserId === user.userId;
  }
  return false; // vendors and others: no document access
}

export type PhotoAccessUser = { userId: string; role: UserRole } | null;

/** Pure decision function — landlord/superadmin only. No IO. */
export function canAccessPropertyPhoto(
  user: PhotoAccessUser,
  photoLandlordId: string,
  membershipLandlordIds: string[],
): boolean {
  if (!user) return false;
  if (user.role === UserRole.SUPERADMIN) return true;
  const landlordRoles: UserRole[] = [
    UserRole.LANDLORD,
    UserRole.PROPERTY_MANAGER,
    UserRole.ACCOUNTANT,
  ];
  if (landlordRoles.includes(user.role)) {
    return membershipLandlordIds.includes(photoLandlordId);
  }
  return false;
}
