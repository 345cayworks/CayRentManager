import Link from 'next/link';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { updateCompanyProfileAction } from '@/server/actions';

export const dynamic = 'force-dynamic';

const currencyOptions = ['KYD', 'USD', 'CAD', 'GBP', 'EUR'];

function formatDate(value: Date | null | undefined) {
  if (!value) return null;
  try {
    return new Date(value).toLocaleString();
  } catch {
    return null;
  }
}

export default async function CompanyProfilePage() {
  const { landlordId } = await getCurrentLandlordWorkspace();
  const profile = await prisma.landlordProfile.findUnique({ where: { id: landlordId } });

  if (!profile) {
    return (
      <Shell title="Company profile">
        <p className="text-slate-600">Workspace profile not found.</p>
      </Shell>
    );
  }

  const savedAt = formatDate(profile.companyProfileCompletedAt);

  return (
    <Shell title="Company profile">
      <div className="space-y-6">
        <section className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-600">
              Step 1 of 5
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">
              Complete your company profile
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Add the contact, address, branding and operational defaults we use across the
              platform. Only the company name and display name are required — everything else
              can be filled in over time.
            </p>
          </div>
          <Link
            href="/onboarding"
            className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back to onboarding
          </Link>
        </section>

        {savedAt ? (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Company profile last saved {savedAt}.
          </p>
        ) : null}

        <form
          action={updateCompanyProfileAction}
          className="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold text-slate-900">Business identity</legend>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Company name *</span>
                <input
                  required
                  name="companyName"
                  defaultValue={profile.companyName}
                  className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Display name *</span>
                <input
                  required
                  name="displayName"
                  defaultValue={profile.displayName}
                  className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm md:col-span-2">
                <span className="font-medium text-slate-700">Tagline</span>
                <input
                  name="tagline"
                  defaultValue={profile.tagline ?? ''}
                  placeholder="Short marketing tagline"
                  className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm md:col-span-2">
                <span className="font-medium text-slate-700">Logo URL</span>
                <input
                  name="logoUrl"
                  type="url"
                  defaultValue={profile.logoUrl ?? ''}
                  placeholder="https://example.com/logo.png"
                  className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                />
              </label>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold text-slate-900">Contact</legend>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Email</span>
                <input
                  name="email"
                  type="email"
                  defaultValue={profile.email ?? ''}
                  className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Phone</span>
                <input
                  name="phone"
                  defaultValue={profile.phone ?? ''}
                  className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm md:col-span-2">
                <span className="font-medium text-slate-700">Website</span>
                <input
                  name="website"
                  type="url"
                  defaultValue={profile.website ?? ''}
                  className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                />
              </label>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold text-slate-900">Address</legend>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm md:col-span-2">
                <span className="font-medium text-slate-700">Address line 1</span>
                <input
                  name="addressLine1"
                  defaultValue={profile.addressLine1 ?? ''}
                  className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm md:col-span-2">
                <span className="font-medium text-slate-700">Address line 2</span>
                <input
                  name="addressLine2"
                  defaultValue={profile.addressLine2 ?? ''}
                  className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">City</span>
                <input
                  name="city"
                  defaultValue={profile.city ?? ''}
                  className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Country</span>
                <input
                  name="country"
                  defaultValue={profile.country ?? 'KY'}
                  className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                />
              </label>
            </div>
          </fieldset>

          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold text-slate-900">Operations</legend>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Currency</span>
                <select
                  name="currency"
                  defaultValue={profile.currency ?? 'KYD'}
                  className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                >
                  {currencyOptions.map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700">Timezone</span>
                <input
                  name="timezone"
                  defaultValue={profile.timezone ?? 'America/Cayman'}
                  className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                />
              </label>
            </div>
          </fieldset>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <Link
              href="/onboarding"
              className="text-sm font-semibold text-slate-600 hover:text-slate-900"
            >
              Back to onboarding
            </Link>
            <button className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">
              Mark complete and continue
            </button>
          </div>
        </form>
      </div>
    </Shell>
  );
}
