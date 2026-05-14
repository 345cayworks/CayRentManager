import { requireSuperadmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { isBillingTableMissingError } from '@/lib/billing/safe-query';
import { isComplimentarySubscription } from '@/lib/billing/policy';
import { Shell } from '@/components/shell';
import { BillingManagementClient } from '@/components/admin/billing-management-client';

function statusClass(status: string, complimentary: boolean) {
  if (complimentary) {
    return 'bg-emerald-50 text-emerald-700 border border-emerald-100';
  }

  switch (status) {
    case 'GRACE_PERIOD':
      return 'bg-amber-50 text-amber-700 border border-amber-100';
    case 'MANUAL_OVERRIDE':
      return 'bg-purple-50 text-purple-700 border border-purple-100';
    case 'CANCELLED':
    case 'INACTIVE':
      return 'bg-red-50 text-red-700 border border-red-100';
    default:
      return 'bg-slate-50 text-slate-700 border border-slate-200';
  }
}

export default async function AdminBillingPage() {
  await requireSuperadmin();

  let subs: any[] = [];

  try {
    subs = await prisma.landlordSubscription.findMany({
      include: {
        landlord: true,
        plan: true,
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { updatedAt: 'desc' },
    });
  } catch (error) {
    if (!isBillingTableMissingError(error)) throw error;
  }

  const activeSubscribers = subs.filter((s) => s.status === 'ACTIVE').length;
  const complimentaryCount = subs.filter((s) => isComplimentarySubscription(s)).length;
  const overdueCount = subs.filter((s) => ['GRACE_PERIOD', 'INACTIVE'].includes(s.status)).length;
  const monthlyRevenue = subs
    .filter((s) => !isComplimentarySubscription(s))
    .reduce((sum, s) => sum + Number(s.plan.amount), 0);

  // Build serialized rows for client component
  const rows = subs.map((s) => {
    const inv = s.invoices[0];
    const complimentary = isComplimentarySubscription(s);

    return {
      subscriptionId: s.id,
      landlordName: s.landlord.displayName,
      planName: s.plan.name,
      amountLabel: complimentary
        ? '$0 Complimentary'
        : `${Number(s.plan.amount).toFixed(2)} ${s.plan.currency}`,
      statusLabel: complimentary ? 'COMPLIMENTARY' : s.status,
      statusClassName: statusClass(s.status, complimentary),
      nextInvoiceLabel: complimentary
        ? 'None'
        : s.nextInvoiceAt
          ? new Date(s.nextInvoiceAt).toLocaleDateString()
          : '—',
      currentPeriodEndLabel: s.currentPeriodEnd
        ? new Date(s.currentPeriodEnd).toLocaleDateString()
        : '—',
      complimentaryUntilLabel: s.complimentaryUntil
        ? new Date(s.complimentaryUntil).toLocaleDateString()
        : 'No end date',
      latestInvoiceId: inv?.id ?? null,
      latestInvoiceNumber: inv?.invoiceNumber ?? null,
      latestInvoiceStatus: inv?.status ?? null,
      fygaroPaymentUrl: inv?.fygaroPaymentUrl ?? null,
      complimentary,
    };
  });

  return (
    <Shell title="Billing Management">
      <BillingManagementClient
        rows={rows}
        activeSubscribers={activeSubscribers}
        complimentaryCount={complimentaryCount}
        monthlyRevenue={monthlyRevenue}
        overdueCount={overdueCount}
      />
    </Shell>
  );
}
