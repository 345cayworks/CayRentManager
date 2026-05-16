import Link from 'next/link';
import { PaymentStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { getEffectiveTimezone } from '@/lib/time/effective';
import { formatDate } from '@/lib/time/format';
import { parseReportRange, inRange } from '@/lib/finance/reports';

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
  searchParams?: { from?: string; to?: string; propertyId?: string };
}) {
  const { landlordId } = await getCurrentLandlordWorkspace();
  const tz = await getEffectiveTimezone();

  const range = parseReportRange({
    from: searchParams?.from,
    to: searchParams?.to,
  });
  const propertyId = searchParams?.propertyId || '';

  const [properties, payments] = await Promise.all([
    prisma.property.findMany({
      where: { landlordId },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.payment.findMany({
      where: {
        landlordId,
        status: { not: PaymentStatus.VOID },
        ...(propertyId ? { propertyId } : {}),
      },
      include: {
        tenant: true,
        unit: { include: { property: true } },
      },
      orderBy: { dueDate: 'desc' },
    }),
  ]);

  const filtered = payments.filter((p) =>
    inRange(p.paymentDate ?? p.dueDate, range),
  );

  const totalCollected = filtered.reduce(
    (sum, p) => sum + Number(p.amountPaid ?? 0),
    0,
  );
  const totalOutstanding = filtered.reduce(
    (sum, p) => sum + Number(p.balance),
    0,
  );

  const exportQs = new URLSearchParams();
  exportQs.set('from', ymd(range.start));
  exportQs.set('to', ymd(range.end));

  return (
    <Shell title="Payment History">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Link href="/reports" className="text-brand-navy text-sm">
            &larr; Back to Reports
          </Link>
          <a
            href={`/api/payments/export?${exportQs.toString()}`}
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
          <button
            type="submit"
            className="rounded-md bg-brand-navy text-white text-sm px-4 py-2"
          >
            Apply
          </button>
        </form>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-white border shadow-sm p-4">
            <p className="text-slate-500">Payments</p>
            <p className="text-2xl font-semibold">{filtered.length}</p>
          </div>
          <div className="rounded-xl bg-white border shadow-sm p-4">
            <p className="text-slate-500">Total collected</p>
            <p className="text-2xl font-semibold">{formatKYD(totalCollected)}</p>
          </div>
          <div className="rounded-xl bg-white border shadow-sm p-4">
            <p className="text-slate-500">Total outstanding</p>
            <p className="text-2xl font-semibold">
              {formatKYD(totalOutstanding)}
            </p>
          </div>
        </div>

        <section className="rounded-xl bg-white border shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Payments in range</h3>
          </div>
          {filtered.length === 0 ? (
            <p className="p-4 text-slate-600">
              No payments in the selected range.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-3">Due Date</th>
                    <th className="text-left p-3">Paid Date</th>
                    <th className="text-left p-3">Tenant</th>
                    <th className="text-left p-3">Property / Unit</th>
                    <th className="text-right p-3">Amount Due</th>
                    <th className="text-right p-3">Amount Paid</th>
                    <th className="text-right p-3">Balance</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Method</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((p) => (
                    <tr key={p.id}>
                      <td className="p-3">{formatDate(p.dueDate, tz)}</td>
                      <td className="p-3">
                        {p.paymentDate ? formatDate(p.paymentDate, tz) : '—'}
                      </td>
                      <td className="p-3">{p.tenant.fullName}</td>
                      <td className="p-3">
                        {p.unit.property.name} / {p.unit.unitName}
                      </td>
                      <td className="p-3 text-right">
                        {formatKYD(Number(p.amountDue))}
                      </td>
                      <td className="p-3 text-right">
                        {formatKYD(Number(p.amountPaid ?? 0))}
                      </td>
                      <td className="p-3 text-right">
                        {formatKYD(Number(p.balance))}
                      </td>
                      <td className="p-3">{p.status}</td>
                      <td className="p-3">{p.paymentMethod ?? '—'}</td>
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
