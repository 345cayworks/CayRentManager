export function DashboardCards() {
  const cards = [
    'Monthly Rent Expected',
    'Monthly Rent Collected',
    'Outstanding Balance',
    'Occupancy Rate',
    'Net Cashflow',
    'Active Tenants',
    'Open Maintenance Requests',
    'Lease Expirations within 60 days',
  ];

  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((label) => (
        <div key={label} className="rounded-xl bg-white shadow-sm border p-4">
          <p className="text-xs uppercase text-slate-500">{label}</p>
          <p className="text-2xl font-semibold mt-2">—</p>
        </div>
      ))}
    </div>
  );
}
