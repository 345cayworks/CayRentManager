import Link from 'next/link';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import {
  archiveMaintenanceVendorAction,
  createMaintenanceVendorAction,
  restoreMaintenanceVendorAction,
} from '@/server/actions';
import { getEffectiveTimezone } from '@/lib/time/effective';
import { formatDate } from '@/lib/time/format';

export const dynamic = 'force-dynamic';

function statCard(label: string, value: number | string) {
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default async function VendorsPage() {
  const { landlordId } = await getCurrentLandlordWorkspace();
  const tz = await getEffectiveTimezone();

  const vendors = await prisma.maintenanceVendor.findMany({
    where: { landlordId },
    include: {
      user: { select: { id: true, email: true } },
      _count: { select: { workOrders: true } },
    },
    orderBy: [{ archivedAt: 'asc' }, { name: 'asc' }],
  });

  const requestCounts = await prisma.maintenanceRequest.groupBy({
    by: ['assignedVendorId'],
    where: { landlordId, assignedVendorId: { not: null } },
    _count: { assignedVendorId: true },
  });

  const requestCountMap = new Map(
    requestCounts.map((item) => [item.assignedVendorId, item._count.assignedVendorId]),
  );

  const activeVendors = vendors.filter((vendor) => vendor.archivedAt === null);
  const archivedVendors = vendors.filter((vendor) => vendor.archivedAt !== null);

  const approvedCount = activeVendors.filter((vendor) => vendor.approvedStatus).length;
  const activeAssignments = activeVendors.reduce(
    (sum, vendor) => sum + (requestCountMap.get(vendor.id) ?? 0),
    0,
  );
  const workOrders = vendors.reduce((sum, vendor) => sum + vendor._count.workOrders, 0);

  return (
    <Shell title="Vendor Directory">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold">Maintenance Vendors</h2>
          <p className="text-slate-600 mt-1">
            Manage contact details, approval, portal access, and work-order history for each vendor.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/maintenance" className="rounded border px-4 py-2 text-sm font-medium hover:bg-slate-50">
            Back to maintenance
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-8">
        {statCard('Active vendors', activeVendors.length)}
        {statCard('Approved vendors', approvedCount)}
        {statCard('Request assignments', activeAssignments)}
        {statCard('Work orders', workOrders)}
      </div>

      <section className="rounded-xl bg-white border shadow-sm p-4 mb-8">
        <h3 className="font-semibold">Add a vendor</h3>
        <p className="text-sm text-slate-500 mt-1">
          Capture contact info, licence, and insurance expiry. You can enable portal access from the vendor detail page.
        </p>
        <form action={createMaintenanceVendorAction} className="grid gap-3 mt-4 md:grid-cols-3">
          <input required name="name" placeholder="Vendor name" className="border rounded px-3 py-2" />
          <input name="email" type="email" placeholder="Email" className="border rounded px-3 py-2" />
          <input name="phone" placeholder="Phone" className="border rounded px-3 py-2" />
          <input name="specialty" placeholder="Specialty" className="border rounded px-3 py-2" />
          <input name="address" placeholder="Address" className="border rounded px-3 py-2" />
          <input name="licenseNumber" placeholder="Licence number" className="border rounded px-3 py-2" />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <span>Insurance expires</span>
            <input name="insuranceExpiresAt" type="date" className="border rounded px-3 py-2 flex-1" />
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input name="approvedStatus" type="checkbox" /> Approved
          </label>
          <textarea name="notes" placeholder="Vendor notes" className="border rounded px-3 py-2 md:col-span-3" rows={2} />
          <button className="rounded bg-brand-navy text-white px-4 py-2 md:col-span-3">Save vendor</button>
        </form>
      </section>

      <section className="rounded-2xl border bg-white shadow-sm overflow-hidden mb-8">
        <header className="px-4 py-3 border-b bg-slate-50">
          <h3 className="font-semibold">Active vendors</h3>
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Vendor</th>
                <th className="px-4 py-3 text-left font-medium">Specialty</th>
                <th className="px-4 py-3 text-left font-medium">Contact</th>
                <th className="px-4 py-3 text-left font-medium">Approval</th>
                <th className="px-4 py-3 text-left font-medium">Portal</th>
                <th className="px-4 py-3 text-left font-medium">Requests</th>
                <th className="px-4 py-3 text-left font-medium">Work Orders</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeVendors.map((vendor) => (
                <tr key={vendor.id} className="align-top hover:bg-slate-50">
                  <td className="px-4 py-4">
                    <Link className="font-medium text-brand-navy hover:underline" href={`/maintenance/vendors/${vendor.id}`}>
                      {vendor.name}
                    </Link>
                    <p className="text-xs text-slate-500 mt-1">Added {formatDate(vendor.createdAt, tz)}</p>
                  </td>
                  <td className="px-4 py-4 text-slate-700">{vendor.specialty || '—'}</td>
                  <td className="px-4 py-4 text-slate-700">
                    <div className="space-y-1">
                      <p>{vendor.email || 'No email'}</p>
                      <p>{vendor.phone || 'No phone'}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {vendor.approvedStatus ? (
                      <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                        Approved
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-slate-700">
                    {vendor.user ? (
                      <span className="inline-flex flex-col">
                        <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700 w-fit">
                          Portal: enabled
                        </span>
                        <span className="mt-1 text-xs text-slate-500">{vendor.user.email}</span>
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                        Portal: disabled
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-slate-700">{requestCountMap.get(vendor.id) ?? 0}</td>
                  <td className="px-4 py-4 text-slate-700">{vendor._count.workOrders}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/maintenance/vendors/${vendor.id}`}
                        className="rounded border px-3 py-1 text-xs font-medium hover:bg-slate-50"
                      >
                        Edit
                      </Link>
                      <form action={archiveMaintenanceVendorAction}>
                        <input type="hidden" name="vendorId" value={vendor.id} />
                        <button className="rounded border border-red-200 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50">
                          Archive
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {activeVendors.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No active vendors.</div>
        ) : null}
      </section>

      <section className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <header className="px-4 py-3 border-b bg-slate-50">
          <h3 className="font-semibold">Archived vendors</h3>
        </header>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Vendor</th>
                <th className="px-4 py-3 text-left font-medium">Specialty</th>
                <th className="px-4 py-3 text-left font-medium">Archived</th>
                <th className="px-4 py-3 text-left font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {archivedVendors.map((vendor) => (
                <tr key={vendor.id} className="align-top hover:bg-slate-50">
                  <td className="px-4 py-4 font-medium text-slate-800">{vendor.name}</td>
                  <td className="px-4 py-4 text-slate-700">{vendor.specialty || '—'}</td>
                  <td className="px-4 py-4 text-slate-600">{formatDate(vendor.archivedAt, tz)}</td>
                  <td className="px-4 py-4">
                    <form action={restoreMaintenanceVendorAction}>
                      <input type="hidden" name="vendorId" value={vendor.id} />
                      <button className="rounded border px-3 py-1 text-xs font-medium hover:bg-slate-50">
                        Restore
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {archivedVendors.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">No archived vendors.</div>
        ) : null}
      </section>
    </Shell>
  );
}
