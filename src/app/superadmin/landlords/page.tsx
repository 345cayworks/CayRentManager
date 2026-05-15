import { Shell } from '@/components/shell';
import { requireSuperadmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { LandlordControlCenter } from '@/components/superadmin-landlord-control-center';
import { getEffectiveTimezone } from '@/lib/time/effective';
import { UserRole } from '@prisma/client';

export const dynamic = 'force-dynamic';

export default async function Page() {
  await requireSuperadmin();
  const tz = await getEffectiveTimezone();

  const landlords = await prisma.user.findMany({
    where: { role: UserRole.LANDLORD },
    include: {
      ownedLandlords: {
        include: { _count: { select: { properties: true, units: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const landlordData = landlords.map((landlord) => ({
    id: landlord.id,
    email: landlord.email,
    name: landlord.name,
    fullName: landlord.fullName,
    phone: landlord.phone,
    status: landlord.status,
    createdAt: landlord.createdAt.toISOString(),
    lastLoginAt: landlord.lastLoginAt?.toISOString() ?? null,
    ownedLandlords: landlord.ownedLandlords.map((profile) => ({
      id: profile.id,
      companyName: profile.companyName,
      displayName: profile.displayName,
      _count: profile._count,
    })),
  }));

  return (
    <Shell title="Superadmin Landlords">
      <LandlordControlCenter landlords={landlordData} timezone={tz} />
    </Shell>
  );
}
