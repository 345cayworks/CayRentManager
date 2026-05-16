import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import {
  archiveMaintenanceVendorAction,
  cancelVendorPortalRequestAction,
  disableVendorPortalAction,
  requestVendorPortalAction,
  restoreMaintenanceVendorAction,
  updateMaintenanceVendorAction,
} from '@/server/actions';
import { getEffectiveTimezone } from '@/lib/time/effective';
import { formatDate, formatDateTime } from '@/lib/time/format';

export const dynamic = 'force-dynamic';

function badge(value: string, tone: 'green' | 'amber' | 'slate' | 'red' | 'sky' = 'slate') {
  const tones: Record<string, string> = {
    green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    slate: 'bg-slate-100 text-slate-700',
    red: 'bg-red-100 text-red-700',
    sky: 'bg-sky-100 text-sky-700',
  };
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${tones[tone]}`}>
      {value}
    </span>
  );
}

function formatDateInput(date: Date | null | undefined) {
  if (!date) return '';
  return date.toISOString().slice(0, 10);
}

export default async function VendorDetailPage({ params }: { params: { vendorId: string } }) {
  const { landlordId } = await getCurrentLandlordWorkspace();
  const tz = await getEffectiveTimezone();

  const vendor = await prisma.maintenanceVendor.findFirst({
    where: { id: params.vendorId, landlordId },
    include: { user: { select: { id: true, email: true, status: true } } },
  });

  if (!vendor) notFound();

  const [workOrders, assignedOpen] = await Promise.all([
    prisma.maintenanceWorkOrder.findMany({
      where: { vendorId: vendor.id },
      include: { maintenanceRequest: { select: { id: true, title: true, status: true } } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.maintenanceRequest.findMany({
      where: { landlordId, assignedVendorId: vendor.id, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      select: { id: true, title: true, status: true, priority: true },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  const archived = vendor.archivedAt !== null;
  const portalEnabled = vendor.userId !== null;

  const latestRequest = await prisma.vendorPortalRequest.findFirst({
    where: { maintenanceVendorId: vendor.id },
    orderBy: { createdAt: 'desc' },
  });
  const pendingRequest =
    latestRequest && latestRequest.status === 'PENDING' ? latestRequest : null;

  return (
    <Shell title="Vendor Detail">
      <div className="mb-4">
        <Link href="/maintenance/vendors" className="text-sm text-slate-600 hover:underline">
          ← Back to vendors
        </Link>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold">{vendor.name}</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {vendor.approvedStatus ? badge('Approved', 'green') : badge('Pending approval', 'amber')}
            {portalEnabled ? badge('Portal enabled', 'sky') : badge('Portal disabled', 'slate')}
            {archived ? badge('Archived', 'red') : null}
          </div>
        </div>
        <div className="flex gap-3">
          {archived ? (
            <form action={restoreMaintenanceVendorAction}>
              <input type="hidden" name="vendorId" value={vendor.id} />
              <button className="rounded border px-4 py-2 text-sm font-medium hover:bg-slate-50">Restore vendor</button>
            </form>
          ) : (
            <form action={archiveMaintenanceVendorAction}>
              <input type="hidden" name="vendorId" value={vendor.id} />
              <button className="rounded border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50">
                Archive vendor
              </button>
            </form>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          <article className="rounded-xl bg-white border shadow-sm p-6">
            <h3 className="font-semibold">Contact &amp; Compliance</h3>
            <form action={updateMaintenanceVendorAction} className="grid gap-3 mt-4 md:grid-cols-2">
              <input type="hidden" name="vendorId" value={vendor.id} />
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Name</span>
                <input required name="name" defaultValue={vendor.name} className="rounded border px-3 py-2" />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Specialty</span>
                <input name="specialty" defaultValue={vendor.specialty ?? ''} className="rounded border px-3 py-2" />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Email</span>
                <input name="email" type="email" defaultValue={vendor.email ?? ''} className="rounded border px-3 py-2" />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Phone</span>
                <input name="phone" defaultValue={vendor.phone ?? ''} className="rounded border px-3 py-2" />
              </label>
              <label className="grid gap-1 text-sm md:col-span-2">
                <span className="text-slate-600">Address</span>
                <input name="address" defaultValue={vendor.address ?? ''} className="rounded border px-3 py-2" />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Licence number</span>
                <input name="licenseNumber" defaultValue={vendor.licenseNumber ?? ''} className="rounded border px-3 py-2" />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-600">Insurance expires</span>
                <input
                  name="insuranceExpiresAt"
                  type="date"
                  defaultValue={formatDateInput(vendor.insuranceExpiresAt)}
                  className="rounded border px-3 py-2"
                />
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
                <input
                  type="checkbox"
                  name="approvedStatus"
                  defaultChecked={vendor.approvedStatus}
                />
                Approved for assignment
              </label>
              <label className="grid gap-1 text-sm md:col-span-2">
                <span className="text-slate-600">Notes</span>
                <textarea name="notes" rows={3} defaultValue={vendor.notes ?? ''} className="rounded border px-3 py-2" />
              </label>
              <button className="rounded bg-brand-navy px-4 py-2 text-white md:col-span-2 md:w-fit">Save changes</button>
            </form>
          </article>

          <article className="rounded-xl bg-white border shadow-sm p-6">
            <h3 className="font-semibold">Open assignments</h3>
            <div className="mt-4 space-y-2">
              {assignedOpen.length === 0 ? (
                <p className="text-sm text-slate-500">No open requests assigned to this vendor.</p>
              ) : null}
              {assignedOpen.map((request) => (
                <Link
                  key={request.id}
                  href={`/maintenance/${request.id}`}
                  className="flex items-center justify-between rounded border px-3 py-2 text-sm hover:bg-slate-50"
                >
                  <span>{request.title}</span>
                  <div className="flex gap-2">
                    {badge(request.priority)}
                    {badge(request.status.replaceAll('_', ' '))}
                  </div>
                </Link>
              ))}
            </div>
          </article>

          <article className="rounded-xl bg-white border shadow-sm p-6">
            <h3 className="font-semibold">Work order history</h3>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Request</th>
                    <th className="px-3 py-2 text-left font-medium">Status</th>
                    <th className="px-3 py-2 text-left font-medium">Dispatched</th>
                    <th className="px-3 py-2 text-left font-medium">Started</th>
                    <th className="px-3 py-2 text-left font-medium">Completed</th>
                    <th className="px-3 py-2 text-left font-medium">Acknowledged</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {workOrders.map((wo) => (
                    <tr key={wo.id}>
                      <td className="px-3 py-2">
                        <Link className="text-brand-navy hover:underline" href={`/maintenance/${wo.maintenanceRequestId}`}>
                          {wo.maintenanceRequest.title}
                        </Link>
                      </td>
                      <td className="px-3 py-2">{badge(wo.status.replaceAll('_', ' '))}</td>
                      <td className="px-3 py-2 text-slate-600">{formatDateTime(wo.dispatchedAt, tz)}</td>
                      <td className="px-3 py-2 text-slate-600">{formatDateTime(wo.startedAt, tz)}</td>
                      <td className="px-3 py-2 text-slate-600">{formatDateTime(wo.completedAt, tz)}</td>
                      <td className="px-3 py-2 text-slate-600">{formatDateTime(wo.vendorAcknowledgedAt, tz)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {workOrders.length === 0 ? (
                <p className="text-sm text-slate-500 px-3 py-4">No work orders yet for this vendor.</p>
              ) : null}
            </div>
          </article>
        </section>

        <aside className="space-y-6">
          <section className="rounded-xl bg-white border shadow-sm p-4">
            <h3 className="font-semibold">Portal Access</h3>
            {portalEnabled ? (
              <div className="mt-3 space-y-3 text-sm">
                <p className="text-slate-700">
                  Linked to <span className="font-medium">{vendor.user?.email}</span>
                </p>
                {vendor.portalEnabledAt ? (
                  <p className="text-xs text-slate-500">Enabled {formatDate(vendor.portalEnabledAt, tz)}</p>
                ) : null}
                <form action={disableVendorPortalAction}>
                  <input type="hidden" name="vendorId" value={vendor.id} />
                  <button className="rounded border border-red-200 px-4 py-2 text-sm text-red-700 hover:bg-red-50">
                    Disable portal
                  </button>
                </form>
              </div>
            ) : pendingRequest ? (
              <div className="mt-3 space-y-3 text-sm">
                <p className="text-slate-700">
                  Portal access requested {formatDate(pendingRequest.createdAt, tz)} — awaiting
                  superadmin review.
                </p>
                <p className="text-xs text-slate-500">
                  Requested email:{' '}
                  <span className="font-medium">{pendingRequest.requestedEmail}</span>
                </p>
                {pendingRequest.note ? (
                  <p className="text-xs text-slate-500">Note: {pendingRequest.note}</p>
                ) : null}
                <form action={cancelVendorPortalRequestAction}>
                  <input type="hidden" name="requestId" value={pendingRequest.id} />
                  <button className="rounded border px-4 py-2 text-sm font-medium hover:bg-slate-50">
                    Cancel request
                  </button>
                </form>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {latestRequest && latestRequest.status === 'REJECTED' ? (
                  <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                    <p className="font-medium">
                      Previous request rejected {formatDate(latestRequest.createdAt, tz)}.
                    </p>
                    {latestRequest.decisionNote ? (
                      <p className="mt-1">Reason: {latestRequest.decisionNote}</p>
                    ) : null}
                  </div>
                ) : null}
                <form action={requestVendorPortalAction} className="grid gap-3">
                  <input type="hidden" name="vendorId" value={vendor.id} />
                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-600">Portal email</span>
                    <input required name="portalEmail" type="email" className="rounded border px-3 py-2" />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="text-slate-600">Note (optional)</span>
                    <textarea name="note" rows={2} maxLength={500} className="rounded border px-3 py-2" />
                  </label>
                  <button className="rounded bg-brand-navy px-4 py-2 text-white text-sm">
                    Request portal access
                  </button>
                  <p className="text-xs text-slate-500">
                    Submits a request for a superadmin to review. They will create or link
                    the vendor login on approval.
                  </p>
                </form>
              </div>
            )}
          </section>

          <section className="rounded-xl bg-white border shadow-sm p-4 text-sm text-slate-600">
            <h3 className="font-semibold text-slate-900">Metadata</h3>
            <dl className="mt-3 space-y-2">
              <div className="flex justify-between gap-3">
                <dt>Created</dt>
                <dd>{formatDate(vendor.createdAt, tz)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Updated</dt>
                <dd>{formatDate(vendor.updatedAt, tz)}</dd>
              </div>
              {vendor.archivedAt ? (
                <div className="flex justify-between gap-3">
                  <dt>Archived</dt>
                  <dd>{formatDate(vendor.archivedAt, tz)}</dd>
                </div>
              ) : null}
            </dl>
          </section>
        </aside>
      </div>
    </Shell>
  );
}
