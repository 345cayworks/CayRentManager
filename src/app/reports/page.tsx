import Link from 'next/link';
import { PaymentStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

function formatKYD(value: number) {
  try {
    return new Intl.NumberFormat('en-KY', {
      style: 'currency',
      currency: 'KYD',
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `KYD ${value.toFixed(2)}`;
  }
}

type ReportCard = {
  href: string;
  title: string;
  description: string;
  headline?: string;
};

export default async function Page() {
  const { landlordId } = await getCurrentLandlordWorkspace();

  const [activeLeases, outstandingAgg] = await Promise.all([
    prisma.lease.count({ where: { landlordId, status: 'ACTIVE' } }),
    prisma.payment.aggregate({
      where: { landlordId, status: { not: PaymentStatus.VOID } },
      _sum: { balance: true },
    }),
  ]);

  const totalOutstanding = Number(outstandingAgg._sum.balance ?? 0);

  const cards: ReportCard[] = [
    {
      href: '/financials/rent-roll',
      title: 'Rent Roll',
      description: 'Active leases with monthly rent and outstanding balances.',
      headline: `${activeLeases} active leases`,
    },
    {
      href: '/reports/tenant-balances',
      title: 'Tenant Balances',
      description: 'Per-tenant due, paid, balance and overdue snapshot.',
      headline: `${formatKYD(totalOutstanding)} outstanding`,
    },
    {
      href: '/reports/payment-history',
      title: 'Payment History',
      description: 'Payments over a date range, filterable by property.',
    },
    {
      href: '/reports/expenses',
      title: 'Expense Report',
      description: 'Expenses grouped by category or property over a range.',
    },
    {
      href: '/reports/property-pl',
      title: 'Property P&L',
      description: 'Income vs. expense and net per property over a range.',
    },
    {
      href: '/reports/cashflow',
      title: 'Cashflow',
      description: 'Monthly collected vs. expenses with portfolio totals.',
    },
    {
      href: '/reports/maintenance-costs',
      title: 'Maintenance Costs',
      description: 'Estimated vs. actual work-order cost by property or category.',
    },
    {
      href: '/reports/lease-expiry',
      title: 'Lease Expiry',
      description: 'Active leases ending soon, with severity tinting.',
      headline: `${activeLeases} active leases`,
    },
  ];

  return (
    <Shell title="Reports">
      <div className="space-y-6">
        <p className="text-slate-600">
          Reporting &amp; accounting suite. Each report supports a date-range
          filter (where time-scoped) and CSV export.
        </p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.href}
              href={card.href}
              className="rounded-xl bg-white border shadow-sm p-5 hover:shadow-md transition-shadow"
            >
              <h3 className="font-semibold text-brand-navy">{card.title}</h3>
              <p className="mt-1 text-sm text-slate-600">{card.description}</p>
              {card.headline && (
                <p className="mt-3 text-lg font-semibold">{card.headline}</p>
              )}
            </Link>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          Owner statements are planned for a later phase.
        </p>
      </div>
    </Shell>
  );
}
