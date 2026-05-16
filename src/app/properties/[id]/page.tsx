import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PaymentStatus, RecordStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { archivePropertyAction, updatePropertyAction } from '@/server/actions';
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

  const property = await prisma.property.findFirst({
    where: { id: params.id, landlordId },
    include: {
      units: { orderBy: { unitName: 'asc' } },
      leases: {
        where: { status: 'ACTIVE' },
        include: { tenant: true, unit: true },
        orderBy: { startDate: 'desc' },
      },
      payments: {
        where: { status: { not: PaymentStatus.VOID } },
        include: { tenant: true, unit: true },
        orderBy: { dueDate: 'desc' },
      },
      expenses: {
        where: { status: RecordStatus.ACTIVE },
        orderBy: { expenseDate: 'desc' },
      },
    },
  });

  if (!property) redirect('/unauthorized');

  const propertyPhotos = await prisma.propertyPhoto.findMany({
    where: { propertyId: property.id, archivedAt: null },
    orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
  });

  const monthlyRentExpected = property.leases.reduce(
    (sum, lease) => sum + Number(lease.rentAmount),
    0,
  );

  const monthlyRentCollected = property.payments.reduce(
    (sum, payment) => sum + Number(payment.amountPaid ?? 0),
    0,
  );

  const monthlyExpenses = property.expenses.reduce(
    (sum, expense) => sum + Number(expense.amount),
    0,
  );

  return (
    <Shell title={`Property: ${property.name}`}>
      <div className="space-y-4">
        {justUpdated && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Changes saved.
          </div>
        )}
        <section className="rounded-xl bg-white border shadow-sm p-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-slate-500">Address</p>
              <p>{property.address}</p>
            </div>
            <div>
              <p className="text-slate-500">Location</p>
              <p>{property.city}, {property.state}, {property.country}</p>
            </div>
            <div>
              <p className="text-slate-500">Type</p>
              <p>{property.propertyType}</p>
            </div>
            <div>
              <p className="text-slate-500">Status</p>
              <p>{property.status}</p>
            </div>
          </div>

          <details id="edit" open={editOpen} className="mt-4 border-t pt-4">
            <summary className="cursor-pointer list-none rounded-lg border border-brand-navy/30 bg-brand-navy/5 px-3 py-2 text-sm font-medium text-brand-navy hover:bg-brand-navy/10">
              ✏️ Edit property details
            </summary>
            <form action={updatePropertyAction} className="mt-4 grid gap-3 sm:grid-cols-2">
              <input type="hidden" name="propertyId" value={property.id} />
              <label className="text-sm">
                <span className="text-slate-500">Name</span>
                <input
                  name="name"
                  required
                  defaultValue={property.name}
                  className="mt-1 block w-full rounded border px-3 py-2 text-slate-950 bg-white"
                />
              </label>
              <label className="text-sm">
                <span className="text-slate-500">Property type</span>
                <input
                  name="propertyType"
                  defaultValue={property.propertyType}
                  className="mt-1 block w-full rounded border px-3 py-2 text-slate-950 bg-white"
                />
              </label>
              <label className="text-sm sm:col-span-2">
                <span className="text-slate-500">Address</span>
                <input
                  name="address"
                  required
                  defaultValue={property.address}
                  className="mt-1 block w-full rounded border px-3 py-2 text-slate-950 bg-white"
                />
              </label>
              <label className="text-sm">
                <span className="text-slate-500">City</span>
                <input
                  name="city"
                  required
                  defaultValue={property.city}
                  className="mt-1 block w-full rounded border px-3 py-2 text-slate-950 bg-white"
                />
              </label>
              <label className="text-sm">
                <span className="text-slate-500">State / Parish</span>
                <input
                  name="state"
                  required
                  defaultValue={property.state}
                  className="mt-1 block w-full rounded border px-3 py-2 text-slate-950 bg-white"
                />
              </label>
              <label className="text-sm">
                <span className="text-slate-500">Country</span>
                <input
                  name="country"
                  defaultValue={property.country}
                  className="mt-1 block w-full rounded border px-3 py-2 text-slate-950 bg-white"
                />
              </label>
              <label className="text-sm">
                <span className="text-slate-500">Purchase price (optional)</span>
                <input
                  name="purchasePrice"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={property.purchasePrice?.toString() ?? ''}
                  className="mt-1 block w-full rounded border px-3 py-2 text-slate-950 bg-white"
                />
              </label>
              <label className="text-sm">
                <span className="text-slate-500">Estimated value (optional)</span>
                <input
                  name="estimatedValue"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={property.estimatedValue?.toString() ?? ''}
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
          kind="property"
          entityId={property.id}
          photos={propertyPhotos.map((p) => ({
            id: p.id,
            fileName: p.fileName,
            isPrimary: p.isPrimary,
            contentType: p.contentType,
          }))}
        />

        <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <section className="rounded-xl bg-white border shadow-sm p-4">
              <h3 className="font-semibold">Financial summary</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-slate-500">Monthly rent expected</p>
                  <p className="text-xl font-semibold">${monthlyRentExpected.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Monthly rent collected</p>
                  <p className="text-xl font-semibold">${monthlyRentCollected.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Monthly expenses</p>
                  <p className="text-xl font-semibold">${monthlyExpenses.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Net cashflow</p>
                  <p className="text-xl font-semibold">${(monthlyRentCollected - monthlyExpenses).toFixed(2)}</p>
                </div>
              </div>
            </section>
            <section className="rounded-xl bg-white border shadow-sm p-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Units</h3>
                <Link className="text-brand-navy text-sm" href="/units">Add unit</Link>
              </div>
              {property.units.length === 0 ? (
                <p className="text-slate-600 mt-4">No units attached to this property.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {property.units.map((unit) => (
                    <li key={unit.id}>
                      <Link className="text-brand-navy" href={`/units/${unit.id}`}>
                        {unit.unitName}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl bg-white border shadow-sm p-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Active leases</h3>
                <Link className="text-brand-navy text-sm" href="/leases">View all leases</Link>
              </div>
              {property.leases.length === 0 ? (
                <p className="text-slate-600 mt-4">No active leases for units in this property.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {property.leases.map((lease) => (
                    <li key={lease.id}>
                      <Link className="text-brand-navy" href={`/leases/${lease.id}`}>
                        {lease.tenant.fullName} / {lease.unit.unitName}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl bg-white border shadow-sm p-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">Payments</h3>
                <Link className="text-brand-navy text-sm" href="/payments">Record payment</Link>
              </div>
              {property.payments.length === 0 ? (
                <p className="text-slate-600 mt-4">No payments recorded for this property.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {property.payments.map((payment) => (
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
              {property.expenses.length === 0 ? (
                <p className="text-slate-600 mt-4">No expenses recorded for this property.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {property.expenses.map((expense) => (
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
              <p className="text-slate-500">Monthly rent expected</p>
              <p>${monthlyRentExpected.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-slate-500">Monthly rent collected</p>
              <p>${monthlyRentCollected.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-slate-500">Monthly expenses</p>
              <p>${monthlyExpenses.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-slate-500">Net cashflow</p>
              <p>${(monthlyRentCollected - monthlyExpenses).toFixed(2)}</p>
            </div>

            <div className="space-y-2">
              <Link
                href={`/properties/${property.id}?edit=1#edit`}
                className="block rounded bg-brand-navy px-3 py-2 text-center text-sm font-medium text-white hover:bg-brand-navy/90"
              >
                ✏️ Edit property
              </Link>
              <Link href="/properties" className="block text-sm text-brand-navy">
                Back to properties
              </Link>
              <form action={archivePropertyAction} className="mt-2">
                <input type="hidden" name="propertyId" value={property.id} />
                <button className="w-full rounded border border-slate-200 px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50">
                  Archive property
                </button>
              </form>
            </div>
          </aside>
        </div>
      </div>
    </Shell>
  );
}
