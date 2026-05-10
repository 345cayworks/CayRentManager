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
            <div>
              <Link href={`/properties/${property.id}`} className="font-medium text-brand-navy">
                {property.name}
              </Link>
              <p className="text-sm text-slate-600">{property.address}, {property.city}, {property.state}</p>
            </div>
            <form action={archivePropertyAction}>
              <input type="hidden" name="propertyId" value={property.id} />
              <button className="text-sm rounded border px-3 py-1">Archive</button>
            </form>
          </div>
        ))}
      </div>
    </Shell>
  );
}
