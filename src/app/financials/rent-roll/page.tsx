import Link from 'next/link';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const { landlordId } = await getCurrentLandlordWorkspace();

  const leases = await prisma.lease.findMany({
    where: { landlordId, status: 'ACTIVE' },
    include: {
      tenant: true,
      property: true,
      unit: true,
      payments: {
        where: { status: { not: 'VOID' } },
        orderBy: { dueDate: 'desc' },
      },
    },
    orderBy: { property: { name: 'asc' } },
  });

  const rentRollData = leases.map((lease) => {
    const outstandingBalance = lease.payments.reduce(
      (sum, payment) => sum + Number(payment.balance),
      0,
    );

    return {
      ...lease,
      outstandingBalance,
    };
  });

  const totalMonthlyRent = rentRollData.reduce((sum, lease) => sum + Number(lease.rentAmount), 0);
  const totalOutstanding = rentRollData.reduce((sum, lease) => sum + lease.outstandingBalance, 0);

  return (
    <Shell title="Rent Roll">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-white border shadow-sm p-4">
            <p className="text-slate-500">Active leases</p>
            <p className="text-2xl font-semibold">{rentRollData.length}</p>
          </div>
          <div className="rounded-xl bg-white border shadow-sm p-4">
            <p className="text-slate-500">Total monthly rent</p>
            <p className="text-2xl font-semibold">${totalMonthlyRent.toFixed(2)}</p>
          </div>
          <div className="rounded-xl bg-white border shadow-sm p-4">
            <p className="text-slate-500">Total outstanding</p>
            <p className="text-2xl font-semibold">${totalOutstanding.toFixed(2)}</p>
          </div>
        </div>

        <section className="rounded-xl bg-white border shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Current rent roll</h3>
          </div>
          {rentRollData.length === 0 ? (
            <p className="p-4 text-slate-600">No active leases.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-3">Property</th>
                    <th className="text-left p-3">Unit</th>
                    <th className="text-left p-3">Tenant</th>
                    <th className="text-left p-3">Lease Start</th>
                    <th className="text-left p-3">Lease End</th>
                    <th className="text-right p-3">Monthly Rent</th>
                    <th className="text-right p-3">Outstanding</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rentRollData.map((lease) => (
                    <tr key={lease.id}>
                      <td className="p-3">
                        <Link href={`/properties/${lease.property.id}`} className="text-brand-navy">
                          {lease.property.name}
                        </Link>
                      </td>
                      <td className="p-3">
                        <Link href={`/units/${lease.unit.id}`} className="text-brand-navy">
                          {lease.unit.unitName}
                        </Link>
                      </td>
                      <td className="p-3">
                        <Link href={`/tenants/${lease.tenant.id}`} className="text-brand-navy">
                          {lease.tenant.fullName}
                        </Link>
                      </td>
                      <td className="p-3">{lease.startDate.toLocaleDateString()}</td>
                      <td className="p-3">{lease.endDate.toLocaleDateString()}</td>
                      <td className="p-3 text-right">${Number(lease.rentAmount).toFixed(2)}</td>
                      <td className="p-3 text-right">${lease.outstandingBalance.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}