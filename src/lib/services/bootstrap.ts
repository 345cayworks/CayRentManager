import { UserRole, UserStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

const PRIMARY_SUPERADMIN = 'info@cayworks.com';

export async function ensurePrimarySuperadmin() {
  return prisma.user.upsert({
    where: { email: PRIMARY_SUPERADMIN },
    update: {
      role: UserRole.SUPERADMIN,
      status: UserStatus.ACTIVE,
      disabledAt: null,
      disabledBy: null,
      disabledReason: null,
    },
    create: {
      email: PRIMARY_SUPERADMIN,
      name: 'Primary Superadmin',
      fullName: 'Primary Superadmin',
      role: UserRole.SUPERADMIN,
      status: UserStatus.ACTIVE,
    },
  });
}
