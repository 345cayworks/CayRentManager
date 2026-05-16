import Link from 'next/link';
import { RecordStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { archivePropertyAction, createPropertyAction } from '@/server/actions';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const { landlordId } = await getCurrentLandlordWorkspace();
  const properties = await prisma.property.findMany({
    where: { landlordId, status: RecordStatus.ACTIVE },
    orderBy: { createdAt: 'desc' },
  });

  const primaryPhotos = await prisma.propertyPhoto.findMany({
    where: { landlordId, isPrimary: true, archivedAt: null },
    select: { id: true, propertyId: true },
  });
  const primaryByProperty = new Map(
    primaryPhotos.map((p) => [p.propertyId, p.id]),
  );

  return (
    <Shell title="Properties">
      <form action={createPropertyAction} className="grid md:grid-cols-6 gap-3 rounded-xl bg-white border shadow-sm p-4 mb-4">
        <input required name="name" placeholder="Name" className="border rounded px-3 py-2" />
        <input required name="address" placeholder="Address" className="border rounded px-3 py-2 md:col-span-2" />
        <input required name="city" placeholder="City" className="border rounded px-3 py-2" />
        <input required name="state" placeholder="State" className="border rounded px-3 py-2" />
        <input name="propertyType" placeholder="Type" className="border rounded px-3 py-2" />
        <button className="rounded bg-brand-navy text-white px-4 py-2 md:col-span-6">Create property</button>
      </form>
      <div className="rounded-xl bg-white border shadow-sm divide-y">
        {properties.length === 0 ? <p className="p-4 text-slate-600">No properties yet.</p> : null}
        {properties.map((property) => (
          <div key={property.id} className="p-4 flex justify-between gap-4">
            <div className="flex items-center gap-3">
              {primaryByProperty.has(property.id) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/properties/${property.id}/photos/${primaryByProperty.get(property.id)}`}
                  alt={property.name}
                  loading="lazy"
                  className="h-12 w-12 rounded-lg border border-slate-200 object-cover"
                />
              ) : (
                <div className="h-12 w-12 rounded-lg border border-slate-200 bg-slate-100" />
              )}
              <div>
                <Link href={`/properties/${property.id}`} className="font-medium text-brand-navy">
                  {property.name}
                </Link>
                <p className="text-sm text-slate-600">{property.address}, {property.city}, {property.state}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/properties/${property.id}?edit=1#edit`}
                className="text-sm rounded border border-slate-200 bg-white px-3 py-1 text-slate-700 hover:bg-slate-50"
              >
                Edit
              </Link>
              <form action={archivePropertyAction}>
                <input type="hidden" name="propertyId" value={property.id} />
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
