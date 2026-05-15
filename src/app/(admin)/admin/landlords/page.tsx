import { Shell } from '@/components/shell';
import { requireSuperadmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { LandlordControlCenter } from '@/components/superadmin-landlord-control-center';
import { getEffectiveTimezone } from '@/lib/time/effective';
import { SubscriptionInvoiceStatus, UserRole } from '@prisma/client';

export const dynamic = 'force-dynamic';

export default async function Page() {
  await requireSuperadmin();
  const tz = await getEffectiveTimezone();

  const landlords = await prisma.user.findMany({
    where: { role: UserRole.LANDLORD },
    include: {
      ownedLandlords: {
        include: {
          _count: { select: { properties: true, units: true } },
          subscriptions: {
            include: { plan: true },
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const landlordIds = landlords.flatMap((landlord) => landlord.ownedLandlords.map((profile) => profile.id));

  const [outstandingInvoiceTotals, lastActivityRows] = await Promise.all([
    landlordIds.length === 0
      ? Promise.resolve([])
      : prisma.subscriptionInvoice.groupBy({
          by: ['landlordId'],
          where: {
            landlordId: { in: landlordIds },
            status: { in: [SubscriptionInvoiceStatus.OPEN, SubscriptionInvoiceStatus.OVERDUE, SubscriptionInvoiceStatus.PENDING_VERIFICATION] },
          },
          _sum: { amount: true },
        }),
    landlordIds.length === 0
      ? Promise.resolve([])
      : prisma.auditLog.groupBy({
          by: ['landlordId'],
          where: { landlordId: { in: landlordIds } },
          _max: { createdAt: true },
        }),
  ]);

  const outstandingByLandlord = new Map<string, number>();
  for (const row of outstandingInvoiceTotals) {
    if (!row.landlordId) continue;
    outstandingByLandlord.set(row.landlordId, Number(row._sum.amount ?? 0));
  }
  const lastActivityByLandlord = new Map<string, string>();
  for (const row of lastActivityRows) {
    if (!row.landlordId || !row._max.createdAt) continue;
    lastActivityByLandlord.set(row.landlordId, row._max.createdAt.toISOString());
  }

  const landlordData = landlords.map((landlord) => {
    const ownedLandlords = landlord.ownedLandlords.map((profile) => {
      const subscription = profile.subscriptions[0];
      return {
        id: profile.id,
        companyName: profile.companyName,
        displayName: profile.displayName,
        _count: profile._count,
        subscription: subscription
          ? {
              status: subscription.status,
              planName: subscription.plan?.name ?? null,
              planAmount: subscription.plan ? Number(subscription.plan.amount) : null,
              planCurrency: subscription.plan?.currency ?? 'KYD',
              intervalMonths: subscription.plan?.intervalMonths ?? 1,
              isComplimentary: subscription.isComplimentary,
              currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
              nextInvoiceAt: subscription.nextInvoiceAt?.toISOString() ?? null,
              trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
              gracePeriodEndsAt: subscription.gracePeriodEndsAt?.toISOString() ?? null,
              complimentaryUntil: subscription.complimentaryUntil?.toISOString() ?? null,
              outstandingAmount: outstandingByLandlord.get(profile.id) ?? 0,
            }
          : null,
        lastActivityAt: lastActivityByLandlord.get(profile.id) ?? null,
      };
    });

    return {
      id: landlord.id,
      email: landlord.email,
      name: landlord.name,
      fullName: landlord.fullName,
      phone: landlord.phone,
      status: landlord.status,
      createdAt: landlord.createdAt.toISOString(),
      lastLoginAt: landlord.lastLoginAt?.toISOString() ?? null,
      ownedLandlords,
    };
  });

  return (
    <Shell title="Superadmin Landlords">
      <LandlordControlCenter landlords={landlordData} timezone={tz} />
    </Shell>
  );
}
