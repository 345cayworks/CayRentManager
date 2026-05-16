import { RecordStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { requireSuperadmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import {
  archiveGlobalVendorAction,
  createGlobalVendorAction,
  reactivateGlobalVendorAction,
  setGlobalVendorFlagsAction,
  updateGlobalVendorAction,
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

export default async function Page() {
  await requireSuperadmin();

  const vendors = await prisma.globalVendor.findMany({
    orderBy: [{ featured: 'desc' }, { sponsored: 'desc' }, { name: 'asc' }],
  });

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
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <Badge label="Approved" on={vendor.approvedStatus} />
                        <Badge label="Featured" on={vendor.featured} />
                        <Badge label="Sponsored" on={vendor.sponsored} />
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
