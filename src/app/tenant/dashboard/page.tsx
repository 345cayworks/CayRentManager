import { UserRole } from '@prisma/client';
import { Shell } from '@/components/shell';
import { requireRole } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const user = await requireRole([UserRole.TENANT, UserRole.SUPERADMIN]);
  const tenant = await prisma.tenant.findFirst({
    where: user.role === UserRole.SUPERADMIN ? {} : { userId: user.userId },
    include: { leases: { include: { unit: true, property: true }, orderBy: { createdAt: 'desc' } }, payments: true },
  });

  return (
    <Shell title="Tenant Dashboard">
      {!tenant ? <div className="rounded-xl bg-white border shadow-sm p-6 text-slate-600">No tenant profile is linked to this account.</div> : null}
      {tenant ? (
        <div className="grid lg:grid-cols-2 gap-4">
          <section className="rounded-xl bg-white border shadow-sm p-6">
            <h3 className="font-semibold">Lease</h3>
            {tenant.leases[0] ? (
              <p className="text-sm text-slate-600 mt-2">{tenant.leases[0].property.name} / {tenant.leases[0].unit.unitName}</p>
            ) : (
              <p className="text-sm text-slate-600 mt-2">No lease yet.</p>
            )}
          </section>
          <section className="rounded-xl bg-white border shadow-sm p-6">
            <h3 className="font-semibold">Balance</h3>
            <p className="text-2xl font-semibold mt-2">${tenant.payments.reduce((sum, payment) => sum + Number(payment.balance), 0).toFixed(2)}</p>
          </section>
        </div>
      ) : null}
    </Shell>
  );
}
