import Link from 'next/link';
import { differenceInDays } from 'date-fns';
import { LeaseEventType, LeaseNoticeType, LeaseRenewalStatus } from '@prisma/client';
import { notFound } from 'next/navigation';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import {
  createLeaseDocumentVersionAction,
  createLeaseEventAction,
  createLeaseNoticeAction,
  createLeaseRenewalAction,
} from '@/server/lease-lifecycle-actions';

export const dynamic = 'force-dynamic';

function money(value: unknown) {
  if (value === null || value === undefined) return '—';
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

export default async function LeaseDetailPage({ params }: { params: { leaseId: string } }) {
  const { landlordId } = await getCurrentLandlordWorkspace();

  const lease = await prisma.lease.findFirst({
    where: {
      id: params.leaseId,
      landlordId,
    },
    include: {
      tenant: true,
      property: true,
      unit: true,
      payments: {
        orderBy: {
          dueDate: 'desc',
        },
        take: 8,
      },
      maintenanceRequests: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 8,
      },
      events: {
        orderBy: {
          eventDate: 'desc',
        },
      },
      renewals: {
        orderBy: {
          createdAt: 'desc',
        },
      },
      notices: {
        orderBy: {
          noticeDate: 'desc',
        },
      },
      documentVersions: {
        orderBy: {
          versionNumber: 'desc',
        },
      },
    },
  });

  if (!lease) notFound();

  const daysRemaining = differenceInDays(lease.endDate, new Date());

  return (
    <Shell title="Lease Operations Detail">
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <Link href="/leases" className="text-sm text-slate-500 hover:underline">
            ← Back to lease operations
          </Link>

          <h2 className="mt-2 text-3xl font-semibold">
            {lease.tenant.fullName}
          </h2>

          <p className="mt-1 text-slate-600">
            {lease.property.name} / {lease.unit.unitName}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {daysRemaining <= 14
            ? badge(`${daysRemaining} days remaining`, 'red')
            : badge(`${daysRemaining} days remaining`, 'amber')}

          {badge(lease.status, lease.status === 'ACTIVE' ? 'emerald' : 'slate')}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5 mb-8">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Monthly Rent</p>
          <p className="mt-2 text-3xl font-semibold">{money(lease.rentAmount)}</p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Deposit</p>
          <p className="mt-2 text-3xl font-semibold">{money(lease.depositAmount)}</p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Start Date</p>
          <p className="mt-2 text-lg font-semibold">{lease.startDate.toLocaleDateString()}</p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">End Date</p>
          <p className="mt-2 text-lg font-semibold">{lease.endDate.toLocaleDateString()}</p>
        </div>

        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Lifecycle Events</p>
          <p className="mt-2 text-3xl font-semibold">{lease.events.length}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <section className="rounded-2xl border bg-white shadow-sm">
            <div className="border-b px-6 py-4">
              <h3 className="text-lg font-semibold">Lease Timeline</h3>
            </div>

            <div className="divide-y">
              {lease.events.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">
                  No lifecycle events yet.
                </div>
              ) : (
                lease.events.map((event) => (
                  <div key={event.id} className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">
                          {event.eventType.replaceAll('_', ' ')}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {event.eventDate.toLocaleDateString()}
                        </p>
                      </div>

                      {event.completedAt
                        ? badge('Completed', 'emerald')
                        : badge('Pending', 'amber')}
                    </div>

                    {event.description ? (
                      <p className="mt-3 text-sm text-slate-700 whitespace-pre-line">
                        {event.description}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl border bg-white shadow-sm">
            <div className="border-b px-6 py-4">
              <h3 className="text-lg font-semibold">Renewal Workflow</h3>
            </div>

            <div className="divide-y">
              {lease.renewals.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">
                  No renewals yet.
                </div>
              ) : (
                lease.renewals.map((renewal) => (
                  <div key={renewal.id} className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">
                          {renewal.renewalStartDate.toLocaleDateString()} → {renewal.renewalEndDate.toLocaleDateString()}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          Proposed Rent: {money(renewal.proposedRentAmount)}
                        </p>
                      </div>

                      {badge(renewal.status, renewal.status === 'COMPLETED' ? 'emerald' : 'cyan')}
                    </div>

                    {renewal.notes ? (
                      <p className="mt-3 text-sm text-slate-700 whitespace-pre-line">
                        {renewal.notes}
                      </p>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl border bg-white shadow-sm">
            <div className="border-b px-6 py-4">
              <h3 className="text-lg font-semibold">Notices</h3>
            </div>

            <div className="divide-y">
              {lease.notices.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">
                  No notices yet.
                </div>
              ) : (
                lease.notices.map((notice) => (
                  <div key={notice.id} className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">
                          {notice.noticeType.replaceAll('_', ' ')}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {notice.noticeDate.toLocaleDateString()}
                        </p>
                      </div>

                      {notice.sentAt
                        ? badge('Sent', 'emerald')
                        : badge('Draft', 'amber')}
                    </div>

                    <p className="mt-3 text-sm text-slate-700 whitespace-pre-line">
                      {notice.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Create Lifecycle Event</h3>

            <form action={createLeaseEventAction} className="mt-4 grid gap-3">
              <input type="hidden" name="leaseId" value={lease.id} />

              <select name="eventType" className="border rounded px-3 py-2">
                {Object.values(LeaseEventType).map((type) => (
                  <option key={type} value={type}>
                    {type.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>

              <input name="eventDate" type="date" className="border rounded px-3 py-2" required />

              <textarea name="description" rows={4} placeholder="Event notes" className="border rounded px-3 py-2" />

              <button className="rounded bg-brand-navy px-4 py-2 text-white">
                Add Event
              </button>
            </form>
          </section>

          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Create Renewal</h3>

            <form action={createLeaseRenewalAction} className="mt-4 grid gap-3">
              <input type="hidden" name="leaseId" value={lease.id} />

              <input name="renewalStartDate" type="date" className="border rounded px-3 py-2" required />
              <input name="renewalEndDate" type="date" className="border rounded px-3 py-2" required />
              <input name="proposedRentAmount" type="number" step="0.01" placeholder="Proposed rent" className="border rounded px-3 py-2" />

              <select name="status" className="border rounded px-3 py-2">
                {Object.values(LeaseRenewalStatus).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>

              <textarea name="notes" rows={4} placeholder="Renewal notes" className="border rounded px-3 py-2" />

              <button className="rounded bg-brand-navy px-4 py-2 text-white">
                Create Renewal
              </button>
            </form>
          </section>

          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Create Notice</h3>

            <form action={createLeaseNoticeAction} className="mt-4 grid gap-3">
              <input type="hidden" name="leaseId" value={lease.id} />

              <select name="noticeType" className="border rounded px-3 py-2">
                {Object.values(LeaseNoticeType).map((type) => (
                  <option key={type} value={type}>
                    {type.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>

              <input name="noticeDate" type="date" className="border rounded px-3 py-2" required />

              <textarea name="content" rows={5} placeholder="Notice content" className="border rounded px-3 py-2" required />

              <button className="rounded bg-brand-navy px-4 py-2 text-white">
                Create Notice
              </button>
            </form>
          </section>

          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold">Document Versions</h3>

            <div className="mt-4 space-y-3">
              {lease.documentVersions.length === 0 ? (
                <p className="text-sm text-slate-500">No documents uploaded yet.</p>
              ) : (
                lease.documentVersions.map((document) => (
                  <a
                    key={document.id}
                    href={document.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-xl border bg-slate-50 p-4 hover:bg-slate-100"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">
                          Version {document.versionNumber}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {document.documentType || 'Lease Document'}
                        </p>
                      </div>

                      {badge('Document', 'slate')}
                    </div>
                  </a>
                ))
              )}
            </div>

            <form action={createLeaseDocumentVersionAction} className="mt-5 grid gap-3">
              <input type="hidden" name="leaseId" value={lease.id} />

              <input name="fileUrl" placeholder="Document URL" className="border rounded px-3 py-2" required />
              <input name="fileName" placeholder="File name" className="border rounded px-3 py-2" />
              <input name="documentType" placeholder="Document type" className="border rounded px-3 py-2" />

              <button className="rounded bg-brand-navy px-4 py-2 text-white">
                Upload Version
              </button>
            </form>
          </section>
        </div>
      </div>
    </Shell>
  );
}
