import { DashboardCards } from '@/components/dashboard-cards';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { getLandlordDashboardMetrics } from '@/lib/finance/dashboard';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const { membership } = await getCurrentLandlordWorkspace();
  const metrics = await getLandlordDashboardMetrics(membership.landlordId);

  return (
    <Shell title={`${membership.landlord.displayName} Dashboard`}>
      <DashboardCards metrics={metrics} />
      <div className="mt-4 rounded-xl bg-white border shadow-sm p-6">
        <h3 className="font-semibold">Workspace</h3>
        <p className="text-sm text-slate-600 mt-1">{membership.landlord.companyName}</p>
      </div>
    </Shell>
  );
}
