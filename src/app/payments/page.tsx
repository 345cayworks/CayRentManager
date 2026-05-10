import Link from 'next/link';
import { PaymentStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { recordPaymentAction, voidPaymentAction } from '@/server/actions';
import { getCurrentMonthRange } from '@/lib/finance/landlord-financials';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const { landlordId } = await getCurrentLandlordWorkspace();

  const { start: startOfMonth, end: endOfMonth } = getCurrentMonthRange();
  const now = new Date();

  const [leases, payments, tenants, properties] = await Promise.all([
    prisma.lease.findMany({ where: { landlordId, status: 'ACTIVE' }, include: { tenant: true, unit: true }, orderBy: { createdAt: 'desc' } }),
    prisma.payment.findMany({
      where: { landlordId, status: { not: PaymentStatus.VOID } },
      include: { tenant: true, unit: { include: { property: true } }, lease: true },
      orderBy: { dueDate: 'desc' },
    }),
    prisma.tenant.findMany({ where: { landlordId, status: 'ACTIVE' }, orderBy: { fullName: 'asc' } }),
    prisma.property.findMany({ where: { landlordId, status: 'ACTIVE' }, orderBy: { name: 'asc' } }),
  ]);

  const thisMonthDuePayments = payments.filter(p => p.dueDate >= startOfMonth && p.dueDate < endOfMonth);
  const thisMonthCollectedPayments = payments.filter(p => p.paymentDate && p.paymentDate >= startOfMonth && p.paymentDate < endOfMonth);
  const totalDueThisMonth = thisMonthDuePayments.reduce((sum, p) => sum + Number(p.amountDue), 0);
  const totalCollectedThisMonth = thisMonthCollectedPayments.reduce((sum, p) => sum + Number(p.amountPaid ?? 0), 0);
  const outstandingBalance = payments.reduce((sum, p) => sum + Number(p.balance), 0);
  const overdueAmount = payments.filter(p => p.dueDate < now && Number(p.balance) > 0).reduce((sum, p) => sum + Number(p.balance), 0);

  return (
    <Shell title="Payments">
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <div className="rounded-xl bg-white border shadow-sm p-4">
          <p className="text-slate-500">Due this month</p>
          <p className="text-2xl font-semibold">${totalDueThisMonth.toFixed(2)}</p>
        </div>
        <div className="rounded-xl bg-white border shadow-sm p-4">
          <p className="text-slate-500">Collected this month</p>
          <p className="text-2xl font-semibold">${totalCollectedThisMonth.toFixed(2)}</p>
        </div>
        <div className="rounded-xl bg-white border shadow-sm p-4">
          <p className="text-slate-500">Outstanding balance</p>
          <p className="text-2xl font-semibold">${outstandingBalance.toFixed(2)}</p>
        </div>
        <div className="rounded-xl bg-white border shadow-sm p-4">
          <p className="text-slate-500">Overdue amount</p>
          <p className="text-2xl font-semibold">${overdueAmount.toFixed(2)}</p>
        </div>
      </div>

      <form action={recordPaymentAction} className="grid md:grid-cols-6 gap-3 rounded-xl bg-white border shadow-sm p-4 mb-4">
        <select required name="leaseId" className="border rounded px-3 py-2 md:col-span-2">
          <option value="">Lease</option>
          {leases.map((lease) => <option key={lease.id} value={lease.id}>{lease.tenant.fullName} / {lease.unit.unitName}</option>)}
        </select>
        <input required name="dueDate" type="date" className="border rounded px-3 py-2" />
        <input name="paymentDate" type="date" className="border rounded px-3 py-2" />
        <input name="amountDue" type="number" step="0.01" placeholder="Amount due" className="border rounded px-3 py-2" />
        <input required name="amountPaid" type="number" step="0.01" placeholder="Paid" className="border rounded px-3 py-2" />
        <input name="paymentMethod" placeholder="Method" className="border rounded px-3 py-2" />
        <button className="rounded bg-brand-navy text-white px-4 py-2 md:col-span-5">Record payment</button>
      </form>

      <div className="rounded-xl bg-white border shadow-sm overflow-hidden">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-semibold">Payment history</h3>
          <Link href="/api/payments/export" className="rounded border px-3 py-2 text-sm">
            Export CSV
          </Link>
        </div>
        {payments.length === 0 ? (
          <p className="p-4 text-slate-600">No payments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-3">Tenant</th>
                  <th className="text-left p-3">Property/Unit</th>
                  <th className="text-left p-3">Due Date</th>
                  <th className="text-left p-3">Payment Date</th>
                  <th className="text-right p-3">Amount Due</th>
                  <th className="text-right p-3">Amount Paid</th>
                  <th className="text-right p-3">Balance</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="p-3">
                      <Link href={`/tenants/${payment.tenant.id}`} className="text-brand-navy">
                        {payment.tenant.fullName}
                      </Link>
                    </td>
                    <td className="p-3">
                      <Link href={`/properties/${payment.unit.property.id}`} className="text-brand-navy">
                        {payment.unit.property.name}
                      </Link> / {payment.unit.unitName}
                    </td>
                    <td className="p-3">{payment.dueDate.toLocaleDateString()}</td>
                    <td className="p-3">{payment.paymentDate?.toLocaleDateString() ?? '—'}</td>
                    <td className="p-3 text-right">${Number(payment.amountDue).toFixed(2)}</td>
                    <td className="p-3 text-right">${Number(payment.amountPaid ?? 0).toFixed(2)}</td>
                    <td className="p-3 text-right">${Number(payment.balance).toFixed(2)}</td>
                    <td className="p-3">{payment.status}</td>
                    <td className="p-3">
                      <form action={voidPaymentAction} className="inline">
                        <input type="hidden" name="paymentId" value={payment.id} />
                        <button className="text-sm rounded border px-2 py-1">Void</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Shell>
  );
}
