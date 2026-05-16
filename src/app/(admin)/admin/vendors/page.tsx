import { RecordStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { requireSuperadmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { getEffectiveTimezone } from '@/lib/time/effective';
import { formatDate } from '@/lib/time/format';
import {
  BILLING_STATUSES,
  computeVendorRevenue,
  summarizeLeads,
} from '@/lib/vendors/monetization';
import {
  archiveGlobalVendorAction,
  createGlobalVendorAction,
  reactivateGlobalVendorAction,
  setGlobalVendorFlagsAction,
  updateGlobalVendorAction,
  updateGlobalVendorBillingAction,
} from '@/server/global-vendor-actions';

export const dynamic = 'force-dynamic';

function formatFee(amount: number | null) {
  if (amount === null) return '—';
  try {
    return new Intl.NumberFormat('en-KY', {
      style: 'currency',
      currency: 'KYD',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `KYD ${amount.toFixed(2)}`;
  }
}

const inputClass =
  'mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-900';
const labelClass =
  'text-[11px] font-medium uppercase tracking-wide text-slate-500';

function Badge({ label, on }: { label: string; on: boolean }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
        on
          ? 'bg-emerald-50 text-emerald-700 ring-emerald-100'
          : 'bg-slate-100 text-slate-500 ring-slate-200'
      }`}
    >
      {label}
    </span>
  );
}

const BILLING_BADGE: Record<string, string> = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  TRIAL: 'bg-sky-50 text-sky-700 ring-sky-100',
  PAST_DUE: 'bg-amber-50 text-amber-700 ring-amber-100',
  CANCELLED: 'bg-slate-100 text-slate-600 ring-slate-200',
  NONE: 'bg-slate-50 text-slate-400 ring-slate-100',
};

function BillingBadge({ status }: { status: string }) {
  const cls = BILLING_BADGE[status] ?? BILLING_BADGE.NONE;
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${cls}`}
    >
      {status}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function toDateInputValue(value: Date | null): string {
  if (!value) return '';
  const time = value.getTime();
  if (Number.isNaN(time)) return '';
  return value.toISOString().slice(0, 10);
}

export default async function Page() {
  await requireSuperadmin();

  const tz = await getEffectiveTimezone();

  const vendors = await prisma.globalVendor.findMany({
    orderBy: [{ featured: 'desc' }, { sponsored: 'desc' }, { name: 'asc' }],
  });

  const leadRows = await prisma.globalVendorLead.findMany({
    select: { globalVendorId: true, type: true },
  });
  const leadSummary = summarizeLeads(leadRows);

  const revenue = computeVendorRevenue(
    vendors.map((v) => ({
      monthlyFee: v.monthlyFee === null ? null : Number(v.monthlyFee),
      billingStatus: v.billingStatus,
      featured: v.featured,
      sponsored: v.sponsored,
      status: v.status,
    })),
  );

  const active = vendors.filter((v) => v.status === RecordStatus.ACTIVE);
  const archived = vendors.filter((v) => v.status !== RecordStatus.ACTIVE);

  return (
    <Shell title="Global Vendors">
      <div className="space-y-5">
        <section className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-950">Create global vendor</h2>
          <p className="text-xs text-slate-500">
            Platform-level vendor listings managed by superadmins. These are not owned by any
            landlord.
          </p>
          <form action={createGlobalVendorAction} className="mt-3 grid gap-3 md:grid-cols-4">
            <label className={`${labelClass} md:col-span-2`}>
              Name
              <input name="name" required className={inputClass} placeholder="Acme Plumbing Ltd." />
            </label>
            <label className={labelClass}>
              Email
              <input name="email" type="email" className={inputClass} />
            </label>
            <label className={labelClass}>
              Phone
              <input name="phone" className={inputClass} />
            </label>
            <label className={labelClass}>
              Website
              <input name="website" className={inputClass} placeholder="https://" />
            </label>
            <label className={labelClass}>
              Specialty
              <input name="specialty" className={inputClass} placeholder="Plumbing" />
            </label>
            <label className={`${labelClass} md:col-span-2`}>
              Service areas
              <input
                name="serviceAreas"
                className={inputClass}
                placeholder="George Town, West Bay"
              />
              <span className="mt-1 block text-[10px] font-normal normal-case text-slate-400">
                comma-separated areas, e.g. George Town, West Bay
              </span>
            </label>
            <label className={`${labelClass} md:col-span-3`}>
              Description
              <textarea
                name="description"
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
              />
            </label>
            <label className={labelClass}>
              Monthly fee (KYD)
              <input
                name="monthlyFee"
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
              />
            </label>
            <label className={`${labelClass} md:col-span-2`}>
              Logo URL
              <input name="logoUrl" className={inputClass} placeholder="https://" />
            </label>
            <div className="flex items-end gap-4 md:col-span-2">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <input type="checkbox" name="approvedStatus" /> Approved
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <input type="checkbox" name="featured" /> Featured
              </label>
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <input type="checkbox" name="sponsored" /> Sponsored
              </label>
            </div>
            <div className="flex items-end justify-end md:col-span-4">
              <button className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800">
                Create vendor
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-950">Monetization</h2>
          <p className="text-xs text-slate-500">
            Monthly recurring revenue counts ACTIVE listings billed ACTIVE or PAST_DUE.
            Archived listings and TRIAL/NONE/CANCELLED are excluded from MRR.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="MRR" value={formatFee(revenue.mrr)} />
            <Stat label="Billable" value={String(revenue.billable)} />
            <Stat label="Past due" value={String(revenue.atRisk)} />
            <Stat label="Trialing" value={String(revenue.trialing)} />
            <Stat label="Sponsored" value={String(revenue.sponsoredCount)} />
            <Stat label="Featured" value={String(revenue.featuredCount)} />
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-950">Active vendors</h3>
            <p className="text-[11px] text-slate-500">
              Edit details, toggle approve/feature/sponsor flags, or archive.
            </p>
          </div>
          {active.length === 0 ? (
            <p className="p-4 text-sm text-slate-600">No active global vendors yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {active.map((vendor) => {
                const fee = vendor.monthlyFee === null ? null : Number(vendor.monthlyFee);
                const leads = leadSummary[vendor.id] ?? {
                  total: 0,
                  addToList: 0,
                  inquiry: 0,
                };
                return (
                  <li key={vendor.id} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{vendor.name}</p>
                        <p className="text-xs text-slate-600">
                          {vendor.specialty ?? 'No specialty'}
                          {vendor.serviceAreas ? ` · ${vendor.serviceAreas}` : ''}
                        </p>
                        <p className="text-xs text-slate-500">
                          {[vendor.email, vendor.phone, vendor.website]
                            .filter(Boolean)
                            .join(' · ') || 'No contact details'}
                        </p>
                        <p className="text-xs text-slate-500">
                          Monthly fee: {formatFee(fee)}
                        </p>
                        <p className="text-xs text-slate-500">
                          Leads: {leads.total} · Added {leads.addToList} · Inquiries{' '}
                          {leads.inquiry}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge label="Approved" on={vendor.approvedStatus} />
                        <Badge label="Featured" on={vendor.featured} />
                        <Badge label="Sponsored" on={vendor.sponsored} />
                        <BillingBadge status={vendor.billingStatus} />
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-4">
                      <form action={setGlobalVendorFlagsAction} className="flex items-center gap-3">
                        <input type="hidden" name="vendorId" value={vendor.id} />
                        <label className="flex items-center gap-1.5 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            name="approvedStatus"
                            defaultChecked={vendor.approvedStatus}
                          />{' '}
                          Approved
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            name="featured"
                            defaultChecked={vendor.featured}
                          />{' '}
                          Featured
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            name="sponsored"
                            defaultChecked={vendor.sponsored}
                          />{' '}
                          Sponsored
                        </label>
                        <button className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
                          Update flags
                        </button>
                      </form>

                      <form action={archiveGlobalVendorAction}>
                        <input type="hidden" name="vendorId" value={vendor.id} />
                        <button className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
                          Archive
                        </button>
                      </form>
                    </div>

                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs font-medium text-slate-600">
                        Edit details
                      </summary>
                      <form
                        action={updateGlobalVendorAction}
                        className="mt-3 grid gap-3 md:grid-cols-4"
                      >
                        <input type="hidden" name="vendorId" value={vendor.id} />
                        <label className={`${labelClass} md:col-span-2`}>
                          Name
                          <input
                            name="name"
                            required
                            defaultValue={vendor.name}
                            className={inputClass}
                          />
                        </label>
                        <label className={labelClass}>
                          Email
                          <input
                            name="email"
                            type="email"
                            defaultValue={vendor.email ?? ''}
                            className={inputClass}
                          />
                        </label>
                        <label className={labelClass}>
                          Phone
                          <input
                            name="phone"
                            defaultValue={vendor.phone ?? ''}
                            className={inputClass}
                          />
                        </label>
                        <label className={labelClass}>
                          Website
                          <input
                            name="website"
                            defaultValue={vendor.website ?? ''}
                            className={inputClass}
                          />
                        </label>
                        <label className={labelClass}>
                          Specialty
                          <input
                            name="specialty"
                            defaultValue={vendor.specialty ?? ''}
                            className={inputClass}
                          />
                        </label>
                        <label className={`${labelClass} md:col-span-2`}>
                          Service areas
                          <input
                            name="serviceAreas"
                            defaultValue={vendor.serviceAreas ?? ''}
                            className={inputClass}
                          />
                        </label>
                        <label className={`${labelClass} md:col-span-3`}>
                          Description
                          <textarea
                            name="description"
                            rows={2}
                            defaultValue={vendor.description ?? ''}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                          />
                        </label>
                        <label className={labelClass}>
                          Monthly fee (KYD)
                          <input
                            name="monthlyFee"
                            type="number"
                            step="0.01"
                            min="0"
                            defaultValue={fee ?? ''}
                            className={inputClass}
                          />
                        </label>
                        <label className={`${labelClass} md:col-span-2`}>
                          Logo URL
                          <input
                            name="logoUrl"
                            defaultValue={vendor.logoUrl ?? ''}
                            className={inputClass}
                          />
                        </label>
                        <div className="flex items-end gap-4 md:col-span-2">
                          <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                            <input
                              type="checkbox"
                              name="approvedStatus"
                              defaultChecked={vendor.approvedStatus}
                            />{' '}
                            Approved
                          </label>
                          <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                            <input
                              type="checkbox"
                              name="featured"
                              defaultChecked={vendor.featured}
                            />{' '}
                            Featured
                          </label>
                          <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                            <input
                              type="checkbox"
                              name="sponsored"
                              defaultChecked={vendor.sponsored}
                            />{' '}
                            Sponsored
                          </label>
                        </div>
                        <div className="flex items-end justify-end md:col-span-4">
                          <button className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800">
                            Save changes
                          </button>
                        </div>
                      </form>
                    </details>

                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-medium text-slate-600">
                        Billing
                      </summary>
                      <form
                        action={updateGlobalVendorBillingAction}
                        className="mt-3 grid gap-3 md:grid-cols-4"
                      >
                        <input type="hidden" name="vendorId" value={vendor.id} />
                        <label className={labelClass}>
                          Billing status
                          <select
                            name="billingStatus"
                            defaultValue={vendor.billingStatus}
                            className={inputClass}
                          >
                            {BILLING_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className={labelClass}>
                          Monthly fee (KYD)
                          <input
                            name="monthlyFee"
                            type="number"
                            step="0.01"
                            min="0"
                            defaultValue={fee ?? ''}
                            className={inputClass}
                          />
                        </label>
                        <label className={labelClass}>
                          Paid through
                          <input
                            name="paidThrough"
                            type="date"
                            defaultValue={toDateInputValue(vendor.paidThrough)}
                            className={inputClass}
                          />
                          <span className="mt-1 block text-[10px] font-normal normal-case text-slate-400">
                            {vendor.paidThrough
                              ? `Currently ${formatDate(vendor.paidThrough, tz)}`
                              : 'Not set'}
                          </span>
                        </label>
                        <label className={`${labelClass} md:col-span-4`}>
                          Billing notes
                          <textarea
                            name="billingNotes"
                            rows={2}
                            maxLength={1000}
                            defaultValue={vendor.billingNotes ?? ''}
                            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900"
                          />
                        </label>
                        <div className="flex items-end justify-end md:col-span-4">
                          <button className="h-9 rounded-lg bg-slate-900 px-4 text-xs font-semibold text-white hover:bg-slate-800">
                            Save billing
                          </button>
                        </div>
                      </form>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-100 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-950">Archived vendors</h3>
          </div>
          {archived.length === 0 ? (
            <p className="p-4 text-sm text-slate-600">No archived global vendors.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {archived.map((vendor) => (
                <li
                  key={vendor.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{vendor.name}</p>
                    <p className="text-xs text-slate-500">
                      {vendor.specialty ?? 'No specialty'}
                      {vendor.serviceAreas ? ` · ${vendor.serviceAreas}` : ''}
                    </p>
                  </div>
                  <form action={reactivateGlobalVendorAction}>
                    <input type="hidden" name="vendorId" value={vendor.id} />
                    <button className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50">
                      Reactivate
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Shell>
  );
}
