import Link from 'next/link';
import { InvoiceStatus, PaymentStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import {
  createInvoiceAction,
  generateReceiptAction,
  recordInvoicePaymentAction,
  recordPaymentAction,
  voidPaymentAction,
} from '@/server/actions';
import { getCurrentMonthRange } from '@/lib/finance/landlord-financials';

export const dynamic = 'force-dynamic';

function money(value: unknown) {
  return `$${Number(value ?? 0).toFixed(2)}`;
}

function statusBadge(status: string) {
  const className =
    status === 'PAID'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : status === 'PARTIAL'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : status === 'OVERDUE'
          ? 'bg-red-50 text-red-700 border-red-200'
          : 'bg-slate-50 text-slate-700 border-slate-200';

  return <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${className}`}>{status}</span>;
}

export default async function Page() {
  const { landlordId } = await getCurrentLandlordWorkspace();

  const { start: startOfMonth, end: endOfMonth } = getCurrentMonthRange();
  const now = new Date();

  const [leases, invoices, payments] = await Promise.all([
    prisma.lease.findMany({
      where: { landlordId, status: 'ACTIVE' },
      include: { tenant: true, unit: { include: { property: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.invoice.findMany({
      where: { landlordId, status: { not: InvoiceStatus.VOID } },
      include: { tenant: true, unit: { include: { property: true } }, lease: true, payments: { include: { receipt: true } } },
      orderBy: { dueDate: 'desc' },
    }),
    prisma.payment.findMany({
      where: { landlordId, status: { not: PaymentStatus.VOID } },
      include: { tenant: true, unit: { include: { property: true } }, lease: true, invoice: true, receipt: true },
      orderBy: { dueDate: 'desc' },
    }),
  ]);

  const thisMonthInvoices = invoices.filter((invoice) => invoice.dueDate >= startOfMonth && invoice.dueDate < endOfMonth);
  const thisMonthCollectedPayments = payments.filter((payment) => payment.paymentDate && payment.paymentDate >= startOfMonth && payment.paymentDate < endOfMonth);
  const totalDueThisMonth = thisMonthInvoices.reduce((sum, invoice) => sum + Number(invoice.amount), 0);
  const totalCollectedThisMonth = thisMonthCollectedPayments.reduce((sum, payment) => sum + Number(payment.amountPaid ?? 0), 0);
  const outstandingBalance = invoices.reduce((sum, invoice) => sum + Number(invoice.balance), 0);
  const overdueAmount = invoices.filter((invoice) => invoice.dueDate < now && Number(invoice.balance) > 0).reduce((sum, invoice) => sum + Number(invoice.balance), 0);

  return (
    <Shell title="Rent Ledger & Payments">
      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <div className="rounded-xl bg-white border shadow-sm p-4">
          <p className="text-slate-500">Invoiced this month</p>
          <p className="text-2xl font-semibold">{money(totalDueThisMonth)}</p>
        </div>
        <div className="rounded-xl bg-white border shadow-sm p-4">
          <p className="text-slate-500">Collected this month</p>
          <p className="text-2xl font-semibold">{money(totalCollectedThisMonth)}</p>
        </div>
        <div className="rounded-xl bg-white border shadow-sm p-4">
          <p className="text-slate-500">Outstanding balance</p>
          <p className="text-2xl font-semibold">{money(outstandingBalance)}</p>
        </div>
        <div className="rounded-xl bg-white border shadow-sm p-4">
          <p className="text-slate-500">Overdue amount</p>
          <p className="text-2xl font-semibold">{money(overdueAmount)}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 mb-6">
        <form action={createInvoiceAction} className="grid gap-3 rounded-xl bg-white border shadow-sm p-4">
          <div>
            <h3 className="font-semibold">Create invoice</h3>
            <p className="text-sm text-slate-500">Generate a rent charge from an active lease.</p>
          </div>
          <select required name="leaseId" className="border rounded px-3 py-2">
            <option value="">Lease</option>
            {leases.map((lease) => (
              <option key={lease.id} value={lease.id}>{lease.tenant.fullName} / {lease.unit.property.name} / {lease.unit.unitName}</option>
            ))}
          </select>
          <div className="grid md:grid-cols-2 gap-3">
            <input required name="dueDate" type="date" className="border rounded px-3 py-2" />
            <input required name="amount" type="number" step="0.01" placeholder="Invoice amount" className="border rounded px-3 py-2" />
          </div>
          <input name="notes" placeholder="Notes" className="border rounded px-3 py-2" />
          <button className="rounded bg-brand-navy text-white px-4 py-2">Create invoice</button>
        </form>

        <form action={recordInvoicePaymentAction} className="grid gap-3 rounded-xl bg-white border shadow-sm p-4">
          <div>
            <h3 className="font-semibold">Record invoice payment</h3>
            <p className="text-sm text-slate-500">Apply a payment to an open invoice and generate a receipt.</p>
          </div>
          <select required name="invoiceId" className="border rounded px-3 py-2">
            <option value="">Invoice</option>
            {invoices.filter((invoice) => Number(invoice.balance) > 0).map((invoice) => (
              <option key={invoice.id} value={invoice.id}>{invoice.invoiceNo} / {invoice.tenant.fullName} / Balance {money(invoice.balance)}</option>
            ))}
          </select>
          <div className="grid md:grid-cols-2 gap-3">
            <input required name="amountPaid" type="number" step="0.01" placeholder="Payment amount" className="border rounded px-3 py-2" />
            <input name="paymentDate" type="date" className="border rounded px-3 py-2" />
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            <input name="paymentMethod" placeholder="Method, e.g. Bank Transfer" className="border rounded px-3 py-2" />
            <input name="notes" placeholder="Notes" className="border rounded px-3 py-2" />
          </div>
          <button className="rounded bg-brand-navy text-white px-4 py-2">Record invoice payment</button>
        </form>
      </div>

      <div className="rounded-xl bg-white border shadow-sm overflow-hidden mb-6">
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="font-semibold">Invoices</h3>
          <Link href="/api/payments/export" className="rounded border px-3 py-2 text-sm">
            Export CSV
          </Link>
        </div>
        {invoices.length === 0 ? (
          <p className="p-4 text-slate-600">No invoices yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-3">Invoice</th>
                  <th className="text-left p-3">Tenant</th>
                  <th className="text-left p-3">Property/Unit</th>
                  <th className="text-left p-3">Due</th>
                  <th className="text-right p-3">Amount</th>
                  <th className="text-right p-3">Paid</th>
                  <th className="text-right p-3">Balance</th>
                  <th className="text-left p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoices.map((invoice) => (
                  <tr key={invoice.id}>
                    <td className="p-3 font-medium">{invoice.invoiceNo}</td>
                    <td className="p-3"><Link href={`/tenants/${invoice.tenant.id}`} className="text-brand-navy">{invoice.tenant.fullName}</Link></td>
                    <td className="p-3"><Link href={`/properties/${invoice.unit.property.id}`} className="text-brand-navy">{invoice.unit.property.name}</Link> / {invoice.unit.unitName}</td>
                    <td className="p-3">{invoice.dueDate.toLocaleDateString()}</td>
                    <td className="p-3 text-right">{money(invoice.amount)}</td>
                    <td className="p-3 text-right">{money(invoice.amountPaid)}</td>
                    <td className="p-3 text-right">{money(invoice.balance)}</td>
                    <td className="p-3">{statusBadge(invoice.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <details className="rounded-xl bg-white border shadow-sm p-4 mb-6">
        <summary className="font-semibold cursor-pointer">Legacy manual payment entry</summary>
        <form action={recordPaymentAction} className="grid md:grid-cols-6 gap-3 mt-4">
          <select required name="leaseId" className="border rounded px-3 py-2 md:col-span-2">
            <option value="">Lease</option>
            {leases.map((lease) => <option key={lease.id} value={lease.id}>{lease.tenant.fullName} / {lease.unit.unitName}</option>)}
          </select>
          <input required name="dueDate" type="date" className="border rounded px-3 py-2" />
          <input name="paymentDate" type="date" className="border rounded px-3 py-2" />
          <input name="amountDue" type="number" step="0.01" placeholder="Amount due" className="border rounded px-3 py-2" />
          <input required name="amountPaid" type="number" step="0.01" placeholder="Paid" className="border rounded px-3 py-2" />
          <input name="paymentMethod" placeholder="Method" className="border rounded px-3 py-2" />
          <button className="rounded bg-brand-navy text-white px-4 py-2 md:col-span-5">Record manual payment</button>
        </form>
      </details>

      <div className="rounded-xl bg-white border shadow-sm overflow-hidden">
        <div className="p-4 border-b">
          <h3 className="font-semibold">Payment history</h3>
        </div>
        {payments.length === 0 ? (
          <p className="p-4 text-slate-600">No payments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-3">Tenant</th>
                  <th className="text-left p-3">Invoice</th>
                  <th className="text-left p-3">Property/Unit</th>
                  <th className="text-left p-3">Payment Date</th>
                  <th className="text-right p-3">Amount Paid</th>
                  <th className="text-right p-3">Balance</th>
                  <th className="text-left p-3">Status</th>
                  <th className="text-left p-3">Receipt</th>
                  <th className="text-left p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="p-3"><Link href={`/tenants/${payment.tenant.id}`} className="text-brand-navy">{payment.tenant.fullName}</Link></td>
                    <td className="p-3">{payment.invoice?.invoiceNo ?? 'Manual'}</td>
                    <td className="p-3"><Link href={`/properties/${payment.unit.property.id}`} className="text-brand-navy">{payment.unit.property.name}</Link> / {payment.unit.unitName}</td>
                    <td className="p-3">{payment.paymentDate?.toLocaleDateString() ?? '—'}</td>
                    <td className="p-3 text-right">{money(payment.amountPaid)}</td>
                    <td className="p-3 text-right">{money(payment.balance)}</td>
                    <td className="p-3">{statusBadge(payment.status)}</td>
                    <td className="p-3">{payment.receipt ? <Link className="text-brand-navy underline" href={`/api/receipts/${payment.receipt.id}`} target="_blank">{payment.receipt.receiptNo}</Link> : '—'}</td>
                    <td className="p-3 flex gap-2">
                      {!payment.receipt && (
                        <form action={generateReceiptAction} className="inline">
                          <input type="hidden" name="paymentId" value={payment.id} />
                          <button className="text-sm rounded border px-2 py-1">Receipt</button>
                        </form>
                      )}
                      <form action={voidPaymentAction} className="inline">
                        <input type="hidden" name="paymentId" value={payment.id} />
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
