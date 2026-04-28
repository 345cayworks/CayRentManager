import { AppRole, RecordStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

const PRIMARY_SUPERADMIN = 'info@cayworks.com';

export async function ensurePrimarySuperadmin() {
  return prisma.appUser.upsert({
    where: { email: PRIMARY_SUPERADMIN },
    update: {
      role: AppRole.superadmin,
      status: RecordStatus.active,
      disabledAt: null,
      disabledBy: null,
      disabledReason: null,
    },
    create: {
      email: PRIMARY_SUPERADMIN,
      fullName: 'Primary Superadmin',
      role: AppRole.superadmin,
      status: RecordStatus.active,
    },
  });
}
