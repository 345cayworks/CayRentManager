import { MaintenanceCategory, MaintenancePriority, UserRole } from '@prisma/client';
import { Shell } from '@/components/shell';
import { requireRole } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { createTenantMaintenanceRequestAction, uploadMaintenanceAttachmentAction } from '@/server/actions';

export const dynamic = 'force-dynamic';

function statusBadge(status: string) {
  const className =
    status === 'RESOLVED' || status === 'CLOSED'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : status === 'IN_PROGRESS'
        ? 'bg-blue-50 text-blue-700 border-blue-200'
        : status === 'ARCHIVED'
          ? 'bg-slate-50 text-slate-600 border-slate-200'
          : 'bg-amber-50 text-amber-700 border-amber-200';

  return <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${className}`}>{status.replaceAll('_', ' ')}</span>;
}

export default async function Page() {
  const user = await requireRole([UserRole.TENANT, UserRole.SUPERADMIN]);
  const tenant = await prisma.tenant.findFirst({
    where: user.role === UserRole.SUPERADMIN ? {} : { userId: user.userId },
    include: {
      leases: { include: { property: true, unit: true }, where: { status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } },
      maintenanceRequests: {
        include: { property: true, unit: true, attachments: true, comments: true, vendor: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  const activeLease = tenant?.leases[0];

  return (
    <Shell title="Maintenance Requests">
      {!tenant ? <div className="rounded-xl bg-white border shadow-sm p-6 text-slate-600">No tenant profile is linked to this account.</div> : null}
      {tenant ? (
        <div className="space-y-6">
          <section className="rounded-xl bg-white border shadow-sm p-6">
            <h3 className="font-semibold">Submit a Maintenance Request</h3>
            <p className="text-sm text-slate-500 mt-1">Report an issue to your landlord or property manager.</p>
            <form action={createTenantMaintenanceRequestAction} className="grid gap-3 mt-4">
              {user.role === UserRole.SUPERADMIN ? <input type="hidden" name="tenantId" value={tenant.id} /> : null}
              <input name="propertyId" type="hidden" value={activeLease?.propertyId ?? ''} />
              <input name="unitId" type="hidden" value={activeLease?.unitId ?? ''} />

              <div className="rounded-lg border p-3 text-sm text-slate-700">
                <p className="font-medium">Current unit</p>
                <p>{activeLease ? `${activeLease.property.name} / ${activeLease.unit.unitName}` : 'No active lease found.'}</p>
              </div>

              <input required name="title" placeholder="Short title" className="border rounded px-3 py-2" />
              <textarea required name="description" placeholder="Describe the issue" className="border rounded px-3 py-2" rows={5} />

              <div className="grid md:grid-cols-2 gap-3">
                <select name="category" className="border rounded px-3 py-2" defaultValue={MaintenanceCategory.GENERAL}>
                  {Object.values(MaintenanceCategory).map((category) => (
                    <option key={category} value={category}>{category.replaceAll('_', ' ')}</option>
                  ))}
                </select>

                <select name="priority" className="border rounded px-3 py-2" defaultValue={MaintenancePriority.MEDIUM}>
                  {Object.values(MaintenancePriority).map((priority) => (
                    <option key={priority} value={priority}>{priority}</option>
                  ))}
                </select>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <input name="preferredContactTime" placeholder="Preferred contact time" className="border rounded px-3 py-2" />
                <input name="attachmentUrl" placeholder="Photo/video URL placeholder" className="border rounded px-3 py-2" />
              </div>

              <input name="attachmentType" placeholder="Attachment type" className="border rounded px-3 py-2" />

              <label className="flex gap-2 text-sm text-slate-700">
                <input name="permissionToEnter" type="checkbox" />
                I give permission to enter the unit for inspection or repairs.
              </label>

              <button className="rounded bg-brand-navy text-white px-4 py-2">Submit maintenance request</button>
            </form>
          </section>

          <section className="rounded-xl bg-white border shadow-sm overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-semibold">My Requests</h3>
            </div>

            {tenant.maintenanceRequests.length === 0 ? (
              <p className="p-4 text-slate-600">No maintenance requests yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left p-3">Request</th>
                      <th className="text-left p-3">Category</th>
                      <th className="text-left p-3">Priority</th>
                      <th className="text-left p-3">Status</th>
                      <th className="text-left p-3">Vendor</th>
                      <th className="text-left p-3">Activity</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {tenant.maintenanceRequests.map((request) => (
                      <tr key={request.id}>
                        <td className="p-3">
                          <p className="font-medium">{request.title}</p>
                          <p className="text-sm text-slate-500">{request.property.name}{request.unit ? ` / ${request.unit.unitName}` : ''}</p>
                          <form action={uploadMaintenanceAttachmentAction} encType="multipart/form-data" className="mt-2 flex flex-wrap items-center gap-2">
                            <input type="hidden" name="maintenanceRequestId" value={request.id} />
                            <input required type="file" name="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" className="rounded border px-2 py-1 text-xs" />
                            <button className="rounded border px-3 py-1 text-xs">Upload photo/file</button>
                          </form>
                        </td>
                        <td className="p-3">{request.category.replaceAll('_', ' ')}</td>
                        <td className="p-3">{request.priority}</td>
                        <td className="p-3">{statusBadge(request.status)}</td>
                        <td className="p-3">{request.vendor?.name ?? 'Not assigned'}</td>
                        <td className="p-3 text-sm text-slate-600">{request.attachments.length} files · {request.comments.length} comments</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      ) : null}
    </Shell>
  );
}
