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

  const primaryPhotos = await prisma.unitPhoto.findMany({
    where: { landlordId, isPrimary: true, archivedAt: null },
    select: { id: true, unitId: true },
  });
  const primaryByUnit = new Map(primaryPhotos.map((p) => [p.unitId, p.id]));

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
          <div key={unit.id} className="p-4 flex justify-between gap-4">
            <div className="flex items-center gap-3">
              {primaryByUnit.has(unit.id) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/units/${unit.id}/photos/${primaryByUnit.get(unit.id)}`}
                  alt={unit.unitName}
                  loading="lazy"
                  className="h-12 w-12 rounded-lg border border-slate-200 object-cover"
                />
              ) : (
                <div className="h-12 w-12 rounded-lg border border-slate-200 bg-slate-100" />
              )}
              <div>
                <Link href={`/units/${unit.id}`} className="font-medium text-brand-navy">
                  {unit.unitName}
                </Link>
                <p className="text-sm text-slate-600">{unit.property.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <p className="font-medium">${Number(unit.rentAmount).toFixed(2)}</p>
              <Link
                href={`/units/${unit.id}?edit=1#edit`}
                className="text-sm rounded border border-slate-200 bg-white px-3 py-1 text-slate-700 hover:bg-slate-50"
              >
                Edit
              </Link>
              <form action={archiveUnitAction}>
                <input type="hidden" name="unitId" value={unit.id} />
                <button className="text-sm rounded border border-slate-200 px-3 py-1 text-slate-500 hover:bg-slate-50">
                  Archive
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}
