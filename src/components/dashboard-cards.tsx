import { occupancyRate, outstandingBalance } from '@/lib/finance/metrics';

type DashboardData = {
  units: number;
  leases: any[];
  payments: any[];
  expenses: any[];
  tenants: number;
  maintenance: number;
};

export function DashboardCards({ data }: { data: DashboardData }) {
  const { units, leases, payments, expenses, tenants, maintenance } = data;

  const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const thisMonthPayments = payments.filter((p) => new Date(p.dueDate) >= currentMonthStart);

  const rentExpected = thisMonthPayments.reduce((sum, p) => sum + Number(p.amountDue), 0);
  const rentCollected = thisMonthPayments.reduce((sum, p) => sum + Number(p.amountPaid || 0), 0);
  const balance = outstandingBalance(payments.map(p => ({ ...p, amountDue: Number(p.amountDue), amountPaid: Number(p.amountPaid || 0) })));
  
  const occupiedUnits = leases.length; // Simplified for MVP
  const occRate = occupancyRate(units, occupiedUnits);
  
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const netCashflow = rentCollected - totalExpenses;

  const now = new Date();
  const sixtyDays = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const expiringLeases = leases.filter(l => new Date(l.endDate) >= now && new Date(l.endDate) <= sixtyDays).length;

  const formatCurrency = (val: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  const cards = [
    { label: 'Monthly Rent Expected', value: formatCurrency(rentExpected) },
    { label: 'Monthly Rent Collected', value: formatCurrency(rentCollected) },
    { label: 'Outstanding Balance', value: formatCurrency(balance) },
    { label: 'Occupancy Rate', value: `${occRate}%` },
    { label: 'Net Cashflow', value: formatCurrency(netCashflow) },
    { label: 'Active Tenants', value: tenants.toString() },
    { label: 'Open Maintenance Requests', value: maintenance.toString() },
    { label: 'Lease Expirations within 60 days', value: expiringLeases.toString() },
  ];

  return (
    <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl bg-white shadow-sm border p-4">
          <p className="text-xs uppercase text-slate-500">{card.label}</p>
          <p className="text-2xl font-semibold mt-2">{card.value}</p>
        </div>
      ))}
    </div>
  );
}
