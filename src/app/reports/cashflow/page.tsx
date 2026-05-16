import Link from 'next/link';
import { PaymentStatus, RecordStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { getEffectiveTimezone } from '@/lib/time/effective';
import { getRecentCashflowSeries } from '@/lib/finance/landlord-financials';
import { portfolioCashflow } from '@/lib/finance/metrics';

export const dynamic = 'force-dynamic';

const ALLOWED_MONTHS = [6, 12, 24];

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

export default async function Page({
  searchParams,
}: {
  searchParams?: { months?: string };
}) {
  const { landlordId } = await getCurrentLandlordWorkspace();
  const tz = await getEffectiveTimezone();

  const requested = Number(searchParams?.months);
  const months = ALLOWED_MONTHS.includes(requested) ? requested : 12;

  const [payments, expenses] = await Promise.all([
    prisma.payment.findMany({
      where: { landlordId, status: { not: PaymentStatus.VOID } },
    }),
    prisma.expense.findMany({
      where: { landlordId, status: RecordStatus.ACTIVE },
    }),
  ]);

  const series = getRecentCashflowSeries(payments, expenses, months, tz);

  const portfolioNet = portfolioCashflow(
    series.map((s) => ({
      rentCollected: s.rentCollected,
      expenseTotal: s.expenses,
    })),
  );
  const totalCollected = series.reduce((sum, s) => sum + s.rentCollected, 0);
  const totalExpenses = series.reduce((sum, s) => sum + s.expenses, 0);

  return (
    <Shell title="Cashflow">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Link href="/reports" className="text-brand-navy text-sm">
            &larr; Back to Reports
          </Link>
          <a
            href={`/api/reports/cashflow/export?months=${months}`}
            className="rounded-md bg-brand-navy text-white text-sm px-3 py-2"
          >
            Export CSV
          </a>
        </div>

        <form method="GET" className="rounded-xl bg-white border shadow-sm p-4 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm text-slate-500 mb-1">Period</label>
            <select
              name="months"
              defaultValue={String(months)}
              className="border rounded-md px-3 py-2"
            >
              <option value="6">Last 6 months</option>
              <option value="12">Last 12 months</option>
              <option value="24">Last 24 months</option>
            </select>
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
            <p className="text-slate-500">Total collected</p>
            <p className="text-2xl font-semibold">{formatKYD(totalCollected)}</p>
          </div>
          <div className="rounded-xl bg-white border shadow-sm p-4">
            <p className="text-slate-500">Total expenses</p>
            <p className="text-2xl font-semibold">{formatKYD(totalExpenses)}</p>
          </div>
          <div className="rounded-xl bg-white border shadow-sm p-4">
            <p className="text-slate-500">Portfolio net</p>
            <p
              className={`text-2xl font-semibold ${
                portfolioNet >= 0 ? 'text-green-600' : 'text-red-600'
              }`}
            >
              {formatKYD(portfolioNet)}
            </p>
          </div>
        </div>

        <section className="rounded-xl bg-white border shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Monthly cashflow</h3>
          </div>
          {series.length === 0 ? (
            <p className="p-4 text-slate-600">No data.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-3">Month</th>
                    <th className="text-right p-3">Collected</th>
                    <th className="text-right p-3">Expenses</th>
                    <th className="text-right p-3">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {series.map((s) => (
                    <tr key={s.label}>
                      <td className="p-3">{s.label}</td>
                      <td className="p-3 text-right">
                        {formatKYD(s.rentCollected)}
                      </td>
                      <td className="p-3 text-right">
                        {formatKYD(s.expenses)}
                      </td>
                      <td
                        className={`p-3 text-right font-medium ${
                          s.net >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {formatKYD(s.net)}
                      </td>
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
