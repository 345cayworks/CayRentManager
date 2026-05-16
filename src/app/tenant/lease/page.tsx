import Link from 'next/link';
import { UserRole } from '@prisma/client';
import { Shell } from '@/components/shell';
import { requireRole } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { getEffectiveTimezone } from '@/lib/time/effective';
import { formatDate } from '@/lib/time/format';

export const dynamic = 'force-dynamic';

function money(value: unknown) {
  return `$${Number(value ?? 0).toFixed(2)}`;
}

function statusBadge(status: string) {
  const className =
    status === 'ACTIVE'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : status === 'PENDING'
        ? 'bg-amber-50 text-amber-700 border-amber-200'
        : status === 'TERMINATED'
          ? 'bg-red-50 text-red-700 border-red-200'
          : 'bg-slate-50 text-slate-700 border-slate-200';
  return <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${className}`}>{status}</span>;
}

export default async function Page() {
  const user = await requireRole([UserRole.TENANT, UserRole.SUPERADMIN]);
  const tz = await getEffectiveTimezone();
  const tenant = await prisma.tenant.findFirst({
    where: user.role === UserRole.SUPERADMIN ? {} : { userId: user.userId },
    include: {
      leases: {
        include: {
          property: true,
          unit: true,
          renewals: { orderBy: { createdAt: 'desc' } },
          notices: { orderBy: { noticeDate: 'desc' } },
          documentVersions: { orderBy: { uploadedAt: 'desc' } },
        },
        orderBy: { startDate: 'desc' },
      },
      documents: true,
    },
  });

  if (!tenant) {
    return (
      <Shell title="Tenant Lease">
        <div className="rounded-xl bg-white border shadow-sm p-6 text-slate-600">No tenant profile is linked to this account.</div>
      </Shell>
    );
  }

  const activeLease = tenant.leases.find((lease) => lease.status === 'ACTIVE') ?? tenant.leases[0] ?? null;
  const otherLeases = tenant.leases.filter((lease) => lease.id !== activeLease?.id);
  const leaseDocuments = tenant.documents.filter(
    (doc) => doc.documentType === 'LEASE' && doc.visibility === 'TENANT_VISIBLE' && doc.status === 'ACTIVE',
  );

  return (
    <Shell title="Tenant Lease">
      <div className="space-y-6">
        <section className="rounded-xl bg-white border shadow-sm p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Active Lease</h3>
            {activeLease ? statusBadge(activeLease.status) : null}
          </div>
          {activeLease ? (
            <div className="mt-4 grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Property / Unit</p>
                <p className="font-medium">{activeLease.property.name} / {activeLease.unit.unitName}</p>
              </div>
              <div>
                <p className="text-slate-500">Term</p>
                <p className="font-medium">{formatDate(activeLease.startDate, tz)} – {formatDate(activeLease.endDate, tz)}</p>
              </div>
              <div>
                <p className="text-slate-500">Monthly Rent</p>
                <p className="font-medium">{money(activeLease.rentAmount)}</p>
              </div>
              <div>
                <p className="text-slate-500">Deposit</p>
                <p className="font-medium">{activeLease.depositAmount != null ? money(activeLease.depositAmount) : '—'}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-600 mt-2">No lease is associated with your account yet.</p>
          )}
        </section>

        {activeLease ? (
          <div className="grid lg:grid-cols-2 gap-4">
            <section className="rounded-xl bg-white border shadow-sm p-6">
              <h3 className="font-semibold">Renewals</h3>
              {activeLease.renewals.length === 0 ? (
                <p className="text-sm text-slate-600 mt-2">No renewals on file.</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm">
                  {activeLease.renewals.map((renewal) => (
                    <li key={renewal.id} className="border rounded p-3">
                      <p className="font-medium">{formatDate(renewal.renewalStartDate, tz)} – {formatDate(renewal.renewalEndDate, tz)}</p>
                      <p className="text-slate-600">Status: {renewal.status}{renewal.proposedRentAmount != null ? ` · Proposed rent ${money(renewal.proposedRentAmount)}` : ''}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl bg-white border shadow-sm p-6">
              <h3 className="font-semibold">Notices</h3>
              {activeLease.notices.length === 0 ? (
                <p className="text-sm text-slate-600 mt-2">No notices on file.</p>
              ) : (
                <ul className="mt-3 space-y-2 text-sm">
                  {activeLease.notices.map((notice) => (
                    <li key={notice.id} className="border rounded p-3">
                      <p className="font-medium">{notice.noticeType} · {formatDate(notice.noticeDate, tz)}</p>
                      <p className="text-slate-600">{notice.content}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        ) : null}

        <section className="rounded-xl bg-white border shadow-sm p-6">
          <h3 className="font-semibold">Lease Documents</h3>
          {leaseDocuments.length === 0 && (!activeLease || activeLease.documentVersions.length === 0) ? (
            <p className="text-sm text-slate-600 mt-2">No lease documents are available yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {leaseDocuments.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between border rounded p-3">
                  <span>{doc.fileName}</span>
                  <Link className="text-brand-navy underline" href={`/api/documents/${doc.id}/download`} target="_blank">Download</Link>
                </li>
              ))}
              {activeLease?.documentVersions.map((version) => (
                <li key={version.id} className="border rounded p-3 text-slate-600">
                  {version.fileName ?? `Lease document v${version.versionNumber}`} · uploaded {formatDate(version.uploadedAt, tz)}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl bg-white border shadow-sm overflow-hidden">
          <div className="p-4 border-b">
            <h3 className="font-semibold">Lease History</h3>
          </div>
          {otherLeases.length === 0 ? (
            <p className="p-4 text-slate-600">No previous leases.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left p-3">Property/Unit</th>
                    <th className="text-left p-3">Term</th>
                    <th className="text-right p-3">Rent</th>
                    <th className="text-right p-3">Deposit</th>
                    <th className="text-left p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {otherLeases.map((lease) => (
                    <tr key={lease.id}>
                      <td className="p-3">{lease.property.name} / {lease.unit.unitName}</td>
                      <td className="p-3">{formatDate(lease.startDate, tz)} – {formatDate(lease.endDate, tz)}</td>
                      <td className="p-3 text-right">{money(lease.rentAmount)}</td>
                      <td className="p-3 text-right">{lease.depositAmount != null ? money(lease.depositAmount) : '—'}</td>
                      <td className="p-3">{statusBadge(lease.status)}</td>
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
