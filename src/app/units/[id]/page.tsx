import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LeaseStatus, PaymentStatus, RecordStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { archiveUnitAction, updateUnitAction } from '@/server/actions';
import { PhotoManager } from '@/components/photo-manager';
import { getEffectiveTimezone } from '@/lib/time/effective';
import { formatDate } from '@/lib/time/format';

export const dynamic = 'force-dynamic';

export default async function Page({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { edit?: string; updated?: string };
}) {
  const { landlordId } = await getCurrentLandlordWorkspace();
  const tz = await getEffectiveTimezone();
  const editOpen = searchParams?.edit === '1';
  const justUpdated = searchParams?.updated === '1';

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

  const unitPhotos = await prisma.unitPhoto.findMany({
    where: { unitId: unit.id, archivedAt: null },
    orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
  });

  const activeLease = unit.leases[0] ?? null;
  const outstandingBalance = unit.payments.reduce(
    (sum, payment) => sum + Number(payment.balance),
    0,
  );

  return (
    <Shell title={`Unit: ${unit.unitName}`}>
      {justUpdated && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Changes saved.
        </div>
      )}
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

            <details id="edit" open={editOpen} className="mt-4 border-t pt-4">
              <summary className="cursor-pointer list-none rounded-lg border border-brand-navy/30 bg-brand-navy/5 px-3 py-2 text-sm font-medium text-brand-navy hover:bg-brand-navy/10">
                ✏️ Edit unit details
              </summary>
              <p className="mt-2 text-xs text-slate-500">
                Editing rent or deposit does not change amounts on existing leases or invoices —
                those are snapshotted at creation. New leases will use the updated values.
              </p>
              <form action={updateUnitAction} className="mt-4 grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="unitId" value={unit.id} />
                <label className="text-sm">
                  <span className="text-slate-500">Unit name</span>
                  <input
                    name="unitName"
                    required
                    defaultValue={unit.unitName}
                    className="mt-1 block w-full rounded border px-3 py-2 text-slate-950 bg-white"
                  />
                </label>
                <label className="text-sm">
                  <span className="text-slate-500">Rent amount</span>
                  <input
                    name="rentAmount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    defaultValue={Number(unit.rentAmount).toString()}
                    className="mt-1 block w-full rounded border px-3 py-2 text-slate-950 bg-white"
                  />
                </label>
                <label className="text-sm">
                  <span className="text-slate-500">Deposit amount (optional)</span>
                  <input
                    name="depositAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={unit.depositAmount ? Number(unit.depositAmount).toString() : ''}
                    className="mt-1 block w-full rounded border px-3 py-2 text-slate-950 bg-white"
                  />
                </label>
                <label className="text-sm">
                  <span className="text-slate-500">Bedrooms</span>
                  <input
                    name="bedrooms"
                    type="number"
                    step="1"
                    min="0"
                    defaultValue={unit.bedrooms?.toString() ?? ''}
                    className="mt-1 block w-full rounded border px-3 py-2 text-slate-950 bg-white"
                  />
                </label>
                <label className="text-sm">
                  <span className="text-slate-500">Bathrooms</span>
                  <input
                    name="bathrooms"
                    type="number"
                    step="0.5"
                    min="0"
                    defaultValue={unit.bathrooms ? Number(unit.bathrooms).toString() : ''}
                    className="mt-1 block w-full rounded border px-3 py-2 text-slate-950 bg-white"
                  />
                </label>
                <label className="text-sm">
                  <span className="text-slate-500">Square feet</span>
                  <input
                    name="squareFeet"
                    type="number"
                    step="1"
                    min="0"
                    defaultValue={unit.squareFeet?.toString() ?? ''}
                    className="mt-1 block w-full rounded border px-3 py-2 text-slate-950 bg-white"
                  />
                </label>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="rounded bg-brand-navy px-4 py-2 text-sm font-medium text-white"
                  >
                    Save changes
                  </button>
                </div>
              </form>
            </details>
          </section>

          <PhotoManager
            kind="unit"
            entityId={unit.id}
            photos={unitPhotos.map((p) => ({
              id: p.id,
              fileName: p.fileName,
              isPrimary: p.isPrimary,
              contentType: p.contentType,
            }))}
          />

          <section className="rounded-xl bg-white border shadow-sm p-4">
            <h3 className="font-semibold">Balance summary</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-slate-500">Outstanding balance</p>
                <p className="text-xl font-semibold">${outstandingBalance.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-slate-500">Total paid</p>
                <p className="text-xl font-semibold">${unit.payments.reduce((sum, p) => sum + Number(p.amountPaid ?? 0), 0).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-slate-500">Total due</p>
                <p className="text-xl font-semibold">${unit.payments.reduce((sum, p) => sum + Number(p.amountDue), 0).toFixed(2)}</p>
              </div>
            </div>
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
                      <p className="text-slate-500 text-sm">{formatDate(payment.dueDate, tz)}</p>
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

          <Link
            href={`/units/${unit.id}?edit=1#edit`}
            className="block rounded bg-brand-navy px-3 py-2 text-center text-sm font-medium text-white hover:bg-brand-navy/90"
          >
            ✏️ Edit unit
          </Link>

          <div className="space-y-2">
            <Link href="/units" className="block text-sm text-brand-navy">Back to units</Link>
            <Link href="/leases" className="block text-sm text-brand-navy">Create lease</Link>
            <Link href="/payments" className="block text-sm text-brand-navy">Record payment</Link>
            <Link href="/expenses" className="block text-sm text-brand-navy">Add expense</Link>
          </div>

          <form action={archiveUnitAction}>
            <input type="hidden" name="unitId" value={unit.id} />
            <button className="w-full rounded border border-slate-200 px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50">
              Archive unit
            </button>
          </form>
        </aside>
      </div>
    </Shell>
  );
}
