type Metrics = {
  monthlyRentExpected: number;
  monthlyRentCollected: number;
  outstandingBalance: number;
  occupancyRate: number;
  netCashflow: number;
  activeTenants: number;
  openMaintenance: number;
  leaseExpirations: number;
};

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function DashboardCards({ metrics }: { metrics: Metrics }) {
  const cards = [
    ['Monthly Rent Expected', currency.format(metrics.monthlyRentExpected)],
    ['Monthly Rent Collected', currency.format(metrics.monthlyRentCollected)],
    ['Outstanding Balance', currency.format(metrics.outstandingBalance)],
    ['Occupancy Rate', `${metrics.occupancyRate}%`],
    ['Net Cashflow', currency.format(metrics.netCashflow)],
    ['Active Tenants', String(metrics.activeTenants)],
    ['Open Maintenance Requests', String(metrics.openMaintenance)],
    ['Lease Expirations within 60 days', String(metrics.leaseExpirations)],
  ];

  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map(([label, value]) => (
        <div key={label} className="rounded-xl bg-white shadow-sm border p-4">
          <p className="text-xs uppercase text-slate-500">{label}</p>
          <p className="text-2xl font-semibold mt-2">{value}</p>
        </div>
      ))}
    </div>
  );
}
