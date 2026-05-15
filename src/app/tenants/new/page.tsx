import Link from 'next/link';
import { RecordStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { OnboardingWizardSidebar } from '@/components/onboarding/wizard-sidebar';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { getOnboardingState } from '@/lib/onboarding/state';
import { createTenantGuidedAction } from '@/server/actions';

export const dynamic = 'force-dynamic';

export default async function NewTenantPage() {
  const { landlordId } = await getCurrentLandlordWorkspace();
  const [state, units] = await Promise.all([
    getOnboardingState(landlordId),
    prisma.unit.findMany({
      where: { landlordId, status: RecordStatus.ACTIVE },
      include: { property: true },
      orderBy: { unitName: 'asc' },
    }),
  ]);

  return (
    <Shell title="Add a tenant">
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-600">
              Step 4 of 5
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Add or invite a tenant</h2>
            <p className="mt-2 max-w-2xl text-sm text-slate-600">
              Send a self-service invite so the tenant signs up themselves, or create a tenant
              record manually if you are entering existing residents.
            </p>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Invite a tenant</h3>
            <p className="mt-1 text-sm text-slate-600">
              The tenant receives an invite link they can use to register and link to your
              workspace.
            </p>
            <form action={createTenantGuidedAction} className="mt-4 space-y-4">
              <input type="hidden" name="mode" value="invite" />
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm">
                  <span className="font-medium text-slate-700">Tenant email *</span>
                  <input
                    required
                    name="email"
                    type="email"
                    className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-slate-700">Assign unit (optional)</span>
                  <select
                    name="unitId"
                    className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                  >
                    <option value="">No unit yet</option>
                    {units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {unit.property.name} / {unit.unitName}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                <button
                  name="nextStep"
                  value="onboarding"
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Send invite & return to onboarding
                </button>
                <button className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">
                  Send invite & view tenants
                </button>
              </div>
            </form>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Add a tenant manually</h3>
            <p className="mt-1 text-sm text-slate-600">
              Use this if you are tracking an existing tenant who will not register themselves.
            </p>
            <form action={createTenantGuidedAction} className="mt-4 space-y-4">
              <input type="hidden" name="mode" value="manual" />
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block text-sm">
                  <span className="font-medium text-slate-700">Full name *</span>
                  <input
                    required
                    name="fullName"
                    className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-slate-700">Email *</span>
                  <input
                    required
                    name="email"
                    type="email"
                    className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-slate-700">Phone</span>
                  <input
                    name="phone"
                    className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-slate-700">Employer</span>
                  <input
                    name="employer"
                    className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-slate-700">Emergency contact name</span>
                  <input
                    name="emergencyContactName"
                    className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="block text-sm">
                  <span className="font-medium text-slate-700">Emergency contact phone</span>
                  <input
                    name="emergencyContactPhone"
                    className="mt-1 block w-full rounded border border-slate-300 px-3 py-2"
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
                <button
                  name="nextStep"
                  value="onboarding"
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Save & return to onboarding
                </button>
                <button className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800">
                  Save & view tenant
                </button>
              </div>
            </form>
          </section>

          <div>
            <Link
              href="/onboarding"
              className="text-sm font-semibold text-slate-600 hover:text-slate-900"
            >
              ← Back to onboarding
            </Link>
          </div>
        </div>
        <OnboardingWizardSidebar state={state} activeKey="tenant" />
      </div>
    </Shell>
  );
}
