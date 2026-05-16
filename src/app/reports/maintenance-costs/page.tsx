import Link from 'next/link';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import {
  parseReportRange,
  aggregateMaintenanceCosts,
} from '@/lib/finance/reports';

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
  searchParams?: { from?: string; to?: string; by?: string };
}) {
  const { landlordId } = await getCurrentLandlordWorkspace();

  const range = parseReportRange({
    from: searchParams?.from,
    to: searchParams?.to,
  });
  const by: 'property' | 'category' =
    searchParams?.by === 'category' ? 'category' : 'property';

  const workOrders = await prisma.maintenanceWorkOrder.findMany({
    where: { maintenanceRequest: { landlordId } },
    include: {
      maintenanceRequest: {
        select: {
          category: true,
          createdAt: true,
          property: { select: { name: true } },
        },
      },
    },
  });

  const mapped = workOrders.map((wo) => ({
    propertyName: wo.maintenanceRequest.property.name,
    category: String(wo.maintenanceRequest.category),
    estimatedCost: wo.estimatedCost == null ? null : Number(wo.estimatedCost),
    actualCost: wo.actualCost == null ? null : Number(wo.actualCost),
    createdAt: wo.maintenanceRequest.createdAt,
  }));

  const { rows, totals } = aggregateMaintenanceCosts(mapped, by, range);

  const exportQs = new URLSearchParams();
  exportQs.set('from', ymd(range.start));
  exportQs.set('to', ymd(range.end));
  exportQs.set('by', by);

  function toggleHref(target: 'property' | 'category') {
    const q = new URLSearchParams();
    q.set('from', ymd(range.start));
    q.set('to', ymd(range.end));
    q.set('by', target);
    return `/reports/maintenance-costs?${q.toString()}`;
  }

  return (
    <Shell title="Maintenance Costs">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Link href="/reports" className="text-brand-navy text-sm">
            &larr; Back to Reports
          </Link>
          <a
            href={`/api/reports/maintenance-costs/export?${exportQs.toString()}`}
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
            href={toggleHref('property')}
            className={`px-3 py-1 rounded-md border ${
              by === 'property' ? 'bg-brand-navy text-white' : 'bg-white'
            }`}
          >
            Property
          </Link>
          <Link
            href={toggleHref('category')}
            className={`px-3 py-1 rounded-md border ${
              by === 'category' ? 'bg-brand-navy text-white' : 'bg-white'
            }`}
          >
            Category
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-white border shadow-sm p-4">
            <p className="text-slate-500">Estimated</p>
            <p className="text-2xl font-semibold">
              {formatKYD(totals.estimated)}
            </p>
          </div>
          <div className="rounded-xl bg-white border shadow-sm p-4">
            <p className="text-slate-500">Actual</p>
            <p className="text-2xl font-semibold">{formatKYD(totals.actual)}</p>
          </div>
          <div className="rounded-xl bg-white border shadow-sm p-4">
            <p className="text-slate-500">Work orders</p>
            <p className="text-2xl font-semibold">{totals.count}</p>
          </div>
        </div>

        <section className="rounded-xl bg-white border shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold">
              Maintenance cost by {by === 'property' ? 'property' : 'category'}
            </h3>
          </div>
          {rows.length === 0 ? (
            <p className="p-4 text-slate-600">
              No work orders in the selected range.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-3">
                      {by === 'property' ? 'Property' : 'Category'}
                    </th>
                    <th className="text-right p-3">Estimated</th>
                    <th className="text-right p-3">Actual</th>
                    <th className="text-right p-3">Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => (
                    <tr key={r.key}>
                      <td className="p-3">{r.key}</td>
                      <td className="p-3 text-right">
                        {formatKYD(r.estimated)}
                      </td>
                      <td className="p-3 text-right">{formatKYD(r.actual)}</td>
                      <td className="p-3 text-right">{r.count}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 font-semibold">
                    <td className="p-3">Totals</td>
                    <td className="p-3 text-right">
                      {formatKYD(totals.estimated)}
                    </td>
                    <td className="p-3 text-right">
                      {formatKYD(totals.actual)}
                    </td>
                    <td className="p-3 text-right">{totals.count}</td>
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
