import Link from 'next/link';
import { requireSuperadmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { isBillingTableMissingError } from '@/lib/billing/safe-query';
import { Shell } from '@/components/shell';
import { SuperAdminActionButton } from '@/components/admin/superadmin-action-button';
import { isComplimentarySubscription } from '@/lib/billing/policy';
import {
  convertToPaidAction,
  createSubscriptionInvoiceAction,
  extendComplimentaryAction,
  extendSubscriptionAction,
  makeComplimentaryAction,
  markInvoicePaidManuallyAction,
  regenerateFygaroLinkAction,
  waiveInvoiceAction,
} from '@/server/billing-actions';

function DotIcon() {
  return <span className="h-2 w-2 rounded-full bg-slate-400 inline-block" />;
}

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

  return (
    <Shell title="Billing Management">
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <div className="text-sm text-slate-500">Active Subscribers</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">{activeSubscribers}</div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <div className="text-sm text-slate-500">Complimentary</div>
            <div className="mt-2 text-3xl font-semibold text-emerald-600">{complimentaryCount}</div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <div className="text-sm text-slate-500">Monthly Revenue</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">${monthlyRevenue.toFixed(0)}</div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <div className="text-sm text-slate-500">Needs Attention</div>
            <div className="mt-2 text-3xl font-semibold text-amber-600">{overdueCount}</div>
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            Quick Actions
          </h3>

          <div className="flex flex-wrap gap-2">
            <SuperAdminActionButton href="/admin/landlords" icon={<DotIcon />}>
              Invite Landlord
            </SuperAdminActionButton>

            <SuperAdminActionButton href="/properties" icon={<DotIcon />}>
              Add Property
            </SuperAdminActionButton>

            <SuperAdminActionButton href="/admin/billing" icon={<DotIcon />}>
              Manage Subscriptions
            </SuperAdminActionButton>

            <SuperAdminActionButton href="/payments" icon={<DotIcon />}>
              View Payments
            </SuperAdminActionButton>
          </div>
        </section>

        <section className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900">
              Subscription Overview
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Landlord</th>
                  <th className="text-left px-4 py-3 font-medium">Plan</th>
                  <th className="text-left px-4 py-3 font-medium">Amount</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                  <th className="text-left px-4 py-3 font-medium">Next Invoice</th>
                  <th className="text-left px-4 py-3 font-medium">Latest Invoice</th>
                  <th className="text-left px-4 py-3 font-medium">Payment</th>
                  <th className="text-left px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>

              <tbody>
                {subs.map((s) => {
                  const inv = s.invoices[0];
                  const complimentary = isComplimentarySubscription(s);

                  return (
                    <tr key={s.id} className="border-t border-slate-100 align-top">
                      <td className="px-4 py-4">
                        <div className="font-medium text-slate-900">
                          {s.landlord.displayName}
                        </div>
                      </td>

                      <td className="px-4 py-4 text-slate-700">
                        {s.plan.name}
                      </td>

                      <td className="px-4 py-4 text-slate-700">
                        {complimentary
                          ? '$0 Complimentary'
                          : `${Number(s.plan.amount).toFixed(2)} ${s.plan.currency}`}
                      </td>

                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${statusClass(s.status, complimentary)}`}>
                          {complimentary ? 'COMPLIMENTARY' : s.status}
                        </span>
                      </td>

                      <td className="px-4 py-4 text-slate-700">
                        {complimentary
                          ? 'None'
                          : s.nextInvoiceAt
                            ? new Date(s.nextInvoiceAt).toLocaleDateString()
                            : '-'}
                      </td>

                      <td className="px-4 py-4 text-slate-700">
                        {inv?.invoiceNumber ?? '-'}
                      </td>

                      <td className="px-4 py-4">
                        {inv?.fygaroPaymentUrl && !complimentary ? (
                          <Link
                            href={inv.fygaroPaymentUrl}
                            className="text-sm text-blue-600 hover:underline"
                          >
                            Open Payment Link
                          </Link>
                        ) : (
                          <span className="text-slate-400">Not applicable</span>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2 mb-3">
                          {!complimentary && (
                            <form action={createSubscriptionInvoiceAction}>
                              <input type="hidden" name="subscriptionId" value={s.id} />
                              <SuperAdminActionButton icon={<DotIcon />}>
                                Create Invoice
                              </SuperAdminActionButton>
                            </form>
                          )}

                          {!complimentary && inv && (
                            <form action={regenerateFygaroLinkAction}>
                              <input type="hidden" name="invoiceId" value={inv.id} />
                              <SuperAdminActionButton icon={<DotIcon />}>
                                Regenerate Link
                              </SuperAdminActionButton>
                            </form>
                          )}

                          {inv && (
                            <form action={markInvoicePaidManuallyAction}>
                              <input type="hidden" name="invoiceId" value={inv.id} />
                              <SuperAdminActionButton icon={<DotIcon />}>
                                Mark Paid
                              </SuperAdminActionButton>
                            </form>
                          )}

                          {inv && (
                            <form action={waiveInvoiceAction}>
                              <input type="hidden" name="invoiceId" value={inv.id} />
                              <SuperAdminActionButton icon={<DotIcon />}>
                                Waive Invoice
                              </SuperAdminActionButton>
                            </form>
                          )}

                          <form action={extendSubscriptionAction}>
                            <input type="hidden" name="subscriptionId" value={s.id} />
                            <input type="hidden" name="days" value="30" />
                            <SuperAdminActionButton icon={<DotIcon />}>
                              Extend 30 Days
                            </SuperAdminActionButton>
                          </form>
                        </div>

                        <div className="rounded-xl border border-slate-200 p-3 bg-slate-50 space-y-3">
                          {complimentary ? (
                            <>
                              <form action={convertToPaidAction} className="flex flex-wrap gap-2 items-center">
                                <input type="hidden" name="subscriptionId" value={s.id} />
                                <SuperAdminActionButton icon={<DotIcon />}>
                                  Convert To Paid
                                </SuperAdminActionButton>
                              </form>

                              <form action={extendComplimentaryAction} className="flex flex-wrap gap-2 items-center">
                                <input type="hidden" name="subscriptionId" value={s.id} />
                                <input
                                  type="date"
                                  name="complimentaryUntil"
                                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
                                />
                                <SuperAdminActionButton icon={<DotIcon />}>
                                  Extend Complimentary
                                </SuperAdminActionButton>
                              </form>
                            </>
                          ) : (
                            <form action={makeComplimentaryAction} className="flex flex-wrap gap-2 items-center">
                              <input type="hidden" name="subscriptionId" value={s.id} />
                              <input
                                type="text"
                                name="complimentaryReason"
                                placeholder="Complimentary reason"
                                className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
                              />
                              <input
                                type="date"
                                name="complimentaryUntil"
                                className="px-3 py-2 rounded-lg border border-slate-200 text-sm"
                              />
                              <SuperAdminActionButton icon={<DotIcon />}>
                                Make Complimentary
                              </SuperAdminActionButton>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Shell>
  );
}
