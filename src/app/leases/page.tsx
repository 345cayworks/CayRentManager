import { LeaseStatus, RecordStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { createLeaseAction, expireLeaseAction, terminateLeaseAction } from '@/server/actions';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const { landlordId } = await getCurrentLandlordWorkspace();
  const [tenants, units, leases] = await Promise.all([
    prisma.tenant.findMany({ where: { landlordId, status: RecordStatus.ACTIVE }, orderBy: { fullName: 'asc' } }),
    prisma.unit.findMany({ where: { landlordId, status: RecordStatus.ACTIVE }, include: { property: true }, orderBy: { unitName: 'asc' } }),
    prisma.lease.findMany({ where: { landlordId }, include: { tenant: true, unit: true, property: true }, orderBy: { createdAt: 'desc' } }),
  ]);

  return (
    <Shell title="Leases">
      <form action={createLeaseAction} className="grid md:grid-cols-6 gap-3 rounded-xl bg-white border shadow-sm p-4 mb-4">
        <select required name="tenantId" className="border rounded px-3 py-2 md:col-span-2">
          <option value="">Tenant</option>
          {tenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.fullName}</option>)}
        </select>
        <select required name="unitId" className="border rounded px-3 py-2 md:col-span-2">
          <option value="">Unit</option>
          {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.property.name} / {unit.unitName}</option>)}
        </select>
        <input required name="startDate" type="date" className="border rounded px-3 py-2" />
        <input required name="endDate" type="date" className="border rounded px-3 py-2" />
        <input name="rentAmount" type="number" step="0.01" placeholder="Rent override" className="border rounded px-3 py-2" />
        <input name="depositAmount" type="number" step="0.01" placeholder="Deposit" className="border rounded px-3 py-2" />
        <button className="rounded bg-brand-navy text-white px-4 py-2 md:col-span-4">Create lease</button>
      </form>
      <div className="rounded-xl bg-white border shadow-sm divide-y">
        {leases.length === 0 ? <p className="p-4 text-slate-600">No leases yet.</p> : null}
        {leases.map((lease) => (
          <div key={lease.id} className="p-4 flex justify-between gap-4">
            <div>
              <p className="font-medium">{lease.tenant.fullName} / {lease.property.name} / {lease.unit.unitName}</p>
              <p className="text-sm text-slate-600">{lease.startDate.toLocaleDateString()} to {lease.endDate.toLocaleDateString()}</p>
            </div>
            <div className="text-right space-y-2">
              <p className={lease.status === LeaseStatus.ACTIVE ? 'text-green-700' : 'text-slate-600'}>{lease.status}</p>
              {lease.status === LeaseStatus.ACTIVE ? (
                <div className="flex gap-2">
                  <form action={terminateLeaseAction}>
                    <input type="hidden" name="leaseId" value={lease.id} />
                    <button className="text-sm rounded border px-3 py-1">Terminate</button>
                  </form>
                  <form action={expireLeaseAction}>
                    <input type="hidden" name="leaseId" value={lease.id} />
                    <button className="text-sm rounded border px-3 py-1">Expire</button>
                  </form>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}
