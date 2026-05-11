import { MaintenanceStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { assignMaintenanceVendorAction, createMaintenanceVendorAction, createMaintenanceWorkOrderAction, updateMaintenanceStatusAction } from '@/server/actions';

export const dynamic = 'force-dynamic';

const statuses: MaintenanceStatus[] = [MaintenanceStatus.OPEN, MaintenanceStatus.IN_PROGRESS, MaintenanceStatus.RESOLVED, MaintenanceStatus.CLOSED];

function badge(value: string) {
  return <span className="inline-flex rounded-full border bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700">{value.replaceAll('_', ' ')}</span>;
}

export default async function Page() {
  const { landlordId } = await getCurrentLandlordWorkspace();

  const [requests, vendors] = await Promise.all([
    prisma.maintenanceRequest.findMany({
      where: { landlordId, status: { not: MaintenanceStatus.ARCHIVED } },
      include: { tenant: true, property: true, unit: true, vendor: true, attachments: true, comments: true, workOrders: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.maintenanceVendor.findMany({ where: { landlordId }, orderBy: { name: 'asc' } }),
  ]);

  return (
    <Shell title="Maintenance Board">
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        {statuses.map((status) => {
          const count = requests.filter((request) => request.status === status).length;
          return <div key={status} className="rounded-xl bg-white border shadow-sm p-4"><p className="text-slate-500">{status.replaceAll('_', ' ')}</p><p className="text-2xl font-semibold">{count}</p></div>;
        })}
      </div>

      <section className="rounded-xl bg-white border shadow-sm p-4 mb-6">
        <h3 className="font-semibold">Vendor Management</h3>
        <p className="text-sm text-slate-500 mt-1">Add contractors and service providers for assignment to maintenance requests.</p>
        <form action={createMaintenanceVendorAction} className="grid gap-3 mt-4 md:grid-cols-5">
          <input required name="name" placeholder="Vendor name" className="border rounded px-3 py-2" />
          <input name="email" type="email" placeholder="Email" className="border rounded px-3 py-2" />
          <input name="phone" placeholder="Phone" className="border rounded px-3 py-2" />
          <input name="specialty" placeholder="Specialty" className="border rounded px-3 py-2" />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input name="approvedStatus" type="checkbox" /> Approved
          </label>
          <textarea name="notes" placeholder="Vendor notes" className="border rounded px-3 py-2 md:col-span-4" rows={2} />
          <button className="rounded bg-brand-navy text-white px-4 py-2">Save vendor</button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-600">
          <span>{vendors.length} vendors</span>
          <span>·</span>
          <span>{vendors.filter((vendor) => vendor.approvedStatus).length} approved</span>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-4 items-start">
        {statuses.map((status) => (
          <section key={status} className="rounded-xl bg-slate-50 border p-3 min-h-80">
            <h3 className="font-semibold mb-3">{status.replaceAll('_', ' ')}</h3>
            <div className="space-y-3">
              {requests.filter((request) => request.status === status).map((request) => (
                <article key={request.id} className="rounded-xl bg-white border shadow-sm p-4 space-y-3">
                  <div>
                    <h4 className="font-semibold">{request.title}</h4>
                    <p className="text-sm text-slate-600">{request.tenant?.fullName ?? 'No tenant'} · {request.property.name}{request.unit ? ` / ${request.unit.unitName}` : ''}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {badge(request.category)}
                    {badge(request.priority)}
                    {request.permissionToEnter ? badge('Permission to enter') : null}
                  </div>
                  <p className="text-sm text-slate-700 line-clamp-3">{request.description}</p>
                  <div className="text-xs text-slate-500">
                    {request.attachments.length} files · {request.comments.length} comments · {request.workOrders.length} work orders
                  </div>
                  <div className="text-sm text-slate-600">Vendor: {request.vendor?.name ?? 'Not assigned'}</div>

                  <form action={updateMaintenanceStatusAction} className="grid gap-2">
                    <input type="hidden" name="maintenanceRequestId" value={request.id} />
                    <select name="status" className="border rounded px-2 py-1 text-sm" defaultValue={request.status}>
                      {statuses.map((nextStatus) => <option key={nextStatus} value={nextStatus}>{nextStatus.replaceAll('_', ' ')}</option>)}
                    </select>
                    <button className="rounded border px-2 py-1 text-sm">Update status</button>
                  </form>

                  <form action={assignMaintenanceVendorAction} className="grid gap-2">
                    <input type="hidden" name="maintenanceRequestId" value={request.id} />
                    <select name="vendorId" className="border rounded px-2 py-1 text-sm" defaultValue={request.assignedVendorId ?? ''}>
                      <option value="">Assign vendor</option>
                      {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
                    </select>
                    <button className="rounded border px-2 py-1 text-sm">Assign</button>
                  </form>

                  <details>
                    <summary className="cursor-pointer text-sm font-medium">Create work order</summary>
                    <form action={createMaintenanceWorkOrderAction} className="grid gap-2 mt-2">
                      <input type="hidden" name="maintenanceRequestId" value={request.id} />
                      <select name="vendorId" className="border rounded px-2 py-1 text-sm" defaultValue={request.assignedVendorId ?? ''}>
                        <option value="">Vendor optional</option>
                        {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
                      </select>
                      <input name="estimatedCost" type="number" step="0.01" placeholder="Estimated cost" className="border rounded px-2 py-1 text-sm" />
                      <input name="scheduledDate" type="date" className="border rounded px-2 py-1 text-sm" />
                      <textarea name="notes" placeholder="Work order notes" className="border rounded px-2 py-1 text-sm" rows={3} />
                      <button className="rounded border px-2 py-1 text-sm">Create work order</button>
                    </form>
                  </details>
                </article>
              ))}
              {requests.filter((request) => request.status === status).length === 0 ? <p className="text-sm text-slate-500">No requests.</p> : null}
            </div>
          </section>
        ))}
      </div>
    </Shell>
  );
}
