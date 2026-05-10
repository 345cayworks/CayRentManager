import Link from 'next/link';
import { PaymentStatus, RecordStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const { landlordId } = await getCurrentLandlordWorkspace();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [properties, payments, expenses] = await Promise.all([
    prisma.property.findMany({
      where: { landlordId, status: RecordStatus.ACTIVE },
      include: {
        units: { where: { status: RecordStatus.ACTIVE } },
        leases: { where: { status: 'ACTIVE' } },
      },
    }),
    prisma.payment.findMany({
      where: { landlordId, status: { not: PaymentStatus.VOID } },
    }),
    prisma.expense.findMany({
      where: { landlordId, status: RecordStatus.ACTIVE },
    }),
  ]);

  const totalProperties = properties.length;
  const totalUnits = properties.reduce((sum, p) => sum + p.units.length, 0);
  const totalLeases = properties.reduce((sum, p) => sum + p.leases.length, 0);

  const thisMonthPayments = payments.filter(p => p.dueDate >= startOfMonth && p.dueDate <= endOfMonth);
  const totalRentDueThisMonth = thisMonthPayments.reduce((sum, p) => sum + Number(p.amountDue), 0);
  const totalRentCollectedThisMonth = thisMonthPayments.reduce((sum, p) => sum + Number(p.amountPaid ?? 0), 0);

  const thisMonthExpenses = expenses.filter(e => e.expenseDate >= startOfMonth && e.expenseDate <= endOfMonth);
  const totalExpensesThisMonth = thisMonthExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const outstandingBalance = payments.reduce((sum, p) => sum + Number(p.balance), 0);
  const overdueAmount = payments.filter(p => p.dueDate < now && Number(p.balance) > 0).reduce((sum, p) => sum + Number(p.balance), 0);

  const monthlyRentExpected = properties.reduce((sum, p) => sum + p.leases.reduce((leaseSum, l) => leaseSum + Number(l.rentAmount), 0), 0);
  const netCashflow = totalRentCollectedThisMonth - totalExpensesThisMonth;

  return (
    <Shell title="Financial Overview">
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl bg-white border shadow-sm p-4">
            <p className="text-slate-500">Total properties</p>
            <p className="text-2xl font-semibold">{totalProperties}</p>
          </div>
          <div className="rounded-xl bg-white border shadow-sm p-4">
            <p className="text-slate-500">Total units</p>
            <p className="text-2xl font-semibold">{totalUnits}</p>
          </div>
          <div className="rounded-xl bg-white border shadow-sm p-4">
            <p className="text-slate-500">Active leases</p>
            <p className="text-2xl font-semibold">{totalLeases}</p>
          </div>
          <div className="rounded-xl bg-white border shadow-sm p-4">
            <p className="text-slate-500">Occupancy rate</p>
            <p className="text-2xl font-semibold">{totalUnits > 0 ? ((totalLeases / totalUnits) * 100).toFixed(1) : 0}%</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-xl bg-white border shadow-sm p-4">
            <p className="text-slate-500">Rent due this month</p>
            <p className="text-2xl font-semibold">${totalRentDueThisMonth.toFixed(2)}</p>
          </div>
          <div className="rounded-xl bg-white border shadow-sm p-4">
            <p className="text-slate-500">Rent collected this month</p>
            <p className="text-2xl font-semibold">${totalRentCollectedThisMonth.toFixed(2)}</p>
          </div>
          <div className="rounded-xl bg-white border shadow-sm p-4">
            <p className="text-slate-500">Expenses this month</p>
            <p className="text-2xl font-semibold">${totalExpensesThisMonth.toFixed(2)}</p>
          </div>
          <div className="rounded-xl bg-white border shadow-sm p-4">
            <p className="text-slate-500">Net cashflow</p>
            <p className={`text-2xl font-semibold ${netCashflow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${netCashflow.toFixed(2)}
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-white border shadow-sm p-4">
            <p className="text-slate-500">Outstanding balance</p>
            <p className="text-2xl font-semibold">${outstandingBalance.toFixed(2)}</p>
          </div>
          <div className="rounded-xl bg-white border shadow-sm p-4">
            <p className="text-slate-500">Overdue amount</p>
            <p className="text-2xl font-semibold text-red-600">${overdueAmount.toFixed(2)}</p>
          </div>
          <div className="rounded-xl bg-white border shadow-sm p-4">
            <p className="text-slate-500">Monthly rent expected</p>
            <p className="text-2xl font-semibold">${monthlyRentExpected.toFixed(2)}</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-xl bg-white border shadow-sm p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Recent payments</h3>
              <Link href="/payments" className="text-brand-navy text-sm">View all</Link>
            </div>
            {payments.slice(0, 5).length === 0 ? (
              <p className="text-slate-600">No payments yet.</p>
            ) : (
              <div className="space-y-2">
                {payments.slice(0, 5).map((payment) => (
                  <div key={payment.id} className="flex justify-between">
                    <div>
                      <p className="font-medium">${Number(payment.amountPaid ?? 0).toFixed(2)}</p>
                      <p className="text-sm text-slate-500">{payment.dueDate.toLocaleDateString()}</p>
                    </div>
                    <span className={`text-sm px-2 py-1 rounded ${
                      payment.status === 'PAID' ? 'bg-green-100 text-green-800' :
                      payment.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {payment.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl bg-white border shadow-sm p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold">Recent expenses</h3>
              <Link href="/expenses" className="text-brand-navy text-sm">View all</Link>
            </div>
            {expenses.slice(0, 5).length === 0 ? (
              <p className="text-slate-600">No expenses yet.</p>
            ) : (
              <div className="space-y-2">
                {expenses.slice(0, 5).map((expense) => (
                  <div key={expense.id} className="flex justify-between">
                    <div>
                      <p className="font-medium">{expense.category}</p>
                      <p className="text-sm text-slate-500">{expense.expenseDate.toLocaleDateString()}</p>
                    </div>
                    <span className="font-medium">${Number(expense.amount).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </Shell>
  );
}