import { UserRole } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getActiveUser, getUserLandlordMemberships } from '@/lib/auth/guards';
import { getActiveLandlordWorkspace } from '@/lib/auth/workspace';
import { getPlatformSettings } from '@/lib/settings/platform';

export type EffectiveTimePrefs = {
  timezone: string;
  currency: string;
  source: 'workspace' | 'tenant_landlord' | 'vendor_landlord' | 'platform';
};

async function getLandlordPrefs(landlordId: string) {
  const profile = await prisma.landlordProfile.findUnique({
    where: { id: landlordId },
    select: { timezone: true, currency: true },
  });
  return profile;
}

export async function getEffectiveTimePrefs(): Promise<EffectiveTimePrefs> {
  const platform = await getPlatformSettings();
  const user = await getActiveUser();
  if (!user) return { ...platform, source: 'platform' };

  // Landlord-side roles
  const landlordRoles: UserRole[] = [
    UserRole.LANDLORD,
    UserRole.PROPERTY_MANAGER,
    UserRole.ACCOUNTANT,
  ];
  if (landlordRoles.includes(user.role)) {
    const memberships = await getUserLandlordMemberships(user.userId);
    const landlordId = getActiveLandlordWorkspace(memberships.map((m) => m.landlordId));
    if (landlordId) {
      const profile = await getLandlordPrefs(landlordId);
      if (profile) {
        return {
          timezone: profile.timezone || platform.timezone,
          currency: profile.currency || platform.currency,
          source: 'workspace',
        };
      }
    }
  }

  // Tenants — inherit their landlord workspace
  if (user.role === UserRole.TENANT) {
    const tenant = await prisma.tenant.findFirst({
      where: { userId: user.userId },
      select: { landlordId: true },
    });
    if (tenant) {
      const profile = await getLandlordPrefs(tenant.landlordId);
      if (profile) {
        return {
          timezone: profile.timezone || platform.timezone,
          currency: profile.currency || platform.currency,
          source: 'tenant_landlord',
        };
      }
    }
  }

  // Vendors — inherit linked landlord
  const vendorRoles: UserRole[] = [UserRole.VENDOR, UserRole.MAINTENANCE_PROVIDER];
  if (vendorRoles.includes(user.role)) {
    const vendor = await prisma.maintenanceVendor.findFirst({
      where: { userId: user.userId, archivedAt: null },
      select: { landlordId: true },
    });
    if (vendor) {
      const profile = await getLandlordPrefs(vendor.landlordId);
      if (profile) {
        return {
          timezone: profile.timezone || platform.timezone,
          currency: profile.currency || platform.currency,
          source: 'vendor_landlord',
        };
      }
    }
  }

  // Superadmin or any other role → platform default
  return { ...platform, source: 'platform' };
}

export async function getEffectiveTimezone(): Promise<string> {
  return (await getEffectiveTimePrefs()).timezone;
}
