import Link from 'next/link';
import { SubscriptionInvoiceStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { requireLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { isBillingTableMissingError } from '@/lib/billing/safe-query';
import { isComplimentarySubscription } from '@/lib/billing/policy';

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    COMPLIMENTARY: 'bg-blue-50 text-blue-700 border-blue-100',
    GRACE_PERIOD: 'bg-amber-50 text-amber-700 border-amber-100',
    PAST_DUE: 'bg-red-50 text-red-700 border-red-100',
    TRIAL: 'bg-violet-50 text-violet-700 border-violet-100',
  };

  return styles[status] ?? 'bg-slate-50 text-slate-700 border-slate-200';
}

export default async function AccountBillingPage() {
  const workspace = await requireLandlordWorkspace();

  let subscription: any = null;
  let invoices: any[] = [];
  let billingUnavailable = false;

  try {
    subscription = await prisma.landlordSubscription.findUnique({
      where: {
        landlordId: workspace.landlordId,
      },
      include: {
        plan: true,
      },
    });

    invoices = await prisma.subscriptionInvoice.findMany({
      where: {
        landlordId: workspace.landlordId,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 20,
    });
  } catch (error) {
    if (isBillingTableMissingError(error)) {
      billingUnavailable = true;
    } else {
      throw error;
    }
  }

  const complimentary = subscription
    ? isComplimentarySubscription(subscription)
    : false;

  const outstandingInvoice = invoices.find((invoice) =>
    [SubscriptionInvoiceStatus.OPEN, SubscriptionInvoiceStatus.OVERDUE].includes(invoice.status),
  );

  return (
    <Shell title="Account Billing">
      <div className="space-y-6">
        {billingUnavailable ? (
          <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Billing setup in progress
            </h3>

            <p className="text-sm text-slate-600">
              Your account billing portal is currently being initialized. Please check back shortly.
            </p>
          </section>
        ) : (
          <>
            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    Subscription Overview
                  </h3>

                  <p className="text-sm text-slate-500 mt-1">
                    Manage your CayRentManager subscription and invoices.
                  </p>
                </div>

                {subscription ? (
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${statusBadge(subscription.status)}`}
                  >
                    {complimentary ? 'COMPLIMENTARY' : subscription.status}
                  </span>
                ) : null}
              </div>

              {subscription ? (
                <div className="grid gap-4 md:grid-cols-4 mt-6">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">
                      Current Plan
                    </div>
                    <div className="mt-2 text-lg font-semibold text-slate-900">
                      {subscription.plan.name}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">
                      Monthly Billing
                    </div>
                    <div className="mt-2 text-lg font-semibold text-slate-900">
                      {complimentary
                        ? '$0'
                        : `${Number(subscription.plan.amount).toFixed(2)} ${subscription.plan.currency}`}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">
                      Current Period Ends
                    </div>
                    <div className="mt-2 text-lg font-semibold text-slate-900">
                      {subscription.currentPeriodEnd
                        ? new Date(subscription.currentPeriodEnd).toLocaleDateString()
                        : '-'}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <div className="text-xs uppercase tracking-wide text-slate-500">
                      Next Invoice
                    </div>
                    <div className="mt-2 text-lg font-semibold text-slate-900">
                      {complimentary
                        ? 'None'
                        : subscription.nextInvoiceAt
                          ? new Date(subscription.nextInvoiceAt).toLocaleDateString()
                          : '-'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-6 rounded-xl border border-amber-100 bg-amber-50 p-4 text-sm text-amber-800">
                  No subscription is currently attached to this landlord account.
                </div>
              )}
            </section>

            {complimentary ? (
              <section className="bg-blue-50 border border-blue-100 rounded-2xl p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h3 className="text-sm font-semibold text-blue-900">
                      Complimentary Account
                    </h3>

                    <p className="mt-2 text-sm text-blue-800">
                      Your CayRentManager account is currently complimentary. No payment is due at this time.
                    </p>

                    {subscription?.complimentaryReason ? (
                      <p className="mt-2 text-xs text-blue-700">
                        Reason: {subscription.complimentaryReason}
                      </p>
                    ) : null}
                  </div>

                  {subscription?.complimentaryUntil ? (
                    <div className="text-xs font-medium text-blue-700">
                      Complimentary until{' '}
                      {new Date(subscription.complimentaryUntil).toLocaleDateString()}
                    </div>
                  ) : (
                    <div className="text-xs font-medium text-blue-700">
                      Complimentary indefinitely
                    </div>
                  )}
                </div>
              </section>
            ) : null}

            {outstandingInvoice && outstandingInvoice.fygaroPaymentUrl ? (
              <section className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="text-sm font-semibold text-emerald-900">
                    Outstanding Invoice
                  </h3>

                  <p className="mt-1 text-sm text-emerald-800">
                    Invoice {outstandingInvoice.invoiceNumber} is currently {outstandingInvoice.status.toLowerCase()}.
                  </p>
                </div>

                <Link
                  href={outstandingInvoice.fygaroPaymentUrl}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition"
                >
                  Pay Invoice
                </Link>
              </section>
            ) : null}

            <section className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-5 border-b border-slate-100">
                <h3 className="text-sm font-semibold text-slate-900">
                  Invoice History
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="text-left px-4 py-3 font-medium">Invoice</th>
                      <th className="text-left px-4 py-3 font-medium">Amount</th>
                      <th className="text-left px-4 py-3 font-medium">Status</th>
                      <th className="text-left px-4 py-3 font-medium">Due Date</th>
                      <th className="text-left px-4 py-3 font-medium">Payment</th>
                    </tr>
                  </thead>

                  <tbody>
                    {invoices.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                          No billing invoices found.
                        </td>
                      </tr>
                    ) : (
                      invoices.map((invoice) => (
                        <tr key={invoice.id} className="border-t border-slate-100">
                          <td className="px-4 py-4 font-medium text-slate-900">
                            {invoice.invoiceNumber}
                          </td>

                          <td className="px-4 py-4 text-slate-700">
                            {Number(invoice.amount).toFixed(2)} {invoice.currency}
                          </td>

                          <td className="px-4 py-4">
                            <span
                              className={`inline-flex items-center rounded-full border px-2 py-1 text-xs font-medium ${statusBadge(invoice.status)}`}
                            >
                              {invoice.status}
                            </span>
                          </td>

                          <td className="px-4 py-4 text-slate-700">
                            {new Date(invoice.dueDate).toLocaleDateString()}
                          </td>

                          <td className="px-4 py-4">
                            {invoice.fygaroPaymentUrl &&
                            [SubscriptionInvoiceStatus.OPEN, SubscriptionInvoiceStatus.OVERDUE].includes(invoice.status) ? (
                              <Link
                                href={invoice.fygaroPaymentUrl}
                                className="text-sm text-blue-600 hover:underline"
                              >
                                Pay Now
                              </Link>
                            ) : invoice.status === SubscriptionInvoiceStatus.PAID ? (
                              <span className="text-emerald-700">Paid</span>
                            ) : invoice.status === SubscriptionInvoiceStatus.WAIVED ? (
                              <span className="text-slate-500">Waived</span>
                            ) : (
                              <span className="text-slate-400">Not applicable</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </Shell>
  );
}
