import { RecordStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { recordExpenseAction } from '@/server/actions';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const { landlordId } = await getCurrentLandlordWorkspace();
  const [properties, units, expenses] = await Promise.all([
    prisma.property.findMany({ where: { landlordId, status: RecordStatus.ACTIVE }, orderBy: { name: 'asc' } }),
    prisma.unit.findMany({ where: { landlordId, status: RecordStatus.ACTIVE }, orderBy: { unitName: 'asc' } }),
    prisma.expense.findMany({ where: { landlordId, status: RecordStatus.ACTIVE }, include: { property: true, unit: true }, orderBy: { expenseDate: 'desc' } }),
  ]);

  return (
    <Shell title="Expenses">
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
      <div className="rounded-xl bg-white border shadow-sm divide-y">
        {expenses.length === 0 ? <p className="p-4 text-slate-600">No expenses yet.</p> : null}
        {expenses.map((expense) => (
          <div key={expense.id} className="p-4 flex justify-between gap-4">
            <div>
              <p className="font-medium">{expense.category}</p>
              <p className="text-sm text-slate-600">{expense.property.name}{expense.unit ? ` / ${expense.unit.unitName}` : ''}</p>
            </div>
            <p className="font-medium">${Number(expense.amount).toFixed(2)}</p>
          </div>
        ))}
      </div>
    </Shell>
  );
}
