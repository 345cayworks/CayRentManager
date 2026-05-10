import { UserRole, UserStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getPrimarySuperadminEmail } from '@/lib/identity/sync';

export async function ensurePrimarySuperadmin() {
  const primaryEmail = getPrimarySuperadminEmail();
  if (!primaryEmail) throw new Error('SUPER_ADMIN_EMAIL is required.');

  return prisma.user.upsert({
    where: { email: primaryEmail },
    update: {
      role: UserRole.SUPERADMIN,
      status: UserStatus.ACTIVE,
      disabledAt: null,
      disabledBy: null,
      disabledReason: null,
    },
    create: {
      email: primaryEmail,
      name: 'Primary Superadmin',
      fullName: 'Primary Superadmin',
      role: UserRole.SUPERADMIN,
      status: UserStatus.ACTIVE,
    },
  });
}
