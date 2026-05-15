import { LandlordDashboardOverview } from '@/components/landlord-dashboard';
import { OnboardingNudge } from '@/components/onboarding/dashboard-nudge';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { getLandlordDashboardMetrics } from '@/lib/finance/dashboard';
import { getOnboardingState } from '@/lib/onboarding/state';
import { SubscriptionStatus } from '@prisma/client';
import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import { isBillingTableMissingError } from '@/lib/billing/safe-query';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { membership } = await getCurrentLandlordWorkspace();
  const [metrics, onboardingState] = await Promise.all([
    getLandlordDashboardMetrics(membership.landlordId),
    getOnboardingState(membership.landlordId).catch(() => null),
  ]);
  let subscription: any = null;
  try {
    subscription = await prisma.landlordSubscription.findUnique({ where: { landlordId: membership.landlordId }, include: { invoices: { where: { status: { in: ['OPEN', 'OVERDUE', 'PENDING_VERIFICATION'] } }, orderBy: { createdAt: 'desc' }, take: 1 } } });
  } catch (error) {
    if (!isBillingTableMissingError(error)) throw error;
  }

  return (
    <Shell title={`${membership.landlord.displayName} Dashboard`}>
      {subscription && (subscription.status === SubscriptionStatus.PAST_DUE || subscription.status === SubscriptionStatus.GRACE_PERIOD) && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">
          Payment overdue. You have {subscription.gracePeriodEndsAt ? Math.max(0, Math.ceil((subscription.gracePeriodEndsAt.getTime() - Date.now()) / 86400000)) : 0} days left before account access is paused.
          {subscription.invoices[0]?.fygaroPaymentUrl && <Link className="ml-3 underline" href={subscription.invoices[0].fygaroPaymentUrl}>Pay Now</Link>}
        </div>
      )}
      {onboardingState ? <OnboardingNudge state={onboardingState} /> : null}
      <LandlordDashboardOverview metrics={metrics} />
      <div className="mt-4 rounded-xl bg-white border shadow-sm p-6">
        <h3 className="font-semibold">Workspace</h3>
        <p className="text-sm text-slate-600 mt-1">{membership.landlord.companyName}</p>
      </div>
    </Shell>
  );
}
