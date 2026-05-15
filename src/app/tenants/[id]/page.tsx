import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LeaseStatus, RecordStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { deactivateTenantAction, updateTenantAction } from '@/server/actions';
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
              <div>
                <p className="text-slate-500">Emergency contact</p>
                <p>
                  {tenant.emergencyContactName ?? '—'}
                  {tenant.emergencyContactPhone ? ` · ${tenant.emergencyContactPhone}` : ''}
                </p>
              </div>
            </div>

            <details id="edit" open={editOpen} className="mt-4 border-t pt-4">
              <summary className="cursor-pointer list-none rounded-lg border border-brand-navy/30 bg-brand-navy/5 px-3 py-2 text-sm font-medium text-brand-navy hover:bg-brand-navy/10">
                ✏️ Edit tenant details
              </summary>
              <p className="mt-2 text-xs text-slate-500">
                Email is tied to this tenant&apos;s login and cannot be changed here. To change the
                login email, re-invite the tenant with the new email.
              </p>
              <form action={updateTenantAction} className="mt-4 grid gap-3 sm:grid-cols-2">
                <input type="hidden" name="tenantId" value={tenant.id} />
                <label className="text-sm sm:col-span-2">
                  <span className="text-slate-500">Full name</span>
                  <input
                    name="fullName"
                    required
                    defaultValue={tenant.fullName}
                    className="mt-1 block w-full rounded border px-3 py-2 text-slate-950 bg-white"
                  />
                </label>
                <label className="text-sm">
                  <span className="text-slate-500">Phone</span>
                  <input
                    name="phone"
                    type="tel"
                    defaultValue={tenant.phone ?? ''}
                    className="mt-1 block w-full rounded border px-3 py-2 text-slate-950 bg-white"
                  />
                </label>
                <label className="text-sm">
                  <span className="text-slate-500">Employer</span>
                  <input
                    name="employer"
                    defaultValue={tenant.employer ?? ''}
                    className="mt-1 block w-full rounded border px-3 py-2 text-slate-950 bg-white"
                  />
                </label>
                <label className="text-sm">
                  <span className="text-slate-500">Emergency contact name</span>
                  <input
                    name="emergencyContactName"
                    defaultValue={tenant.emergencyContactName ?? ''}
                    className="mt-1 block w-full rounded border px-3 py-2 text-slate-950 bg-white"
                  />
                </label>
                <label className="text-sm">
                  <span className="text-slate-500">Emergency contact phone</span>
                  <input
                    name="emergencyContactPhone"
                    type="tel"
                    defaultValue={tenant.emergencyContactPhone ?? ''}
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
                <p>{formatDate(activeLease.startDate, tz)} — {formatDate(activeLease.endDate, tz)}</p>
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
                        <td className="p-2">{formatDate(payment.dueDate, tz)}</td>
                        <td className="p-2">{formatDate(payment.paymentDate, tz)}</td>
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

          <Link
            href={`/tenants/${tenant.id}?edit=1#edit`}
            className="block rounded bg-brand-navy px-3 py-2 text-center text-sm font-medium text-white hover:bg-brand-navy/90"
          >
            ✏️ Edit tenant
          </Link>

          <div className="space-y-2">
            <Link href="/tenants" className="block text-sm text-brand-navy">Back to tenants</Link>
            <Link href="/leases" className="block text-sm text-brand-navy">Create lease</Link>
            <Link href="/payments" className="block text-sm text-brand-navy">Record payment</Link>
          </div>

          <form action={deactivateTenantAction}>
            <input type="hidden" name="tenantId" value={tenant.id} />
            <button className="w-full rounded border border-slate-200 px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50">
              Deactivate tenant
            </button>
          </form>
        </aside>
      </div>
    </Shell>
  );
}
