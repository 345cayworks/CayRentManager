import Link from 'next/link';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';

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

  const vendors = await prisma.maintenanceVendor.findMany({
    where: { landlordId },
    include: {
      _count: {
        select: {
          workOrders: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  const requestCounts = await prisma.maintenanceRequest.groupBy({
    by: ['assignedVendorId'],
    where: {
      landlordId,
      assignedVendorId: {
        not: null,
      },
    },
    _count: {
      assignedVendorId: true,
    },
  });

  const requestCountMap = new Map(
    requestCounts.map((item) => [item.assignedVendorId, item._count.assignedVendorId])
  );

  const approvedCount = vendors.filter((vendor) => vendor.approvedStatus).length;
  const activeAssignments = vendors.reduce(
    (sum, vendor) => sum + (requestCountMap.get(vendor.id) ?? 0),
    0
  );
  const workOrders = vendors.reduce((sum, vendor) => sum + vendor._count.workOrders, 0);

  return (
    <Shell title="Vendor Directory">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h2 className="text-2xl font-semibold">Maintenance Vendors</h2>
          <p className="text-slate-600 mt-1">Review approved vendors, assignments, specialties, and work-order activity.</p>
        </div>

        <div className="flex gap-3">
          <Link href="/maintenance" className="rounded border px-4 py-2 text-sm font-medium hover:bg-slate-50">
            Back to maintenance
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-8">
        {statCard('Total vendors', vendors.length)}
        {statCard('Approved vendors', approvedCount)}
        {statCard('Request assignments', activeAssignments)}
        {statCard('Work orders', workOrders)}
      </div>

      <section className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Vendor</th>
                <th className="px-4 py-3 text-left font-medium">Specialty</th>
                <th className="px-4 py-3 text-left font-medium">Contact</th>
                <th className="px-4 py-3 text-left font-medium">Approval</th>
                <th className="px-4 py-3 text-left font-medium">Requests</th>
                <th className="px-4 py-3 text-left font-medium">Work Orders</th>
                <th className="px-4 py-3 text-left font-medium">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {vendors.map((vendor) => (
                <tr key={vendor.id} className="align-top hover:bg-slate-50">
                  <td className="px-4 py-4">
                    <div>
                      <p className="font-medium text-slate-900">{vendor.name}</p>
                      <p className="text-xs text-slate-500 mt-1">Added {vendor.createdAt.toLocaleDateString()}</p>
                    </div>
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
                  <td className="px-4 py-4 text-slate-700">{requestCountMap.get(vendor.id) ?? 0}</td>
                  <td className="px-4 py-4 text-slate-700">{vendor._count.workOrders}</td>
                  <td className="px-4 py-4 text-slate-600 max-w-xs whitespace-pre-line">
                    {vendor.notes || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {vendors.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No vendors added yet.
          </div>
        ) : null}
      </section>
    </Shell>
  );
}
