import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LeaseStatus, RecordStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { deactivateTenantAction } from '@/server/actions';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: { id: string } }) {
  const { landlordId } = await getCurrentLandlordWorkspace();

  const tenant = await prisma.tenant.findFirst({
    where: { id: params.id, landlordId },
    include: {
      leases: {
        where: { status: LeaseStatus.ACTIVE },
        include: { property: true, unit: true },
        orderBy: { startDate: 'desc' },
      },
      payments: {
        where: { status: { not: 'VOID' } },
        include: { unit: true, lease: true },
        orderBy: { dueDate: 'desc' },
      },
    },
  });

  if (!tenant) redirect('/unauthorized');

  const activeLease = tenant.leases[0] ?? null;
  const outstandingBalance = tenant.payments.reduce(
    (sum, payment) => sum + Number(payment.balance),
    0,
  );

  return (
    <Shell title={`Tenant: ${tenant.fullName}`}>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <section className="rounded-xl bg-white border shadow-sm p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-slate-500">Email</p>
                <p>{tenant.email}</p>
              </div>
              <div>
                <p className="text-slate-500">Phone</p>
                <p>{tenant.phone ?? '—'}</p>
              </div>
              <div>
                <p className="text-slate-500">Employer</p>
                <p>{tenant.employer ?? 'Not provided'}</p>
              </div>
              <div>
                <p className="text-slate-500">Status</p>
                <p>{tenant.status}</p>
              </div>
            </div>
          </section>

          <section className="rounded-xl bg-white border shadow-sm p-4">
            <h3 className="font-semibold">Active lease</h3>
            {!activeLease ? (
              <p className="text-slate-600 mt-4">No active lease for this tenant.</p>
            ) : (
              <div className="mt-4 space-y-2">
                <Link className="text-brand-navy" href={`/leases/${activeLease.id}`}>
                  Lease {activeLease.id}
                </Link>
                <p>{activeLease.property.name} / {activeLease.unit.unitName}</p>
                <p>{activeLease.startDate.toLocaleDateString()} — {activeLease.endDate.toLocaleDateString()}</p>
              </div>
            )}
          </section>

          <section className="rounded-xl bg-white border shadow-sm p-4">
            <h3 className="font-semibold">Balance summary</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-slate-500">Outstanding balance</p>
                <p className="text-xl font-semibold">${outstandingBalance.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-slate-500">Total paid</p>
                <p className="text-xl font-semibold">${tenant.payments.reduce((sum, p) => sum + Number(p.amountPaid ?? 0), 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-slate-500">Total due</p>
                <p className="text-xl font-semibold">${tenant.payments.reduce((sum, p) => sum + Number(p.amountDue), 0).toFixed(2)}</p>
              </div>
            </div>
          </section>

          <section className="rounded-xl bg-white border shadow-sm p-4">
            <h3 className="font-semibold">Payment history</h3>
            {tenant.payments.length === 0 ? (
              <p className="text-slate-600 mt-4">No payment history.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left p-2">Due Date</th>
                      <th className="text-left p-2">Payment Date</th>
                      <th className="text-right p-2">Amount Due</th>
                      <th className="text-right p-2">Amount Paid</th>
                      <th className="text-right p-2">Balance</th>
                      <th className="text-left p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {tenant.payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="p-2">{payment.dueDate.toLocaleDateString()}</td>
                        <td className="p-2">{payment.paymentDate?.toLocaleDateString() ?? '—'}</td>
                        <td className="p-2 text-right">${Number(payment.amountDue).toFixed(2)}</td>
                        <td className="p-2 text-right">${Number(payment.amountPaid ?? 0).toFixed(2)}</td>
                        <td className="p-2 text-right">${Number(payment.balance).toFixed(2)}</td>
                        <td className="p-2">{payment.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-xl bg-white border shadow-sm p-4">
            <h3 className="font-semibold">Maintenance</h3>
            <p className="text-slate-600 mt-2">Maintenance details are not available yet.</p>
          </section>

          <section className="rounded-xl bg-white border shadow-sm p-4">
            <h3 className="font-semibold">Documents</h3>
            <p className="text-slate-600 mt-2">Document management is not available yet.</p>
          </section>
        </div>

        <aside className="rounded-xl bg-white border shadow-sm p-4 space-y-4">
          <div>
            <p className="text-slate-500">Outstanding balance</p>
            <p>${outstandingBalance.toFixed(2)}</p>
          </div>

          <div className="space-y-2">
            <Link href="/tenants" className="text-brand-navy">Back to tenants</Link>
            <Link href="/leases" className="text-brand-navy">Create lease</Link>
            <Link href="/payments" className="text-brand-navy">Record payment</Link>
          </div>

          <form action={deactivateTenantAction}>
            <input type="hidden" name="tenantId" value={tenant.id} />
            <button className="rounded border px-3 py-2 w-full text-left">Deactivate tenant</button>
          </form>
        </aside>
      </div>
    </Shell>
  );
}
