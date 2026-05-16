import Link from 'next/link';
import { PaymentStatus, RecordStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { parseReportRange, computePropertyPL } from '@/lib/finance/reports';

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
  searchParams?: { from?: string; to?: string };
}) {
  const { landlordId } = await getCurrentLandlordWorkspace();

  const range = parseReportRange({
    from: searchParams?.from,
    to: searchParams?.to,
  });

  const [properties, payments, expenses] = await Promise.all([
    prisma.property.findMany({
      where: { landlordId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.payment.findMany({
      where: {
        landlordId,
        status: { not: PaymentStatus.VOID },
        paymentDate: { gte: range.start, lte: range.end },
      },
      select: { propertyId: true, amountPaid: true, paymentDate: true },
    }),
    prisma.expense.findMany({
      where: {
        landlordId,
        status: RecordStatus.ACTIVE,
        expenseDate: { gte: range.start, lte: range.end },
      },
      select: { propertyId: true, amount: true, expenseDate: true },
    }),
  ]);

  const { rows, totals } = computePropertyPL(
    properties,
    payments.map((p) => ({
      propertyId: p.propertyId,
      amountPaid: Number(p.amountPaid ?? 0),
      paymentDate: p.paymentDate,
    })),
    expenses.map((e) => ({
      propertyId: e.propertyId,
      amount: Number(e.amount),
      expenseDate: e.expenseDate,
    })),
    range,
  );

  const exportQs = new URLSearchParams();
  exportQs.set('from', ymd(range.start));
  exportQs.set('to', ymd(range.end));

  return (
    <Shell title="Property P&L">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Link href="/reports" className="text-brand-navy text-sm">
            &larr; Back to Reports
          </Link>
          <a
            href={`/api/reports/property-pl/export?${exportQs.toString()}`}
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
          <button
            type="submit"
            className="rounded-md bg-brand-navy text-white text-sm px-4 py-2"
          >
            Apply
          </button>
        </form>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-white border shadow-sm p-4">
            <p className="text-slate-500">Total income</p>
            <p className="text-2xl font-semibold">{formatKYD(totals.income)}</p>
          </div>
          <div className="rounded-xl bg-white border shadow-sm p-4">
            <p className="text-slate-500">Total expense</p>
            <p className="text-2xl font-semibold">{formatKYD(totals.expense)}</p>
          </div>
          <div className="rounded-xl bg-white border shadow-sm p-4">
            <p className="text-slate-500">Net</p>
            <p
              className={`text-2xl font-semibold ${
                totals.net >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {formatKYD(totals.net)}
            </p>
          </div>
        </div>

        <section className="rounded-xl bg-white border shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Profit &amp; loss by property</h3>
          </div>
          {rows.length === 0 ? (
            <p className="p-4 text-slate-600">No properties found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-3">Property</th>
                    <th className="text-right p-3">Income</th>
                    <th className="text-right p-3">Expense</th>
                    <th className="text-right p-3">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => (
                    <tr key={r.propertyId}>
                      <td className="p-3">{r.name}</td>
                      <td className="p-3 text-right">{formatKYD(r.income)}</td>
                      <td className="p-3 text-right">{formatKYD(r.expense)}</td>
                      <td
                        className={`p-3 text-right font-medium ${
                          r.net >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {formatKYD(r.net)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-semibold">
                    <td className="p-3">Totals</td>
                    <td className="p-3 text-right">
                      {formatKYD(totals.income)}
                    </td>
                    <td className="p-3 text-right">
                      {formatKYD(totals.expense)}
                    </td>
                    <td
                      className={`p-3 text-right ${
                        totals.net >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {formatKYD(totals.net)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>
      </div>
    </Shell>
  );
}
