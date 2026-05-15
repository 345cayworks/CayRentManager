import {
  InvoiceStatus,
  LeaseStatus,
  PaymentStatus,
  RecordStatus,
  SubscriptionInvoiceStatus,
  SubscriptionStatus,
  UserRole,
  UserStatus,
} from '@prisma/client';
import { Shell } from '@/components/shell';
import { requireSuperadmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

function startOfMonth(date: Date, monthsBack = 0) {
  const d = new Date(date.getFullYear(), date.getMonth() - monthsBack, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatKYD(value: number) {
  return new Intl.NumberFormat('en-KY', {
    style: 'currency',
    currency: 'KYD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-KY').format(value);
}

function pct(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

export default async function Page() {
  await requireSuperadmin();

  const now = new Date();
  const startCurrent = startOfMonth(now, 0);
  const startPrevious = startOfMonth(now, 1);
  const startThirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const startSevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    totalLandlordProfiles,
    activeLandlordProfiles,
    archivedLandlordProfiles,
    activeUsers,
    disabledUsers,
    pendingInviteUsers,
    signupsThisMonth,
    signupsLastMonth,
    signupsLast7Days,
    propertyCount,
    unitCount,
    tenantCount,
    activeLeaseCount,
    paidInvoiceAggregate,
    outstandingInvoiceAggregate,
    activeSubscriptions,
    pastDueSubscriptions,
    complimentarySubscriptions,
    paidPlatformInvoices,
    outstandingPlatformInvoices,
    rolesGroup,
    topLandlordsByProperties,
    recentSignups,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.landlordProfile.count(),
    prisma.landlordProfile.count({ where: { status: RecordStatus.ACTIVE } }),
    prisma.landlordProfile.count({ where: { status: RecordStatus.ARCHIVED } }),
    prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
    prisma.user.count({ where: { status: UserStatus.DISABLED } }),
    prisma.user.count({ where: { status: UserStatus.PENDING_INVITE } }),
    prisma.user.count({ where: { createdAt: { gte: startCurrent } } }),
    prisma.user.count({ where: { createdAt: { gte: startPrevious, lt: startCurrent } } }),
    prisma.user.count({ where: { createdAt: { gte: startSevenDaysAgo } } }),
    prisma.property.count({ where: { status: RecordStatus.ACTIVE } }),
    prisma.unit.count({ where: { status: RecordStatus.ACTIVE } }),
    prisma.tenant.count({ where: { status: RecordStatus.ACTIVE } }),
    prisma.lease.count({ where: { status: LeaseStatus.ACTIVE } }),
    prisma.invoice.aggregate({
      _sum: { amountPaid: true },
      where: { status: InvoiceStatus.PAID, paidAt: { gte: startThirtyDaysAgo } },
    }),
    prisma.invoice.aggregate({
      _sum: { balance: true },
      where: { status: { in: [InvoiceStatus.NEW, InvoiceStatus.SENT, InvoiceStatus.PARTIAL, InvoiceStatus.OVERDUE] } },
    }),
    prisma.landlordSubscription.count({ where: { status: SubscriptionStatus.ACTIVE } }),
    prisma.landlordSubscription.count({ where: { status: { in: [SubscriptionStatus.PAST_DUE, SubscriptionStatus.GRACE_PERIOD] } } }),
    prisma.landlordSubscription.count({ where: { isComplimentary: true } }),
    prisma.subscriptionInvoice.aggregate({
      _sum: { amount: true },
      where: { status: SubscriptionInvoiceStatus.PAID, paidAt: { gte: startThirtyDaysAgo } },
    }),
    prisma.subscriptionInvoice.aggregate({
      _sum: { amount: true },
      where: { status: { in: [SubscriptionInvoiceStatus.OPEN, SubscriptionInvoiceStatus.OVERDUE, SubscriptionInvoiceStatus.PENDING_VERIFICATION] } },
    }),
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.landlordProfile.findMany({
      where: { status: RecordStatus.ACTIVE },
      include: {
        _count: { select: { properties: true, units: true, tenants: true, leases: true } },
        owner: { select: { email: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.user.findMany({
      where: { createdAt: { gte: startSevenDaysAgo } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, email: true, fullName: true, role: true, status: true, createdAt: true },
    }),
  ]);

  const paidThisCycle = Number(paidInvoiceAggregate._sum.amountPaid ?? 0);
  const outstandingRent = Number(outstandingInvoiceAggregate._sum.balance ?? 0);
  const platformPaid = Number(paidPlatformInvoices._sum.amount ?? 0);
  const platformOutstanding = Number(outstandingPlatformInvoices._sum.amount ?? 0);

  const monthOverMonthDelta = signupsThisMonth - signupsLastMonth;
  const monthOverMonthPct = signupsLastMonth === 0
    ? (signupsThisMonth > 0 ? 100 : 0)
    : Math.round(((signupsThisMonth - signupsLastMonth) / signupsLastMonth) * 100);

  const topLandlords = [...topLandlordsByProperties]
    .sort((a, b) => (b._count.properties + b._count.units) - (a._count.properties + a._count.units))
    .slice(0, 8);

  const overdueRentPayments = await prisma.payment.count({
    where: { status: PaymentStatus.OVERDUE },
  });

  const kpis = [
    { label: 'Total Users', value: formatNumber(totalUsers), hint: `${formatNumber(activeUsers)} active` },
    { label: 'Landlord Workspaces', value: formatNumber(activeLandlordProfiles), hint: `${formatNumber(archivedLandlordProfiles)} archived` },
    { label: 'Properties', value: formatNumber(propertyCount), hint: `${formatNumber(unitCount)} units` },
    { label: 'Active Leases', value: formatNumber(activeLeaseCount), hint: `${formatNumber(tenantCount)} tenants` },
  ];

  const growthKpis = [
    {
      label: 'New users this month',
      value: formatNumber(signupsThisMonth),
      hint: `${monthOverMonthDelta >= 0 ? '+' : ''}${monthOverMonthDelta} vs last month (${monthOverMonthPct >= 0 ? '+' : ''}${monthOverMonthPct}%)`,
      tone: monthOverMonthDelta >= 0 ? 'positive' : 'negative',
    },
    { label: 'New users last 7 days', value: formatNumber(signupsLast7Days), hint: 'Rolling 7-day window' },
    { label: 'Disabled accounts', value: formatNumber(disabledUsers), hint: `${formatNumber(pendingInviteUsers)} pending invites` },
  ];

  const financialKpis = [
    { label: 'Rent collected (30d)', value: formatKYD(paidThisCycle), hint: 'Across all landlord ledgers' },
    { label: 'Outstanding tenant balances', value: formatKYD(outstandingRent), hint: `${formatNumber(overdueRentPayments)} overdue payments` },
    { label: 'Subscription revenue (30d)', value: formatKYD(platformPaid), hint: `${formatNumber(activeSubscriptions)} active subs` },
    { label: 'Platform billing outstanding', value: formatKYD(platformOutstanding), hint: `${formatNumber(pastDueSubscriptions)} past due, ${formatNumber(complimentarySubscriptions)} complimentary` },
  ];

  return (
    <Shell title="Platform Analytics">
      <div className="space-y-6">
        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-950">Platform Footprint</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{kpi.label}</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{kpi.value}</p>
                <p className="mt-1 text-[11px] text-slate-500">{kpi.hint}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-950">Growth</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {growthKpis.map((kpi) => (
              <div key={kpi.label} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{kpi.label}</p>
                <p className="mt-1 text-2xl font-semibold text-slate-950">{kpi.value}</p>
                <p className={`mt-1 text-[11px] ${kpi.tone === 'positive' ? 'text-emerald-600' : kpi.tone === 'negative' ? 'text-red-600' : 'text-slate-500'}`}>{kpi.hint}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-2 text-sm font-semibold text-slate-950">Financials</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {financialKpis.map((kpi) => (
              <div key={kpi.label} className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{kpi.label}</p>
                <p className="mt-1 text-xl font-semibold text-slate-950">{kpi.value}</p>
                <p className="mt-1 text-[11px] text-slate-500">{kpi.hint}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-slate-950">Role Distribution</h3>
            <ul className="space-y-2">
              {Object.values(UserRole).map((role) => {
                const entry = rolesGroup.find((r) => r.role === role);
                const count = entry?._count._all ?? 0;
                const share = pct(count, totalUsers);
                return (
                  <li key={role}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{role}</span>
                      <span className="text-slate-500">{formatNumber(count)} · {share}%</span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full bg-slate-900" style={{ width: `${share}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-sm font-semibold text-slate-950">Recent Signups (7d)</h3>
            {recentSignups.length === 0 ? (
              <p className="text-xs text-slate-500">No new signups this week.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {recentSignups.map((user) => (
                  <li key={user.id} className="flex items-center justify-between py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-950">{user.fullName ?? user.email}</p>
                      <p className="truncate text-[11px] text-slate-500">{user.email} · {user.role}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-slate-500">{new Date(user.createdAt).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-950">Most Active Landlord Workspaces</h3>
            <p className="text-[11px] text-slate-500">Ranked by property + unit footprint.</p>
          </div>
          {topLandlords.length === 0 ? (
            <p className="p-4 text-xs text-slate-500">No active landlord workspaces yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Workspace</th>
                    <th className="px-4 py-2 font-semibold text-right">Properties</th>
                    <th className="px-4 py-2 font-semibold text-right">Units</th>
                    <th className="px-4 py-2 font-semibold text-right">Tenants</th>
                    <th className="px-4 py-2 font-semibold text-right">Leases</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {topLandlords.map((profile) => (
                    <tr key={profile.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-slate-950">{profile.companyName ?? profile.displayName ?? profile.owner?.fullName ?? profile.owner?.email}</div>
                        <div className="text-[11px] text-slate-500">{profile.owner?.email}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-700">{formatNumber(profile._count.properties)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700">{formatNumber(profile._count.units)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700">{formatNumber(profile._count.tenants)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700">{formatNumber(profile._count.leases)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}
