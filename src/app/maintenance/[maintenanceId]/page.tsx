import Link from 'next/link';
import { notFound } from 'next/navigation';
import { MaintenanceStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { addMaintenanceAttachmentAction, addMaintenanceCommentAction, assignMaintenanceVendorAction, createMaintenanceWorkOrderAction, updateMaintenanceStatusAction } from '@/server/actions';

export const dynamic = 'force-dynamic';

const statuses: MaintenanceStatus[] = [MaintenanceStatus.OPEN, MaintenanceStatus.IN_PROGRESS, MaintenanceStatus.RESOLVED, MaintenanceStatus.CLOSED];

function badge(value: string) {
  return <span className="inline-flex rounded-full border bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700">{value.replaceAll('_', ' ')}</span>;
}

export default async function Page({ params }: { params: { maintenanceId: string } }) {
  const { landlordId } = await getCurrentLandlordWorkspace();

  const [request, vendors] = await Promise.all([
    prisma.maintenanceRequest.findFirst({
      where: { id: params.maintenanceId, landlordId },
      include: {
        tenant: true,
        property: true,
        unit: true,
        vendor: true,
        attachments: { orderBy: { uploadedAt: 'desc' } },
        comments: { include: { author: true }, orderBy: { createdAt: 'asc' } },
        workOrders: { include: { vendor: true }, orderBy: { createdAt: 'desc' } },
      },
    }),
    prisma.maintenanceVendor.findMany({ where: { landlordId }, orderBy: { name: 'asc' } }),
  ]);

  if (!request) notFound();

  return (
    <Shell title="Maintenance Detail">
      <div className="mb-4">
        <Link href="/maintenance" className="text-sm text-slate-600 hover:underline">← Back to maintenance board</Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          <article className="rounded-xl bg-white border shadow-sm p-6">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-xl font-semibold">{request.title}</h3>
                <p className="mt-1 text-sm text-slate-600">{request.tenant?.fullName ?? 'No tenant'} · {request.property.name}{request.unit ? ` / ${request.unit.unitName}` : ''}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {badge(request.status)}
                {badge(request.category)}
                {badge(request.priority)}
              </div>
            </div>
            <p className="mt-5 whitespace-pre-line text-slate-700">{request.description}</p>
            <div className="mt-5 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
              <div className="rounded-lg bg-slate-50 p-3"><span className="font-medium">Permission to enter:</span> {request.permissionToEnter ? 'Yes' : 'No'}</div>
              <div className="rounded-lg bg-slate-50 p-3"><span className="font-medium">Preferred contact:</span> {request.preferredContactTime ?? 'Not provided'}</div>
              <div className="rounded-lg bg-slate-50 p-3"><span className="font-medium">Vendor:</span> {request.vendor?.name ?? 'Not assigned'}</div>
              <div className="rounded-lg bg-slate-50 p-3"><span className="font-medium">Created:</span> {request.createdAt.toLocaleDateString()}</div>
            </div>
          </article>

          <section className="rounded-xl bg-white border shadow-sm p-6">
            <h3 className="font-semibold">Comments</h3>
            <div className="mt-4 space-y-3">
              {request.comments.length === 0 ? <p className="text-sm text-slate-500">No comments yet.</p> : null}
              {request.comments.map((comment) => (
                <div key={comment.id} className="rounded-xl border bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                    <span>{comment.author.name ?? comment.author.email}</span>
                    <span>{comment.createdAt.toLocaleString()}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{comment.message}</p>
                </div>
              ))}
            </div>
            <form action={addMaintenanceCommentAction} className="mt-5 grid gap-3">
              <input type="hidden" name="maintenanceRequestId" value={request.id} />
              <textarea required name="message" placeholder="Add an update or note" rows={4} className="rounded border px-3 py-2" />
              <button className="rounded bg-brand-navy px-4 py-2 text-white">Add comment</button>
            </form>
          </section>

          <section className="rounded-xl bg-white border shadow-sm p-6">
            <h3 className="font-semibold">Attachments</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {request.attachments.length === 0 ? <p className="text-sm text-slate-500">No attachments yet.</p> : null}
              {request.attachments.map((attachment) => (
                <a key={attachment.id} href={attachment.fileUrl} target="_blank" rel="noreferrer" className="rounded-xl border bg-slate-50 p-4 text-sm hover:bg-slate-100">
                  <p className="font-medium">{attachment.fileType || 'Attachment'}</p>
                  <p className="mt-1 truncate text-slate-500">{attachment.fileUrl}</p>
                  <p className="mt-2 text-xs text-slate-400">Uploaded {attachment.uploadedAt.toLocaleDateString()}</p>
                </a>
              ))}
            </div>
            <form action={addMaintenanceAttachmentAction} className="mt-5 grid gap-3 md:grid-cols-[1fr_160px_auto]">
              <input type="hidden" name="maintenanceRequestId" value={request.id} />
              <input required name="fileUrl" placeholder="Attachment URL" className="rounded border px-3 py-2" />
              <input name="fileType" placeholder="Type" className="rounded border px-3 py-2" />
              <button className="rounded border px-4 py-2">Add file</button>
            </form>
          </section>

          <section className="rounded-xl bg-white border shadow-sm p-6">
            <h3 className="font-semibold">Work Orders</h3>
            <div className="mt-4 space-y-3">
              {request.workOrders.length === 0 ? <p className="text-sm text-slate-500">No work orders yet.</p> : null}
              {request.workOrders.map((order) => (
                <div key={order.id} className="rounded-xl border bg-slate-50 p-4 text-sm text-slate-700">
                  <div className="flex flex-wrap gap-2">{badge(order.status)}{order.vendor ? badge(order.vendor.name) : null}</div>
                  <p className="mt-2">Estimated cost: {order.estimatedCost ?? 'Not provided'}</p>
                  <p>Scheduled: {order.scheduledDate ? order.scheduledDate.toLocaleDateString() : 'Not scheduled'}</p>
                  {order.notes ? <p className="mt-2 whitespace-pre-line">{order.notes}</p> : null}
                </div>
              ))}
            </div>
          </section>
        </section>

        <aside className="space-y-6">
          <section className="rounded-xl bg-white border shadow-sm p-4">
            <h3 className="font-semibold">Update Status</h3>
            <form action={updateMaintenanceStatusAction} className="mt-3 grid gap-2">
              <input type="hidden" name="maintenanceRequestId" value={request.id} />
              <select name="status" className="border rounded px-3 py-2" defaultValue={request.status}>
                {statuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}
              </select>
              <button className="rounded bg-brand-navy px-4 py-2 text-white">Update status</button>
            </form>
          </section>

          <section className="rounded-xl bg-white border shadow-sm p-4">
            <h3 className="font-semibold">Assign Vendor</h3>
            <form action={assignMaintenanceVendorAction} className="mt-3 grid gap-2">
              <input type="hidden" name="maintenanceRequestId" value={request.id} />
              <select name="vendorId" className="border rounded px-3 py-2" defaultValue={request.assignedVendorId ?? ''}>
                <option value="">Assign vendor</option>
                {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
              </select>
              <button className="rounded border px-4 py-2">Assign</button>
            </form>
          </section>

          <section className="rounded-xl bg-white border shadow-sm p-4">
            <h3 className="font-semibold">Create Work Order</h3>
            <form action={createMaintenanceWorkOrderAction} className="mt-3 grid gap-2">
              <input type="hidden" name="maintenanceRequestId" value={request.id} />
              <select name="vendorId" className="border rounded px-3 py-2" defaultValue={request.assignedVendorId ?? ''}>
                <option value="">Vendor optional</option>
                {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
              </select>
              <input name="estimatedCost" type="number" step="0.01" placeholder="Estimated cost" className="border rounded px-3 py-2" />
              <input name="scheduledDate" type="date" className="border rounded px-3 py-2" />
              <textarea name="notes" placeholder="Work order notes" className="border rounded px-3 py-2" rows={3} />
              <button className="rounded border px-4 py-2">Create work order</button>
            </form>
          </section>
        </aside>
      </div>
    </Shell>
  );
}
