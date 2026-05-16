import Link from 'next/link';
import { RecordStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { OnboardingWizardSidebar } from '@/components/onboarding/wizard-sidebar';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { getOnboardingState } from '@/lib/onboarding/state';
import { createUnitGuidedAction } from '@/server/actions';

export const dynamic = 'force-dynamic';

type SearchParams = { propertyId?: string };

export default async function NewUnitPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const { landlordId } = await getCurrentLandlordWorkspace();
  const [state, properties] = await Promise.all([
    getOnboardingState(landlordId),
    prisma.property.findMany({
      where: { landlordId, status: RecordStatus.ACTIVE },
      orderBy: { name: 'asc' },
    }),
  ]);

  const preselectedPropertyId = searchParams?.propertyId ?? '';

  return (
    <Shell title="Add a unit">
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-600">
              Step 3 of 5
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Create a unit</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Units are the rentable spaces inside each property. Add at least one before you
              invite tenants.
            </p>
          </section>

          {properties.length === 0 ? (
            <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
              <p className="font-semibold">Add a property first</p>
              <p className="mt-2">
                Units must belong to a property. Create your first property before adding units.
              </p>
              <Link
                href="/properties/new"
                className="mt-3 inline-block rounded-2xl bg-amber-900 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800"
              >
                Add a property
              </Link>
            </section>
          ) : (
            <form
              action={createUnitGuidedAction}
              encType="multipart/form-data"
              className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm md:col-span-2">
                  <span className="font-medium text-slate-700">Property *</span>
                  <select
                    required
                    name="propertyId"
                    defaultValue={preselectedPropertyId}
                    className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                  >
                    <option value="">Select a property</option>
                    {properties.map((property) => (
                      <option key={property.id} value={property.id}>
                        {property.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-sm md:col-span-2">
                  <span className="font-medium text-slate-700">Unit name/number *</span>
                  <input
                    required
                    name="unitName"
                    placeholder="e.g. Apt 2B"
                    className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-slate-700">Bedrooms</span>
                  <input
                    name="bedrooms"
                    type="number"
                    min="0"
                    className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-slate-700">Bathrooms</span>
                  <input
                    name="bathrooms"
                    type="number"
                    step="0.5"
                    min="0"
                    className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-slate-700">Square feet</span>
                  <input
                    name="squareFeet"
                    type="number"
                    min="0"
                    className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-slate-700">Rent amount *</span>
                  <input
                    required
                    name="rentAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-slate-700">Deposit amount</span>
                  <input
                    name="depositAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="block text-sm md:col-span-2">
                  <span className="font-medium text-slate-700">Photos</span>
                  <input
                    type="file"
                    name="photos"
                    accept="image/png,image/jpeg,image/webp"
                    multiple
                    className="mt-1 block w-full text-sm"
                  />
                  <span className="mt-1 block text-xs text-slate-500">
                    Optional — you can also add photos later from the detail page.
                  </span>
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
                <Link
                  href="/onboarding"
                  className="text-sm font-semibold text-slate-600 hover:text-slate-900"
                >
                  Cancel
                </Link>
                <div className="flex flex-wrap gap-3">
                  <button
                    name="nextStep"
                    value="onboarding"
                    className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Save & return to onboarding
                  </button>
                  <button
                    name="nextStep"
                    value="tenants"
                    className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                  >
                    Save & invite tenants
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
        <OnboardingWizardSidebar state={state} activeKey="unit" />
      </div>
    </Shell>
  );
}
