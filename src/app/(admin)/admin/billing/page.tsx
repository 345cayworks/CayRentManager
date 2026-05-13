import Link from 'next/link';
import { requireSuperadmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { isBillingTableMissingError } from '@/lib/billing/safe-query';
import { Shell } from '@/components/shell';
import { SuperAdminActionButton } from '@/components/admin/superadmin-action-button';
import { isComplimentarySubscription } from '@/lib/billing/policy';

function DotIcon() {
  return <span className="h-2 w-2 rounded-full bg-slate-400 inline-block" />;
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

  return (
    <Shell title="Billing Management">
      <div className="space-y-6">
        <section className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-6">
          <h3 className="text-sm font-semibold text-slate-900 mb-3">
            Quick Actions
          </h3>

          <div className="flex flex-wrap gap-2">
            <SuperAdminActionButton href="/admin/landlords">
              <DotIcon />
              Invite Landlord
            </SuperAdminActionButton>

            <SuperAdminActionButton href="/properties">
              <DotIcon />
              Add Property
            </SuperAdminActionButton>

            <SuperAdminActionButton href="/admin/landlords">
              <DotIcon />
              View Landlords
            </SuperAdminActionButton>

            <SuperAdminActionButton href="/admin/billing">
              <DotIcon />
              Manage Subscriptions
            </SuperAdminActionButton>

            <SuperAdminActionButton href="/maintenance">
              <DotIcon />
              Review Maintenance
            </SuperAdminActionButton>

            <SuperAdminActionButton href="/payments">
              <DotIcon />
              View Payments
            </SuperAdminActionButton>

            <SuperAdminActionButton href="/reports">
              <DotIcon />
              Reports
            </SuperAdminActionButton>

            <SuperAdminActionButton href="/admin/audit">
              <DotIcon />
              Audit Logs
            </SuperAdminActionButton>

            <SuperAdminActionButton href="/admin/users">
              <DotIcon />
              User Management
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
                    <tr key={s.id} className="border-t border-slate-100">
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
                        {complimentary ? (
                          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 border border-emerald-100">
                            Complimentary
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 border border-slate-200">
                            {s.status}
                          </span>
                        )}
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
                        <div className="flex flex-wrap gap-2">
                          <SuperAdminActionButton>
                            <DotIcon />
                            Create Invoice
                          </SuperAdminActionButton>

                          <SuperAdminActionButton disabled={complimentary}>
                            <DotIcon />
                            Regenerate Link
                          </SuperAdminActionButton>

                          <SuperAdminActionButton>
                            <DotIcon />
                            Mark Paid
                          </SuperAdminActionButton>

                          <SuperAdminActionButton>
                            <DotIcon />
                            Waive Invoice
                          </SuperAdminActionButton>

                          <SuperAdminActionButton>
                            <DotIcon />
                            Extend Subscription
                          </SuperAdminActionButton>
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
