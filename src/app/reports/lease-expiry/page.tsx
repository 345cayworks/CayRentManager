import Link from 'next/link';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { getEffectiveTimezone } from '@/lib/time/effective';
import { formatDate } from '@/lib/time/format';
import { leaseExpiryRows } from '@/lib/finance/reports';

export const dynamic = 'force-dynamic';

const ALLOWED_DAYS = [30, 60, 90, 180];

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
  searchParams?: { days?: string };
}) {
  const { landlordId } = await getCurrentLandlordWorkspace();
  const tz = await getEffectiveTimezone();

  const requested = Number(searchParams?.days);
  const days = ALLOWED_DAYS.includes(requested) ? requested : 90;

  const leases = await prisma.lease.findMany({
    where: { landlordId, status: 'ACTIVE' },
    include: {
      tenant: { select: { fullName: true } },
      property: { select: { name: true } },
      unit: { select: { unitName: true } },
    },
  });

  const rows = leaseExpiryRows(
    leases.map((l) => ({
      id: l.id,
      tenantName: l.tenant.fullName,
      propertyName: l.property.name,
      unitName: l.unit?.unitName ?? null,
      endDate: l.endDate,
      rentAmount: Number(l.rentAmount),
      status: l.status,
    })),
    days,
  );

  const totalRent = rows.reduce((sum, r) => sum + r.rentAmount, 0);

  return (
    <Shell title="Lease Expiry">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Link href="/reports" className="text-brand-navy text-sm">
            &larr; Back to Reports
          </Link>
          <a
            href={`/api/reports/lease-expiry/export?days=${days}`}
            className="rounded-md bg-brand-navy text-white text-sm px-3 py-2"
          >
            Export CSV
          </a>
        </div>

        <form method="GET" className="rounded-xl bg-white border shadow-sm p-4 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm text-slate-500 mb-1">
              Expiring within
            </label>
            <select
              name="days"
              defaultValue={String(days)}
              className="border rounded-md px-3 py-2"
            >
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
              <option value="180">180 days</option>
            </select>
          </div>
          <button
            type="submit"
            className="rounded-md bg-brand-navy text-white text-sm px-4 py-2"
          >
            Apply
          </button>
        </form>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl bg-white border shadow-sm p-4">
            <p className="text-slate-500">Leases expiring</p>
            <p className="text-2xl font-semibold">{rows.length}</p>
          </div>
          <div className="rounded-xl bg-white border shadow-sm p-4">
            <p className="text-slate-500">Monthly rent at risk</p>
            <p className="text-2xl font-semibold">{formatKYD(totalRent)}</p>
          </div>
        </div>

        <section className="rounded-xl bg-white border shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold">
              Active leases ending within {days} days
            </h3>
          </div>
          {rows.length === 0 ? (
            <p className="p-4 text-slate-600">
              No active leases expiring in this window.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-3">Tenant</th>
                    <th className="text-left p-3">Property / Unit</th>
                    <th className="text-left p-3">End Date</th>
                    <th className="text-right p-3">Days Until</th>
                    <th className="text-right p-3">Monthly Rent</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => (
                    <tr
                      key={r.id}
                      className={r.daysUntil <= 30 ? 'bg-red-50' : ''}
                    >
                      <td className="p-3">{r.tenantName}</td>
                      <td className="p-3">
                        {r.propertyName}
                        {r.unitName ? ` / ${r.unitName}` : ''}
                      </td>
                      <td className="p-3">{formatDate(r.endDate, tz)}</td>
                      <td
                        className={`p-3 text-right ${
                          r.daysUntil <= 30 ? 'text-red-600 font-medium' : ''
                        }`}
                      >
                        {r.daysUntil}
                      </td>
                      <td className="p-3 text-right">
                        {formatKYD(r.rentAmount)}
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
