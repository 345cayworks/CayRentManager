import { RecordStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { requireSuperadmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import {
  archiveSubscriptionPlanAction,
  createSubscriptionPlanAction,
  reactivateSubscriptionPlanAction,
} from '@/server/billing-actions';

export const dynamic = 'force-dynamic';

function formatAmount(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-KY', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export default async function Page() {
  await requireSuperadmin();

  const plans = await prisma.subscriptionPlan.findMany({
    orderBy: [{ status: 'asc' }, { amount: 'asc' }],
    include: {
      _count: { select: { subscriptions: true } },
    },
  });

  return (
    <Shell title="Subscription Plans">
      <div className="space-y-5">
        <section className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-950">Create plan</h2>
          <p className="text-xs text-slate-500">Plans set the price and billing cadence used when generating subscription invoices.</p>
          <form action={createSubscriptionPlanAction} className="mt-3 grid gap-3 md:grid-cols-5">
            <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Code
              <input name="code" required placeholder="STANDARD" className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm uppercase text-slate-900" />
            </label>
            <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500 md:col-span-2">
              Name
              <input name="name" required placeholder="Standard" className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900" />
            </label>
            <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Amount
              <input name="amount" required type="number" min="0" step="0.01" placeholder="49" className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900" />
            </label>
            <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Currency
              <input name="currency" defaultValue="KYD" maxLength={3} className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm uppercase text-slate-900" />
            </label>
            <label className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
              Billing interval (months)
              <input name="intervalMonths" type="number" min="1" defaultValue={1} className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900" />
            </label>
            <div className="md:col-span-4 flex items-end justify-end">
              <button className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800">Create plan</button>
            </div>
          </form>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-950">All Plans</h3>
            <p className="text-[11px] text-slate-500">Archive a plan to stop assigning it. Plans currently in use cannot be archived until their subscriptions are switched.</p>
          </div>
          {plans.length === 0 ? (
            <p className="p-4 text-sm text-slate-600">No plans yet. Create the first plan above.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Plan</th>
                    <th className="px-4 py-2 font-semibold">Code</th>
                    <th className="px-4 py-2 font-semibold text-right">Amount</th>
                    <th className="px-4 py-2 font-semibold">Interval</th>
                    <th className="px-4 py-2 font-semibold">Status</th>
                    <th className="px-4 py-2 font-semibold text-right">Subscriptions</th>
                    <th className="px-4 py-2 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {plans.map((plan) => {
                    const isActive = plan.status === RecordStatus.ACTIVE;
                    return (
                      <tr key={plan.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-2.5 font-medium text-slate-950">{plan.name}</td>
                        <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{plan.code}</td>
                        <td className="px-4 py-2.5 text-right text-slate-700">{formatAmount(Number(plan.amount), plan.currency)}</td>
                        <td className="px-4 py-2.5 text-xs text-slate-600">{plan.intervalMonths === 1 ? 'Monthly' : `Every ${plan.intervalMonths} months`}</td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${isActive ? 'bg-emerald-50 text-emerald-700 ring-emerald-100' : 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
                            {isActive ? 'Active' : 'Archived'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs text-slate-600">{plan._count.subscriptions}</td>
                        <td className="px-4 py-2.5 text-right">
                          <form action={isActive ? archiveSubscriptionPlanAction : reactivateSubscriptionPlanAction}>
                            <input type="hidden" name="planId" value={plan.id} />
                            <button className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
                              {isActive ? 'Archive' : 'Reactivate'}
                            </button>
                          </form>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}
