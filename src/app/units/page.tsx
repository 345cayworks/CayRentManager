import Link from 'next/link';
import { RecordStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { archiveUnitAction, createUnitAction } from '@/server/actions';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const { landlordId } = await getCurrentLandlordWorkspace();
  const [properties, units] = await Promise.all([
    prisma.property.findMany({ where: { landlordId, status: RecordStatus.ACTIVE }, orderBy: { name: 'asc' } }),
    prisma.unit.findMany({ where: { landlordId, status: RecordStatus.ACTIVE }, include: { property: true }, orderBy: { createdAt: 'desc' } }),
  ]);

  return (
    <Shell title="Units">
      <form action={createUnitAction} className="grid md:grid-cols-6 gap-3 rounded-xl bg-white border shadow-sm p-4 mb-4">
        <select required name="propertyId" className="border rounded px-3 py-2 md:col-span-2">
          <option value="">Property</option>
          {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
        </select>
        <input required name="unitName" placeholder="Unit" className="border rounded px-3 py-2" />
        <input name="bedrooms" placeholder="Beds" type="number" className="border rounded px-3 py-2" />
        <input name="bathrooms" placeholder="Baths" type="number" step="0.5" className="border rounded px-3 py-2" />
        <input required name="rentAmount" placeholder="Rent" type="number" step="0.01" className="border rounded px-3 py-2" />
        <button className="rounded bg-brand-navy text-white px-4 py-2 md:col-span-6">Create unit</button>
      </form>
      <div className="rounded-xl bg-white border shadow-sm divide-y">
        {units.length === 0 ? <p className="p-4 text-slate-600">No units yet.</p> : null}
        {units.map((unit) => (
          <div key={unit.id} className="p-4 flex justify-between">
            <div>
              <Link href={`/units/${unit.id}`} className="font-medium text-brand-navy">
                {unit.unitName}
              </Link>
              <p className="text-sm text-slate-600">{unit.property.name}</p>
            </div>
            <div className="text-right space-y-2">
              <p className="font-medium">${Number(unit.rentAmount).toFixed(2)}</p>
              <form action={archiveUnitAction}>
                <input type="hidden" name="unitId" value={unit.id} />
                <button className="text-sm rounded border px-3 py-1">Archive</button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}
