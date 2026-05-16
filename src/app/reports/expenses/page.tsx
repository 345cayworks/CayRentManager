import Link from 'next/link';
import { RecordStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { getEffectiveTimezone } from '@/lib/time/effective';
import { formatDate } from '@/lib/time/format';
import { parseReportRange, inRange, groupExpenses } from '@/lib/finance/reports';

export const dynamic = 'force-dynamic';

function formatKYD(value: number) {
  try {
    return new Intl.NumberFormat('en-KY', {
      style: 'currency',
      currency: 'KYD',
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `KYD ${value.toFixed(2)}`;
  }
}

function ymd(d: Date): string {
  return d.toISOString().split('T')[0];
}

export default async function Page({
  searchParams,
}: {
  searchParams?: {
    from?: string;
    to?: string;
    by?: string;
    propertyId?: string;
  };
}) {
  const { landlordId } = await getCurrentLandlordWorkspace();
  const tz = await getEffectiveTimezone();

  const range = parseReportRange({
    from: searchParams?.from,
    to: searchParams?.to,
  });
  const by: 'category' | 'property' =
    searchParams?.by === 'property' ? 'property' : 'category';
  const propertyId = searchParams?.propertyId || '';

  const [properties, expenses] = await Promise.all([
    prisma.property.findMany({
      where: { landlordId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.expense.findMany({
      where: {
        landlordId,
        status: RecordStatus.ACTIVE,
        ...(propertyId ? { propertyId } : {}),
      },
      include: { property: { select: { name: true } } },
      orderBy: { expenseDate: 'desc' },
    }),
  ]);

  const detail = expenses
    .filter((e) => inRange(e.expenseDate, range))
    .map((e) => ({
      id: e.id,
      category: e.category,
      propertyName: e.property.name,
      vendor: e.vendor,
      amount: Number(e.amount),
      expenseDate: e.expenseDate,
    }));

  const { rows: grouped, grandTotal } = groupExpenses(detail, by);

  const exportQs = new URLSearchParams();
  exportQs.set('from', ymd(range.start));
  exportQs.set('to', ymd(range.end));
  exportQs.set('by', by);
  if (propertyId) exportQs.set('propertyId', propertyId);

  function toggleHref(target: 'category' | 'property') {
    const q = new URLSearchParams();
    q.set('from', ymd(range.start));
    q.set('to', ymd(range.end));
    q.set('by', target);
    if (propertyId) q.set('propertyId', propertyId);
    return `/reports/expenses?${q.toString()}`;
  }

  return (
    <Shell title="Expense Report">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Link href="/reports" className="text-brand-navy text-sm">
            &larr; Back to Reports
          </Link>
          <a
            href={`/api/reports/expenses/export?${exportQs.toString()}`}
            className="rounded-md bg-brand-navy text-white text-sm px-3 py-2"
          >
            Export CSV
          </a>
        </div>

        <form method="GET" className="rounded-xl bg-white border shadow-sm p-4 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm text-slate-500 mb-1">From</label>
            <input
              type="date"
              name="from"
              defaultValue={ymd(range.start)}
              className="border rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-500 mb-1">To</label>
            <input
              type="date"
              name="to"
              defaultValue={ymd(range.end)}
              className="border rounded-md px-3 py-2"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-500 mb-1">Property</label>
            <select
              name="propertyId"
              defaultValue={propertyId}
              className="border rounded-md px-3 py-2"
            >
              <option value="">All properties</option>
              {properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <input type="hidden" name="by" value={by} />
          <button
            type="submit"
            className="rounded-md bg-brand-navy text-white text-sm px-4 py-2"
          >
            Apply
          </button>
        </form>

        <div className="flex gap-2 text-sm">
          <span className="text-slate-500 self-center">Group by:</span>
          <Link
            href={toggleHref('category')}
            className={`px-3 py-1 rounded-md border ${
              by === 'category' ? 'bg-brand-navy text-white' : 'bg-white'
            }`}
          >
            Category
          </Link>
          <Link
            href={toggleHref('property')}
            className={`px-3 py-1 rounded-md border ${
              by === 'property' ? 'bg-brand-navy text-white' : 'bg-white'
            }`}
          >
            Property
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl bg-white border shadow-sm p-4">
            <p className="text-slate-500">Grand total</p>
            <p className="text-2xl font-semibold">{formatKYD(grandTotal)}</p>
          </div>
          <div className="rounded-xl bg-white border shadow-sm p-4">
            <p className="text-slate-500">Expense count</p>
            <p className="text-2xl font-semibold">{detail.length}</p>
          </div>
        </div>

        <section className="rounded-xl bg-white border shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold">
              Grouped by {by === 'category' ? 'category' : 'property'}
            </h3>
          </div>
          {grouped.length === 0 ? (
            <p className="p-4 text-slate-600">No expenses in range.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-3">
                      {by === 'category' ? 'Category' : 'Property'}
                    </th>
                    <th className="text-right p-3">Count</th>
                    <th className="text-right p-3">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {grouped.map((g) => (
                    <tr key={g.key}>
                      <td className="p-3">{g.key}</td>
                      <td className="p-3 text-right">{g.count}</td>
                      <td className="p-3 text-right">{formatKYD(g.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-xl bg-white border shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Detail</h3>
          </div>
          {detail.length === 0 ? (
            <p className="p-4 text-slate-600">No expenses in range.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-3">Date</th>
                    <th className="text-left p-3">Category</th>
                    <th className="text-left p-3">Property</th>
                    <th className="text-left p-3">Vendor</th>
                    <th className="text-right p-3">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {detail.map((e) => (
                    <tr key={e.id}>
                      <td className="p-3">{formatDate(e.expenseDate, tz)}</td>
                      <td className="p-3">{e.category}</td>
                      <td className="p-3">{e.propertyName}</td>
                      <td className="p-3">{e.vendor ?? '—'}</td>
                      <td className="p-3 text-right">{formatKYD(e.amount)}</td>
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
