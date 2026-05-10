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
            <h3 className="font-semibold">Payment history</h3>
            {tenant.payments.length === 0 ? (
              <p className="text-slate-600 mt-4">No payment history.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {tenant.payments.map((payment) => (
                  <li key={payment.id} className="flex justify-between">
                    <div>
                      <p>{payment.lease ? `Lease ${payment.lease.id}` : payment.unit.unitName}</p>
                      <p className="text-slate-500 text-sm">{payment.dueDate.toLocaleDateString()}</p>
                    </div>
                    <p>${Number(payment.amountPaid ?? 0).toFixed(2)}</p>
                  </li>
                ))}
              </ul>
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
