import Link from 'next/link';
import { RecordStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { recordExpenseAction, voidExpenseAction } from '@/server/actions';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const { landlordId } = await getCurrentLandlordWorkspace();

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [properties, units, expenses] = await Promise.all([
    prisma.property.findMany({ where: { landlordId, status: RecordStatus.ACTIVE }, orderBy: { name: 'asc' } }),
    prisma.unit.findMany({ where: { landlordId, status: RecordStatus.ACTIVE }, orderBy: { unitName: 'asc' } }),
    prisma.expense.findMany({ where: { landlordId, status: RecordStatus.ACTIVE }, include: { property: true, unit: true }, orderBy: { expenseDate: 'desc' } }),
  ]);

  const thisMonthExpenses = expenses.filter(e => e.expenseDate >= startOfMonth && e.expenseDate <= endOfMonth);
  const totalExpensesThisMonth = thisMonthExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalExpensesAllTime = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const categoryTotals = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + Number(e.amount);
    return acc;
  }, {} as Record<string, number>);

  const topCategories = Object.entries(categoryTotals)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3);

  return (
    <Shell title="Expenses">
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <div className="rounded-xl bg-white border shadow-sm p-4">
          <p className="text-slate-500">This month</p>
          <p className="text-2xl font-semibold">${totalExpensesThisMonth.toFixed(2)}</p>
        </div>
        <div className="rounded-xl bg-white border shadow-sm p-4">
          <p className="text-slate-500">All time</p>
          <p className="text-2xl font-semibold">${totalExpensesAllTime.toFixed(2)}</p>
        </div>
        <div className="rounded-xl bg-white border shadow-sm p-4">
          <p className="text-slate-500">Top category</p>
          <p className="text-2xl font-semibold">{topCategories[0]?.[0] ?? 'None'}</p>
          <p className="text-sm text-slate-500">${topCategories[0]?.[1]?.toFixed(2) ?? '0.00'}</p>
        </div>
        <div className="rounded-xl bg-white border shadow-sm p-4">
          <p className="text-slate-500">Total categories</p>
          <p className="text-2xl font-semibold">{Object.keys(categoryTotals).length}</p>
        </div>
      </div>

      <form action={recordExpenseAction} className="grid md:grid-cols-6 gap-3 rounded-xl bg-white border shadow-sm p-4 mb-4">
        <select required name="propertyId" className="border rounded px-3 py-2 md:col-span-2">
          <option value="">Property</option>
          {properties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}
        </select>
        <select name="unitId" className="border rounded px-3 py-2">
          <option value="">Optional unit</option>
          {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.unitName}</option>)}
        </select>
        <input required name="category" placeholder="Category" className="border rounded px-3 py-2" />
        <input name="vendor" placeholder="Vendor" className="border rounded px-3 py-2" />
        <input required name="amount" type="number" step="0.01" placeholder="Amount" className="border rounded px-3 py-2" />
        <input required name="expenseDate" type="date" className="border rounded px-3 py-2" />
        <input name="description" placeholder="Description" className="border rounded px-3 py-2 md:col-span-3" />
        <button className="rounded bg-brand-navy text-white px-4 py-2 md:col-span-2">Record expense</button>
      </form>

      <div className="rounded-xl bg-white border shadow-sm overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Expense history</h3>
        </div>
        {expenses.length === 0 ? (
          <p className="p-4 text-slate-600">No expenses yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-3">Date</th>
                  <th className="text-left p-3">Category</th>
                  <th className="text-left p-3">Property</th>
                  <th className="text-left p-3">Unit</th>
                  <th className="text-left p-3">Vendor</th>
                  <th className="text-right p-3">Amount</th>
                  <th className="text-left p-3">Description</th>
                  <th className="text-left p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td className="p-3">{expense.expenseDate.toLocaleDateString()}</td>
                    <td className="p-3">{expense.category}</td>
                    <td className="p-3">
                      <Link href={`/properties/${expense.property.id}`} className="text-brand-navy">
                        {expense.property.name}
                      </Link>
                    </td>
                    <td className="p-3">
                      {expense.unit ? (
                        <Link href={`/units/${expense.unit.id}`} className="text-brand-navy">
                          {expense.unit.unitName}
                        </Link>
                      ) : '—'}
                    </td>
                    <td className="p-3">{expense.vendor ?? '—'}</td>
                    <td className="p-3 text-right">${Number(expense.amount).toFixed(2)}</td>
                    <td className="p-3">{expense.description ?? '—'}</td>
                    <td className="p-3">
                      <form action={voidExpenseAction} className="inline">
                        <input type="hidden" name="expenseId" value={expense.id} />
                        <button className="text-sm rounded border px-2 py-1">Void</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Shell>
  );
}
