import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LeaseStatus, PaymentStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { expireLeaseAction, terminateLeaseAction } from '@/server/actions';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: { id: string } }) {
  const { landlordId } = await getCurrentLandlordWorkspace();

  const lease = await prisma.lease.findFirst({
    where: { id: params.id, landlordId },
    include: {
      tenant: true,
      property: true,
      unit: true,
      payments: {
        where: { status: { not: PaymentStatus.VOID } },
        orderBy: { dueDate: 'desc' },
      },
    },
  });

  if (!lease) redirect('/unauthorized');

  const outstandingBalance = lease.payments.reduce(
    (sum, payment) => sum + Number(payment.balance),
    0,
  );

  return (
    <Shell title={`Lease: ${lease.id}`}>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <section className="rounded-xl bg-white border shadow-sm p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-slate-500">Tenant</p>
                <Link className="text-brand-navy" href={`/tenants/${lease.tenant.id}`}>
                  {lease.tenant.fullName}
                </Link>
              </div>
              <div>
                <p className="text-slate-500">Property</p>
                <Link className="text-brand-navy" href={`/properties/${lease.property.id}`}>
                  {lease.property.name}
                </Link>
              </div>
              <div>
                <p className="text-slate-500">Unit</p>
                <Link className="text-brand-navy" href={`/units/${lease.unit.id}`}>
                  {lease.unit.unitName}
                </Link>
              </div>
              <div>
                <p className="text-slate-500">Status</p>
                <p>{lease.status}</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 mt-4">
              <div>
                <p className="text-slate-500">Start date</p>
                <p>{lease.startDate.toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-slate-500">End date</p>
                <p>{lease.endDate.toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-slate-500">Rent amount</p>
                <p>${Number(lease.rentAmount).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-slate-500">Deposit amount</p>
                <p>${Number(lease.depositAmount ?? 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-slate-500">Late fee amount</p>
                <p>${Number(lease.lateFeeAmount ?? 0).toFixed(2)}</p>
              </div>
            </div>
          </section>

          <section className="rounded-xl bg-white border shadow-sm p-4">
            <h3 className="font-semibold">Payment history</h3>
            {lease.payments.length === 0 ? (
              <p className="text-slate-600 mt-4">No payments recorded for this lease.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {lease.payments.map((payment) => (
                  <li key={payment.id} className="flex justify-between">
                    <span>{payment.dueDate.toLocaleDateString()}</span>
                    <span>${Number(payment.amountPaid ?? 0).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
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
            <Link href="/leases" className="text-brand-navy">Back to leases</Link>
            <Link href="/payments" className="text-brand-navy">Record payment</Link>
          </div>

          <form action={terminateLeaseAction}>
            <input type="hidden" name="leaseId" value={lease.id} />
            <button className="rounded border px-3 py-2 w-full text-left">Terminate lease</button>
          </form>

          <form action={expireLeaseAction}>
            <input type="hidden" name="leaseId" value={lease.id} />
            <button className="rounded border px-3 py-2 w-full text-left">Expire lease</button>
          </form>
        </aside>
      </div>
    </Shell>
  );
}
