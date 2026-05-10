import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LeaseStatus, PaymentStatus, RecordStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { archiveUnitAction } from '@/server/actions';

export const dynamic = 'force-dynamic';

export default async function Page({ params }: { params: { id: string } }) {
  const { landlordId } = await getCurrentLandlordWorkspace();

  const unit = await prisma.unit.findFirst({
    where: { id: params.id, landlordId },
    include: {
      property: true,
      leases: {
        where: { status: LeaseStatus.ACTIVE },
        include: { tenant: true },
        orderBy: { startDate: 'desc' },
      },
      payments: {
        where: { status: { not: PaymentStatus.VOID } },
        include: { tenant: true, lease: true },
        orderBy: { dueDate: 'desc' },
      },
      expenses: {
        where: { status: RecordStatus.ACTIVE },
        orderBy: { expenseDate: 'desc' },
      },
    },
  });

  if (!unit) redirect('/unauthorized');

  const activeLease = unit.leases[0] ?? null;
  const outstandingBalance = unit.payments.reduce(
    (sum, payment) => sum + Number(payment.balance),
    0,
  );

  return (
    <Shell title={`Unit: ${unit.unitName}`}>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <section className="rounded-xl bg-white border shadow-sm p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-slate-500">Property</p>
                <Link className="text-brand-navy" href={`/properties/${unit.property.id}`}>
                  {unit.property.name}
                </Link>
              </div>
              <div>
                <p className="text-slate-500">Status</p>
                <p>{unit.status}</p>
              </div>
              <div>
                <p className="text-slate-500">Rent amount</p>
                <p>${Number(unit.rentAmount).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-slate-500">Deposit amount</p>
                <p>${Number(unit.depositAmount ?? 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-slate-500">Bedrooms</p>
                <p>{unit.bedrooms ?? '—'}</p>
              </div>
              <div>
                <p className="text-slate-500">Bathrooms</p>
                <p>{unit.bathrooms?.toString() ?? '—'}</p>
              </div>
            </div>
          </section>

          <section className="rounded-xl bg-white border shadow-sm p-4">
            <h3 className="font-semibold">Current active lease</h3>
            {!activeLease ? (
              <p className="text-slate-600 mt-4">No active lease for this unit.</p>
            ) : (
              <div className="mt-4 space-y-2">
                <Link className="text-brand-navy" href={`/leases/${activeLease.id}`}>
                  Lease {activeLease.id}
                </Link>
                <p>{activeLease.tenant.fullName}</p>
                <p>{activeLease.startDate.toLocaleDateString()} — {activeLease.endDate.toLocaleDateString()}</p>
              </div>
            )}
          </section>

          <section className="rounded-xl bg-white border shadow-sm p-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Payments</h3>
              <Link className="text-brand-navy text-sm" href="/payments">Record payment</Link>
            </div>
            {unit.payments.length === 0 ? (
              <p className="text-slate-600 mt-4">No payments for this unit.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {unit.payments.map((payment) => (
                  <li key={payment.id} className="flex justify-between">
                    <div>
                      <p>{payment.tenant.fullName}</p>
                      <p className="text-slate-500 text-sm">{payment.dueDate.toLocaleDateString()}</p>
                    </div>
                    <p>${Number(payment.amountPaid ?? 0).toFixed(2)}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl bg-white border shadow-sm p-4">
            <div className="flex justify-between items-center">
              <h3 className="font-semibold">Expenses</h3>
              <Link className="text-brand-navy text-sm" href="/expenses">Add expense</Link>
            </div>
            {unit.expenses.length === 0 ? (
              <p className="text-slate-600 mt-4">No expenses for this unit.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {unit.expenses.map((expense) => (
                  <li key={expense.id} className="flex justify-between">
                    <span>{expense.category}</span>
                    <span>${Number(expense.amount).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="rounded-xl bg-white border shadow-sm p-4 space-y-4">
          <div>
            <p className="text-slate-500">Outstanding balance</p>
            <p>${outstandingBalance.toFixed(2)}</p>
          </div>

          <div className="space-y-2">
            <Link href="/units" className="text-brand-navy">Back to units</Link>
            <Link href="/leases" className="text-brand-navy">Create lease</Link>
            <Link href="/payments" className="text-brand-navy">Record payment</Link>
            <Link href="/expenses" className="text-brand-navy">Add expense</Link>
          </div>

          <form action={archiveUnitAction}>
            <input type="hidden" name="unitId" value={unit.id} />
            <button className="rounded border px-3 py-2 w-full text-left">Archive unit</button>
          </form>
        </aside>
      </div>
    </Shell>
  );
}
