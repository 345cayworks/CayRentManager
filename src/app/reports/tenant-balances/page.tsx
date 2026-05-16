import Link from 'next/link';
import { PaymentStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { tenantBalanceRows } from '@/lib/finance/reports';

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

export default async function Page() {
  const { landlordId } = await getCurrentLandlordWorkspace();

  const [tenants, payments] = await Promise.all([
    prisma.tenant.findMany({
      where: { landlordId },
      select: { id: true, fullName: true, email: true },
      orderBy: { fullName: 'asc' },
    }),
    prisma.payment.findMany({
      where: { landlordId, status: { not: PaymentStatus.VOID } },
      select: {
        tenantId: true,
        amountDue: true,
        amountPaid: true,
        balance: true,
        dueDate: true,
      },
    }),
  ]);

  const rows = tenantBalanceRows(
    tenants,
    payments.map((p) => ({
      tenantId: p.tenantId,
      amountDue: Number(p.amountDue),
      amountPaid: Number(p.amountPaid ?? 0),
      balance: Number(p.balance),
      dueDate: p.dueDate,
    })),
  );

  const totalOutstanding = rows.reduce((sum, r) => sum + r.balance, 0);
  const totalOverdue = rows.reduce((sum, r) => sum + r.overdue, 0);
  const inArrears = rows.filter((r) => r.balance > 0).length;

  return (
    <Shell title="Tenant Balances">
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <Link href="/reports" className="text-brand-navy text-sm">
            &larr; Back to Reports
          </Link>
          <a
            href="/api/reports/tenant-balances/export"
            className="rounded-md bg-brand-navy text-white text-sm px-3 py-2"
          >
            Export CSV
          </a>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-white border shadow-sm p-4">
            <p className="text-slate-500">Total outstanding</p>
            <p className="text-2xl font-semibold">{formatKYD(totalOutstanding)}</p>
          </div>
          <div className="rounded-xl bg-white border shadow-sm p-4">
            <p className="text-slate-500">Total overdue</p>
            <p className="text-2xl font-semibold text-red-600">
              {formatKYD(totalOverdue)}
            </p>
          </div>
          <div className="rounded-xl bg-white border shadow-sm p-4">
            <p className="text-slate-500">Tenants in arrears</p>
            <p className="text-2xl font-semibold">{inArrears}</p>
          </div>
        </div>

        <section className="rounded-xl bg-white border shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Tenant balances (snapshot)</h3>
          </div>
          {rows.length === 0 ? (
            <p className="p-4 text-slate-600">No tenants found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-3">Tenant</th>
                    <th className="text-left p-3">Email</th>
                    <th className="text-right p-3">Total Due</th>
                    <th className="text-right p-3">Total Paid</th>
                    <th className="text-right p-3">Balance</th>
                    <th className="text-right p-3">Overdue</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((r) => (
                    <tr key={r.tenantId}>
                      <td className="p-3">
                        <Link
                          href={`/tenants/${r.tenantId}`}
                          className="text-brand-navy"
                        >
                          {r.fullName}
                        </Link>
                      </td>
                      <td className="p-3">{r.email}</td>
                      <td className="p-3 text-right">{formatKYD(r.totalDue)}</td>
                      <td className="p-3 text-right">{formatKYD(r.totalPaid)}</td>
                      <td className="p-3 text-right">{formatKYD(r.balance)}</td>
                      <td
                        className={`p-3 text-right ${
                          r.overdue > 0 ? 'text-red-600 font-medium' : ''
                        }`}
                      >
                        {formatKYD(r.overdue)}
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
