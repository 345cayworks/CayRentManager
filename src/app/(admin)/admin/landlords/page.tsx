import { Shell } from '@/components/shell';
import { requireSuperadmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export default async function Page() {
  await requireSuperadmin();
  const landlords = await prisma.landlordProfile.findMany({ include: { owner: true, _count: { select: { properties: true, tenants: true } } }, orderBy: { createdAt: 'desc' } });

  return (
    <Shell title="Superadmin Landlords">
      <div className="rounded-xl bg-white border shadow-sm divide-y">
        {landlords.length === 0 ? <p className="p-4 text-slate-600">No landlord workspaces yet.</p> : null}
        {landlords.map((landlord) => (
          <div key={landlord.id} className="p-4 flex justify-between gap-4">
            <div>
              <p className="font-medium">{landlord.displayName}</p>
              <p className="text-sm text-slate-600">{landlord.owner.email}</p>
            </div>
            <p className="text-sm">{landlord._count.properties} properties / {landlord._count.tenants} tenants</p>
          </div>
        ))}
      </div>
    </Shell>
  );
}
