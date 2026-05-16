import Link from 'next/link';
import { Shell } from '@/components/shell';
import { OnboardingWizardSidebar } from '@/components/onboarding/wizard-sidebar';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { getOnboardingState } from '@/lib/onboarding/state';
import { createPropertyGuidedAction } from '@/server/actions';

export const dynamic = 'force-dynamic';

const propertyTypes = ['Residential', 'Commercial', 'Mixed-Use', 'Vacation Rental'];

export default async function NewPropertyPage() {
  const { landlordId } = await getCurrentLandlordWorkspace();
  const state = await getOnboardingState(landlordId);

  return (
    <Shell title="Add a property">
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-600">
              Step 2 of 5
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              Add your first property
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              A property is the top-level container for your rentable units. After saving you
              can continue straight into adding units or pop back to the onboarding overview.
            </p>
          </section>

          <form
            action={createPropertyGuidedAction}
            encType="multipart/form-data"
            className="space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm md:col-span-2">
                <span className="font-medium text-slate-700">Property name *</span>
                <input
                  required
                  name="name"
                  placeholder="e.g. Seaside Villas"
                  className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Property type</span>
                <select
                  name="propertyType"
                  defaultValue="Residential"
                  className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                >
                  {propertyTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Country</span>
                <input
                  name="country"
                  defaultValue="KY"
                  className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm md:col-span-2">
                <span className="font-medium text-slate-700">Address *</span>
                <input
                  required
                  name="address"
                  className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">City *</span>
                <input
                  required
                  name="city"
                  className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Parish/State *</span>
                <input
                  required
                  name="state"
                  className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Purchase price</span>
                <input
                  name="purchasePrice"
                  type="number"
                  step="0.01"
                  className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Estimated value</span>
                <input
                  name="estimatedValue"
                  type="number"
                  step="0.01"
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
                  value="units"
                  className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Save & add units
                </button>
              </div>
            </div>
          </form>
        </div>
        <OnboardingWizardSidebar state={state} activeKey="property" />
      </div>
    </Shell>
  );
}
