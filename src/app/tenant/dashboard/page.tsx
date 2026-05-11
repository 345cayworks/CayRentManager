import { UserRole } from '@prisma/client';
import { Shell } from '@/components/shell';
import { requireRole } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

function money(value: unknown) {
  return `$${Number(value ?? 0).toFixed(2)}`;
}

function statusBadge(status: string) {
  const className =
    status === 'PAID'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : status === 'PARTIAL'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : status === 'OVERDUE'
          ? 'bg-red-50 text-red-700 border-red-200'
          : 'bg-slate-50 text-slate-700 border-slate-200';

  return <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${className}`}>{status}</span>;
}

export default async function Page() {
  const user = await requireRole([UserRole.TENANT, UserRole.SUPERADMIN]);
  const tenant = await prisma.tenant.findFirst({
    where: user.role === UserRole.SUPERADMIN ? {} : { userId: user.userId },
    include: {
      leases: { include: { unit: true, property: true }, orderBy: { createdAt: 'desc' } },
      invoices: { include: { property: true, unit: true }, orderBy: { dueDate: 'desc' } },
      payments: { include: { invoice: true, receipt: true, property: true, unit: true }, orderBy: { paymentDate: 'desc' } },
    },
  });

  const activeLease = tenant?.leases[0];
  const outstandingBalance = tenant?.invoices.reduce((sum, invoice) => sum + Number(invoice.balance), 0) ?? 0;
  const paidTotal = tenant?.payments.reduce((sum, payment) => sum + Number(payment.amountPaid ?? 0), 0) ?? 0;
  const nextOpenInvoice = tenant?.invoices.find((invoice) => Number(invoice.balance) > 0);

  return (
    <Shell title="Tenant Dashboard">
      {!tenant ? <div className="rounded-xl bg-white border shadow-sm p-6 text-slate-600">No tenant profile is linked to this account.</div> : null}
      {tenant ? (
        <div className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-4">
            <section className="rounded-xl bg-white border shadow-sm p-6">
              <h3 className="font-semibold">Lease</h3>
              {activeLease ? (
                <p className="text-sm text-slate-600 mt-2">{activeLease.property.name} / {activeLease.unit.unitName}</p>
              ) : (
                <p className="text-sm text-slate-600 mt-2">No lease yet.</p>
              )}
            </section>
            <section className="rounded-xl bg-white border shadow-sm p-6">
              <h3 className="font-semibold">Outstanding Balance</h3>
              <p className="text-2xl font-semibold mt-2">{money(outstandingBalance)}</p>
            </section>
            <section className="rounded-xl bg-white border shadow-sm p-6">
              <h3 className="font-semibold">Paid to Date</h3>
              <p className="text-2xl font-semibold mt-2">{money(paidTotal)}</p>
            </section>
          </div>

          <section className="rounded-xl bg-white border shadow-sm p-6">
            <h3 className="font-semibold">Next Payment Due</h3>
            {nextOpenInvoice ? (
              <div className="mt-3 grid md:grid-cols-4 gap-3 text-sm">
                <div>
                  <p className="text-slate-500">Invoice</p>
                  <p className="font-medium">{nextOpenInvoice.invoiceNo}</p>
                </div>
                <div>
                  <p className="text-slate-500">Due Date</p>
                  <p className="font-medium">{nextOpenInvoice.dueDate.toLocaleDateString()}</p>
                </div>
                <div>
                  <p className="text-slate-500">Balance</p>
                  <p className="font-medium">{money(nextOpenInvoice.balance)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Status</p>
                  <p>{statusBadge(nextOpenInvoice.status)}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-600 mt-2">No open invoices.</p>
            )}
          </section>

          <section className="rounded-xl bg-white border shadow-sm overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Invoices</h3>
            </div>
            {tenant.invoices.length === 0 ? (
              <p className="p-4 text-slate-600">No invoices yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left p-3">Invoice</th>
                      <th className="text-left p-3">Property/Unit</th>
                      <th className="text-left p-3">Due</th>
                      <th className="text-right p-3">Amount</th>
                      <th className="text-right p-3">Paid</th>
                      <th className="text-right p-3">Balance</th>
                      <th className="text-left p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {tenant.invoices.map((invoice) => (
                      <tr key={invoice.id}>
                        <td className="p-3 font-medium">{invoice.invoiceNo}</td>
                        <td className="p-3">{invoice.property.name} / {invoice.unit.unitName}</td>
                        <td className="p-3">{invoice.dueDate.toLocaleDateString()}</td>
                        <td className="p-3 text-right">{money(invoice.amount)}</td>
                        <td className="p-3 text-right">{money(invoice.amountPaid)}</td>
                        <td className="p-3 text-right">{money(invoice.balance)}</td>
                        <td className="p-3">{statusBadge(invoice.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-xl bg-white border shadow-sm overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-semibold">Payment History & Receipts</h3>
            </div>
            {tenant.payments.length === 0 ? (
              <p className="p-4 text-slate-600">No payments yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left p-3">Date</th>
                      <th className="text-left p-3">Invoice</th>
                      <th className="text-left p-3">Property/Unit</th>
                      <th className="text-right p-3">Paid</th>
                      <th className="text-left p-3">Method</th>
                      <th className="text-left p-3">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {tenant.payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="p-3">{payment.paymentDate?.toLocaleDateString() ?? '—'}</td>
                        <td className="p-3">{payment.invoice?.invoiceNo ?? 'Manual'}</td>
                        <td className="p-3">{payment.property.name} / {payment.unit.unitName}</td>
                        <td className="p-3 text-right">{money(payment.amountPaid)}</td>
                        <td className="p-3">{payment.paymentMethod ?? '—'}</td>
                        <td className="p-3">{payment.receipt?.receiptNo ?? 'Pending'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </Shell>
  );
}
