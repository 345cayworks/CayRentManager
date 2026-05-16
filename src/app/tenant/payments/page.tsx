import Link from 'next/link';
import { UserRole } from '@prisma/client';
import { Shell } from '@/components/shell';
import { requireRole } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { getEffectiveTimezone } from '@/lib/time/effective';
import { formatDate } from '@/lib/time/format';

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
  const tz = await getEffectiveTimezone();
  const tenant = await prisma.tenant.findFirst({
    where: user.role === UserRole.SUPERADMIN ? {} : { userId: user.userId },
    include: {
      payments: {
        include: { invoice: true, receipt: true, property: true, unit: true },
        where: { status: { not: 'VOID' } },
        orderBy: { dueDate: 'desc' },
      },
      invoices: true,
    },
  });

  if (!tenant) {
    return (
      <Shell title="Tenant Payments">
        <div className="rounded-xl bg-white border shadow-sm p-6 text-slate-600">No tenant profile is linked to this account.</div>
      </Shell>
    );
  }

  const now = new Date();
  const totalBilled = tenant.payments.reduce((sum, p) => sum + Number(p.amountDue ?? 0), 0);
  const totalPaid = tenant.payments.reduce((sum, p) => sum + Number(p.amountPaid ?? 0), 0);
  const outstanding = tenant.payments.reduce((sum, p) => sum + Number(p.balance ?? 0), 0);
  const overdue = tenant.payments.reduce(
    (sum, p) => (p.dueDate < now && Number(p.balance ?? 0) > 0 ? sum + Number(p.balance ?? 0) : sum),
    0,
  );

  return (
    <Shell title="Tenant Payments">
      <div className="space-y-6">
        <div className="grid md:grid-cols-4 gap-4">
          {[
            { label: 'Total Billed', value: totalBilled },
            { label: 'Total Paid', value: totalPaid },
            { label: 'Outstanding', value: outstanding },
            { label: 'Overdue', value: overdue },
          ].map((card) => (
            <section key={card.label} className="rounded-xl bg-white border shadow-sm p-6">
              <h3 className="font-semibold">{card.label}</h3>
              <p className="text-2xl font-semibold mt-2">{money(card.value)}</p>
            </section>
          ))}
        </div>

        <p className="text-sm text-slate-500">
          Need to submit a payment proof?{' '}
          <Link className="text-brand-navy underline" href="/tenant/dashboard">Go to your dashboard</Link>.
        </p>

        <section className="rounded-xl bg-white border shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Payment History</h3>
          </div>
          {tenant.payments.length === 0 ? (
            <p className="p-4 text-slate-600">No payments yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-3">Due</th>
                    <th className="text-left p-3">Paid On</th>
                    <th className="text-left p-3">Property/Unit</th>
                    <th className="text-right p-3">Amount Due</th>
                    <th className="text-right p-3">Amount Paid</th>
                    <th className="text-right p-3">Balance</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Method</th>
                    <th className="text-left p-3">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {tenant.payments.map((payment) => (
                    <tr key={payment.id}>
                      <td className="p-3">{formatDate(payment.dueDate, tz)}</td>
                      <td className="p-3">{payment.paymentDate ? formatDate(payment.paymentDate, tz) : '—'}</td>
                      <td className="p-3">{payment.property.name} / {payment.unit.unitName}</td>
                      <td className="p-3 text-right">{money(payment.amountDue)}</td>
                      <td className="p-3 text-right">{money(payment.amountPaid)}</td>
                      <td className="p-3 text-right">{money(payment.balance)}</td>
                      <td className="p-3">{statusBadge(payment.status)}</td>
                      <td className="p-3">{payment.paymentMethod ?? '—'}</td>
                      <td className="p-3">
                        {payment.receipt ? (
                          <Link className="text-brand-navy underline" href={`/api/receipts/${payment.receipt.id}`} target="_blank">{payment.receipt.receiptNo}</Link>
                        ) : (
                          'Pending'
                        )}
                      </td>
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
