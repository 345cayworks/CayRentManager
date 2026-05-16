import { Shell } from '@/components/shell';
import { requireSuperadmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { getEffectiveTimezone } from '@/lib/time/effective';
import { formatDate } from '@/lib/time/format';
import {
  approveVendorPortalRequestAction,
  rejectVendorPortalRequestAction,
  superadminEnableVendorPortalAction,
} from '@/server/actions';

export const dynamic = 'force-dynamic';

const inputClass =
  'mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900';
const labelClass =
  'text-[11px] font-medium uppercase tracking-wide text-slate-500';

const STATUS_BADGE: Record<string, string> = {
  APPROVED: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  REJECTED: 'bg-red-50 text-red-700 ring-red-100',
  CANCELLED: 'bg-slate-100 text-slate-600 ring-slate-200',
  PENDING: 'bg-amber-50 text-amber-700 ring-amber-100',
};

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_BADGE[status] ?? STATUS_BADGE.PENDING;
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${cls}`}
    >
      {status}
    </span>
  );
}

export default async function Page() {
  await requireSuperadmin();

  const tz = await getEffectiveTimezone();

  const [pending, decided] = await Promise.all([
    prisma.vendorPortalRequest.findMany({
      where: { status: 'PENDING' },
      include: {
        vendor: { select: { id: true, name: true } },
        landlord: { select: { id: true, displayName: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.vendorPortalRequest.findMany({
      where: { status: { not: 'PENDING' } },
      include: {
        vendor: { select: { id: true, name: true } },
        landlord: { select: { id: true, displayName: true } },
      },
      orderBy: { reviewedAt: 'desc' },
      take: 20,
    }),
  ]);

  return (
    <Shell title="Vendor Portal Requests">
      <div className="space-y-5">
        <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-950">Pending requests</h3>
            <p className="text-[11px] text-slate-500">
              Landlords request portal access for vendors they manage. Approving links or
              creates the vendor login.
            </p>
          </div>
          {pending.length === 0 ? (
            <p className="p-4 text-sm text-slate-600">No pending portal requests.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {pending.map((req) => (
                <li key={req.id} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">
                        {req.vendor.name}
                      </p>
                      <p className="text-xs text-slate-600">
                        Workspace: {req.landlord.displayName}
                      </p>
                      <p className="text-xs text-slate-500">
                        Requested email: {req.requestedEmail}
                      </p>
                      {req.note ? (
                        <p className="text-xs text-slate-500">Note: {req.note}</p>
                      ) : null}
                      <p className="text-xs text-slate-500">
                        Requested {formatDate(req.createdAt, tz)}
                      </p>
                    </div>
                    <StatusBadge status={req.status} />
                  </div>

                  <div className="mt-3 flex flex-wrap items-start gap-4">
                    <form
                      action={approveVendorPortalRequestAction}
                      className="flex flex-wrap items-end gap-2"
                    >
                      <input type="hidden" name="requestId" value={req.id} />
                      <label className={labelClass}>
                        Decision note (optional)
                        <input name="decisionNote" className={inputClass} />
                      </label>
                      <button className="h-9 rounded-lg bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-500">
                        Approve
                      </button>
                    </form>

                    <form
                      action={rejectVendorPortalRequestAction}
                      className="flex flex-wrap items-end gap-2"
                    >
                      <input type="hidden" name="requestId" value={req.id} />
                      <label className={labelClass}>
                        Decision note (optional)
                        <input name="decisionNote" className={inputClass} />
                      </label>
                      <button className="h-9 rounded-lg border border-red-200 px-4 text-xs font-semibold text-red-700 hover:bg-red-50">
                        Reject
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-950">Direct enable</h2>
          <p className="text-xs text-slate-500">
            Enable a vendor portal directly by vendor ID, bypassing the landlord request
            flow. Use when onboarding a vendor on a landlord&apos;s behalf.
          </p>
          <form
            action={superadminEnableVendorPortalAction}
            className="mt-3 grid gap-3 md:grid-cols-3"
          >
            <label className={`${labelClass} md:col-span-1`}>
              Vendor ID
              <input name="vendorId" required className={inputClass} />
            </label>
            <label className={`${labelClass} md:col-span-1`}>
              Portal email
              <input name="portalEmail" type="email" required className={inputClass} />
            </label>
            <div className="flex items-end justify-end md:col-span-1">
              <button className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800">
                Enable portal
              </button>
            </div>
          </form>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-950">Recently decided</h3>
            <p className="text-[11px] text-slate-500">Last 20 resolved requests.</p>
          </div>
          {decided.length === 0 ? (
            <p className="p-4 text-sm text-slate-600">No decided requests yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {decided.map((req) => (
                <li
                  key={req.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {req.vendor.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {req.landlord.displayName} · {req.requestedEmail}
                    </p>
                    {req.decisionNote ? (
                      <p className="text-xs text-slate-500">Note: {req.decisionNote}</p>
                    ) : null}
                    <p className="text-xs text-slate-500">
                      {req.reviewedAt
                        ? `Reviewed ${formatDate(req.reviewedAt, tz)}`
                        : 'Not reviewed'}
                    </p>
                  </div>
                  <StatusBadge status={req.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Shell>
  );
}
