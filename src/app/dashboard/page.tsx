import { DashboardCards } from '@/components/dashboard-cards';
import { Shell } from '@/components/shell';
import { prisma } from '@/lib/db/prisma';
import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  // Multi-tenant check
  const memberships = await prisma.landlordMembership.findMany({
    where: { userId: session.user.id },
  });
  if (memberships.length === 0 && session.user.role !== 'superadmin') {
    redirect('/login?error=no-access');
  }

  const activeLandlordId = memberships[0]?.landlordId; // Simulating active workspace selection

  let data = null;
  if (activeLandlordId) {
    const units = await prisma.unit.count({ where: { landlordId: activeLandlordId, status: 'active' } });
    const leases = await prisma.lease.findMany({ where: { landlordId: activeLandlordId, status: 'active' } });
    const payments = await prisma.payment.findMany({ where: { landlordId: activeLandlordId, status: 'active' } });
    const expenses = await prisma.expense.findMany({ where: { landlordId: activeLandlordId, status: 'active' } });
    const tenants = await prisma.tenant.count({ where: { landlordId: activeLandlordId, status: 'active' } });
    const maintenance = await prisma.maintenanceRequest.count({ where: { landlordId: activeLandlordId, status: 'pending' } });

    data = { units, leases, payments, expenses, tenants, maintenance };
  }

  return (
    <Shell title="Landlord Dashboard">
      {data ? (
        <DashboardCards data={data} />
      ) : (
        <p>No active landlord workspace selected.</p>
      )}
      <div className="mt-4 rounded-xl bg-white border shadow-sm p-6">
        Charts placeholder: rent collection trend, cashflow by month, expenses by category, and unit performance.
      </div>
    </Shell>
  );
}
