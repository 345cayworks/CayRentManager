import { DashboardCards } from '@/components/dashboard-cards';
import { Shell } from '@/components/shell';

export default function DashboardPage() {
  return (
    <Shell title="Landlord Dashboard">
      <DashboardCards />
      <div className="mt-4 rounded-xl bg-white border shadow-sm p-6">
        Charts placeholder: rent collection trend, cashflow by month, expenses by category, and unit performance.
      </div>
    </Shell>
  );
}
