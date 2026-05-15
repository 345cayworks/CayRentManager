import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LeaseEventType, LeaseNoticeType, LeaseRenewalStatus, LeaseStatus, PaymentStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { expireLeaseAction, terminateLeaseAction } from '@/server/actions';
import {
  createLeaseDocumentVersionAction,
  createLeaseEventAction,
  createLeaseNoticeAction,
  createLeaseRenewalAction,
} from '@/server/lease-lifecycle-actions';
import { getEffectiveTimezone } from '@/lib/time/effective';
import { formatDate } from '@/lib/time/format';

export const dynamic = 'force-dynamic';

function differenceInDays(dateLeft: Date, dateRight: Date) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil((dateLeft.getTime() - dateRight.getTime()) / msPerDay);
}

function money(value: unknown) {
  if (value === null || value === undefined) return '$0.00';
  return `$${Number(value).toFixed(2)}`;
}

function badge(value: string, tone = 'slate') {
  const styles: Record<string, string> = {
    emerald: 'bg-emerald-100 text-emerald-700',
    red: 'bg-red-100 text-red-700',
    cyan: 'bg-cyan-100 text-cyan-700',
    amber: 'bg-amber-100 text-amber-700',
    slate: 'bg-slate-100 text-slate-700',
  };

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${styles[tone]}`}>
      {value}
    </span>
  );
}

export default async function Page({ params }: { params: { id: string } }) {
  const { landlordId } = await getCurrentLandlordWorkspace();
  const tz = await getEffectiveTimezone();

  const lease = await prisma.lease.findFirst({
    where: { id: params.id, landlordId },
    include: {
      tenant: true,
      property: true,
      unit: true,
      payments: {
        where: { status: { not: PaymentStatus.VOID } },
        orderBy: { dueDate: 'desc' },
      },
      events: {
        orderBy: { eventDate: 'desc' },
      },
      renewals: {
        orderBy: { createdAt: 'desc' },
      },
      notices: {
        orderBy: { noticeDate: 'desc' },
      },
      documentVersions: {
        orderBy: { versionNumber: 'desc' },
      },
    },
  });

  if (!lease) redirect('/unauthorized');

  const outstandingBalance = lease.payments.reduce((sum, payment) => sum + Number(payment.balance), 0);
  const totalPaid = lease.payments.reduce((sum, payment) => sum + Number(payment.amountPaid ?? 0), 0);
  const totalDue = lease.payments.reduce((sum, payment) => sum + Number(payment.amountDue), 0);
  const daysRemaining = differenceInDays(lease.endDate, new Date());

  return (
    <Shell title={`Lease: ${lease.tenant.fullName}`}>
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <Link href="/leases" className="text-sm text-slate-500 hover:underline">
            ← Back to leases
          </Link>
          <h2 className="mt-2 text-3xl font-semibold">Lease Operations</h2>
          <p className="mt-1 text-slate-600">
            {lease.tenant.fullName} / {lease.property.name} / {lease.unit.unitName}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {daysRemaining <= 14 ? badge(`${daysRemaining} days remaining`, 'red') : badge(`${daysRemaining} days remaining`, 'amber')}
          {badge(lease.status, lease.status === LeaseStatus.ACTIVE ? 'emerald' : 'slate')}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5 mb-8">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Monthly Rent</p>
          <p className="mt-2 text-3xl font-semibold">{money(lease.rentAmount)}</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Outstanding</p>
          <p className="mt-2 text-3xl font-semibold">{money(outstandingBalance)}</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Deposit</p>
          <p className="mt-2 text-3xl font-semibold">{money(lease.depositAmount)}</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Lease Ends</p>
          <p className="mt-2 text-lg font-semibold">{formatDate(lease.endDate, tz)}</p>
        </div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Lifecycle Events</p>
          <p className="mt-2 text-3xl font-semibold">{lease.events.length}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <section className="rounded-xl bg-white border shadow-sm p-4">
            <h3 className="font-semibold">Lease Summary</h3>
            <div className="grid gap-4 sm:grid-cols-2 mt-4">
              <div>
                <p className="text-slate-500">Tenant</p>
                <Link className="text-brand-navy" href={`/tenants/${lease.tenant.id}`}>{lease.tenant.fullName}</Link>
              </div>
              <div>
                <p className="text-slate-500">Property</p>
                <Link className="text-brand-navy" href={`/properties/${lease.property.id}`}>{lease.property.name}</Link>
              </div>
              <div>
                <p className="text-slate-500">Unit</p>
                <Link className="text-brand-navy" href={`/units/${lease.unit.id}`}>{lease.unit.unitName}</Link>
              </div>
              <div>
                <p className="text-slate-500">Status</p>
                <p>{lease.status}</p>
              </div>
              <div>
                <p className="text-slate-500">Start date</p>
                <p>{formatDate(lease.startDate, tz)}</p>
              </div>
              <div>
                <p className="text-slate-500">End date</p>
                <p>{formatDate(lease.endDate, tz)}</p>
              </div>
              <div>
                <p className="text-slate-500">Late fee amount</p>
                <p>{money(lease.lateFeeAmount)}</p>
              </div>
            </div>
          </section>

          <section className="rounded-xl bg-white border shadow-sm p-4">
            <h3 className="font-semibold">Balance summary</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div><p className="text-slate-500">Outstanding balance</p><p className="text-xl font-semibold">{money(outstandingBalance)}</p></div>
              <div><p className="text-slate-500">Total paid</p><p className="text-xl font-semibold">{money(totalPaid)}</p></div>
              <div><p className="text-slate-500">Total due</p><p className="text-xl font-semibold">{money(totalDue)}</p></div>
            </div>
          </section>

          <section className="rounded-xl bg-white border shadow-sm p-4">
            <h3 className="font-semibold">Payment history</h3>
            {lease.payments.length === 0 ? (
              <p className="text-slate-600 mt-4">No payments recorded for this lease.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left p-2">Due Date</th>
                      <th className="text-left p-2">Payment Date</th>
                      <th className="text-right p-2">Amount Due</th>
                      <th className="text-right p-2">Amount Paid</th>
                      <th className="text-right p-2">Balance</th>
                      <th className="text-left p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {lease.payments.map((payment) => (
                      <tr key={payment.id}>
                        <td className="p-2">{formatDate(payment.dueDate, tz)}</td>
                        <td className="p-2">{formatDate(payment.paymentDate, tz)}</td>
                        <td className="p-2 text-right">{money(payment.amountDue)}</td>
                        <td className="p-2 text-right">{money(payment.amountPaid ?? 0)}</td>
                        <td className="p-2 text-right">{money(payment.balance)}</td>
                        <td className="p-2">{payment.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="rounded-xl bg-white border shadow-sm">
            <div className="border-b px-4 py-3"><h3 className="font-semibold">Lease Timeline</h3></div>
            <div className="divide-y">
              {lease.events.length === 0 ? <div className="p-4 text-sm text-slate-500">No lifecycle events yet.</div> : lease.events.map((event) => (
                <div key={event.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{event.eventType.replaceAll('_', ' ')}</p>
                      <p className="mt-1 text-sm text-slate-500">{formatDate(event.eventDate, tz)}</p>
                    </div>
                    {event.completedAt ? badge('Completed', 'emerald') : badge('Pending', 'amber')}
                  </div>
                  {event.description ? <p className="mt-3 text-sm text-slate-700 whitespace-pre-line">{event.description}</p> : null}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl bg-white border shadow-sm">
            <div className="border-b px-4 py-3"><h3 className="font-semibold">Renewal Workflow</h3></div>
            <div className="divide-y">
              {lease.renewals.length === 0 ? <div className="p-4 text-sm text-slate-500">No renewals yet.</div> : lease.renewals.map((renewal) => (
                <div key={renewal.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{formatDate(renewal.renewalStartDate, tz)} → {formatDate(renewal.renewalEndDate, tz)}</p>
                      <p className="mt-1 text-sm text-slate-500">Proposed Rent: {money(renewal.proposedRentAmount)}</p>
                    </div>
                    {badge(renewal.status, renewal.status === 'COMPLETED' ? 'emerald' : 'cyan')}
                  </div>
                  {renewal.notes ? <p className="mt-3 text-sm text-slate-700 whitespace-pre-line">{renewal.notes}</p> : null}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl bg-white border shadow-sm">
            <div className="border-b px-4 py-3"><h3 className="font-semibold">Notices</h3></div>
            <div className="divide-y">
              {lease.notices.length === 0 ? <div className="p-4 text-sm text-slate-500">No notices yet.</div> : lease.notices.map((notice) => (
                <div key={notice.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{notice.noticeType.replaceAll('_', ' ')}</p>
                      <p className="mt-1 text-sm text-slate-500">{formatDate(notice.noticeDate, tz)}</p>
                    </div>
                    {notice.sentAt ? badge('Sent', 'emerald') : badge('Draft', 'amber')}
                  </div>
                  <p className="mt-3 text-sm text-slate-700 whitespace-pre-line">{notice.content}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-xl bg-white border shadow-sm p-4 space-y-4">
            <div><p className="text-slate-500">Outstanding balance</p><p className="text-xl font-semibold">{money(outstandingBalance)}</p></div>
            <div className="space-y-2">
              <Link href="/leases" className="block text-brand-navy">Back to leases</Link>
              <Link href="/payments" className="block text-brand-navy">Record payment</Link>
            </div>
            <form action={terminateLeaseAction}><input type="hidden" name="leaseId" value={lease.id} /><button className="rounded border px-3 py-2 w-full text-left">Terminate lease</button></form>
            <form action={expireLeaseAction}><input type="hidden" name="leaseId" value={lease.id} /><button className="rounded border px-3 py-2 w-full text-left">Expire lease</button></form>
          </section>

          <section className="rounded-xl bg-white border shadow-sm p-4">
            <h3 className="font-semibold">Create Lifecycle Event</h3>
            <form action={createLeaseEventAction} className="mt-4 grid gap-3">
              <input type="hidden" name="leaseId" value={lease.id} />
              <select name="eventType" className="border rounded px-3 py-2">{Object.values(LeaseEventType).map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}</select>
              <input name="eventDate" type="date" className="border rounded px-3 py-2" required />
              <textarea name="description" rows={3} placeholder="Event notes" className="border rounded px-3 py-2" />
              <button className="rounded bg-brand-navy px-4 py-2 text-white">Add Event</button>
            </form>
          </section>

          <section className="rounded-xl bg-white border shadow-sm p-4">
            <h3 className="font-semibold">Create Renewal</h3>
            <form action={createLeaseRenewalAction} className="mt-4 grid gap-3">
              <input type="hidden" name="leaseId" value={lease.id} />
              <input name="renewalStartDate" type="date" className="border rounded px-3 py-2" required />
              <input name="renewalEndDate" type="date" className="border rounded px-3 py-2" required />
              <input name="proposedRentAmount" type="number" step="0.01" placeholder="Proposed rent" className="border rounded px-3 py-2" />
              <select name="status" className="border rounded px-3 py-2">{Object.values(LeaseRenewalStatus).map((status) => <option key={status} value={status}>{status}</option>)}</select>
              <textarea name="notes" rows={3} placeholder="Renewal notes" className="border rounded px-3 py-2" />
              <button className="rounded bg-brand-navy px-4 py-2 text-white">Create Renewal</button>
            </form>
          </section>

          <section className="rounded-xl bg-white border shadow-sm p-4">
            <h3 className="font-semibold">Create Notice</h3>
            <form action={createLeaseNoticeAction} className="mt-4 grid gap-3">
              <input type="hidden" name="leaseId" value={lease.id} />
              <select name="noticeType" className="border rounded px-3 py-2">{Object.values(LeaseNoticeType).map((type) => <option key={type} value={type}>{type.replaceAll('_', ' ')}</option>)}</select>
              <input name="noticeDate" type="date" className="border rounded px-3 py-2" required />
              <textarea name="content" rows={4} placeholder="Notice content" className="border rounded px-3 py-2" required />
              <button className="rounded bg-brand-navy px-4 py-2 text-white">Create Notice</button>
            </form>
          </section>

          <section className="rounded-xl bg-white border shadow-sm p-4">
            <h3 className="font-semibold">Document Versions</h3>
            <div className="mt-4 space-y-3">
              {lease.documentVersions.length === 0 ? <p className="text-sm text-slate-500">No documents uploaded yet.</p> : lease.documentVersions.map((document) => (
                <a key={document.id} href={document.fileUrl} target="_blank" rel="noreferrer" className="block rounded-xl border bg-slate-50 p-3 hover:bg-slate-100">
                  <p className="font-medium text-slate-900">Version {document.versionNumber}</p>
                  <p className="mt-1 text-sm text-slate-500">{document.documentType || 'Lease Document'}</p>
                </a>
              ))}
            </div>
            <form action={createLeaseDocumentVersionAction} className="mt-5 grid gap-3">
              <input type="hidden" name="leaseId" value={lease.id} />
              <input name="fileUrl" placeholder="Document URL" className="border rounded px-3 py-2" required />
              <input name="fileName" placeholder="File name" className="border rounded px-3 py-2" />
              <input name="documentType" placeholder="Document type" className="border rounded px-3 py-2" />
              <button className="rounded bg-brand-navy px-4 py-2 text-white">Add Document Version</button>
            </form>
          </section>
        </aside>
      </div>
    </Shell>
  );
}
