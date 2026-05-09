import { PaymentStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { recordPaymentAction } from '@/server/actions';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const { landlordId } = await getCurrentLandlordWorkspace();
  const [leases, payments] = await Promise.all([
    prisma.lease.findMany({ where: { landlordId, status: 'ACTIVE' }, include: { tenant: true, unit: true }, orderBy: { createdAt: 'desc' } }),
    prisma.payment.findMany({ where: { landlordId, status: { not: PaymentStatus.VOID } }, include: { tenant: true, unit: true }, orderBy: { createdAt: 'desc' } }),
  ]);

  return (
    <Shell title="Payments">
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
      <div className="rounded-xl bg-white border shadow-sm divide-y">
        {payments.length === 0 ? <p className="p-4 text-slate-600">No payments yet.</p> : null}
        {payments.map((payment) => (
          <div key={payment.id} className="p-4 flex justify-between gap-4">
            <div>
              <p className="font-medium">{payment.tenant.fullName} / {payment.unit.unitName}</p>
              <p className="text-sm text-slate-600">Due {payment.dueDate.toLocaleDateString()} / {payment.status}</p>
            </div>
            <p className="font-medium">${Number(payment.amountPaid ?? 0).toFixed(2)}</p>
          </div>
        ))}
      </div>
    </Shell>
  );
}
