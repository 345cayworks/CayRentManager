import Link from 'next/link';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';

const setupSteps = [
  {
    title: 'Add Your First Property',
    description: 'Create your first property profile and organize your portfolio.',
    href: '/properties/new',
    icon: '🏢',
  },
  {
    title: 'Create Units',
    description: 'Add apartments, condos, rooms, or commercial spaces.',
    href: '/units/new',
    icon: '🏠',
  },
  {
    title: 'Invite Tenants',
    description: 'Add tenants and prepare lease assignments.',
    href: '/tenants/new',
    icon: '👥',
  },
  {
    title: 'Activate Maintenance Tracking',
    description: 'Enable work orders, maintenance vendors, and operational tracking.',
    href: '/maintenance',
    icon: '🛠️',
  },
];

export default async function OnboardingPage() {
  const { landlordId } = await getCurrentLandlordWorkspace();

  const [propertyCount, unitCount, tenantCount, leaseCount] = await Promise.all([
    prisma.property.count({ where: { landlordId } }),
    prisma.unit.count({ where: { landlordId } }),
    prisma.tenant.count({ where: { landlordId } }),
    prisma.lease.count({ where: { landlordId } }),
  ]);

  const completedSteps = [
    propertyCount > 0,
    unitCount > 0,
    tenantCount > 0,
    leaseCount > 0,
  ].filter(Boolean).length;

  return (
    <Shell title="Welcome to CayRentManager">
      <div className="space-y-8">
        <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
                Professional Property Operations
              </p>

              <h1 className="mt-3 text-4xl font-black tracking-tight">
                Welcome to CayRentManager
              </h1>

              <p className="mt-4 max-w-2xl text-sm text-slate-300">
                Your landlord workspace is ready. Complete the onboarding checklist below to activate your portfolio operations center.
              </p>
            </div>

            <div className="rounded-3xl bg-white/10 p-6 backdrop-blur">
              <p className="text-xs uppercase tracking-wide text-slate-300">
                Setup Progress
              </p>

              <p className="mt-3 text-5xl font-black">
                {completedSteps}/4
              </p>

              <p className="mt-2 text-sm text-slate-300">
                onboarding milestones completed
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          {setupSteps.map((step, index) => {
            const completed =
              (index === 0 && propertyCount > 0) ||
              (index === 1 && unitCount > 0) ||
              (index === 2 && tenantCount > 0) ||
              (index === 3 && leaseCount > 0);

            return (
              <div
                key={step.title}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-2xl">
                      {step.icon}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-xl font-semibold text-slate-900">
                          {step.title}
                        </h2>

                        {completed ? (
                          <span className="text-emerald-600">✓</span>
                        ) : null}
                      </div>

                      <p className="mt-2 text-sm text-slate-500">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex items-center justify-between">
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${completed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    {completed ? 'Completed' : 'Pending'}
                  </span>

                  <Link
                    href={step.href}
                    className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    {completed ? 'Manage' : 'Start'}
                  </Link>
                </div>
              </div>
            );
          })}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900">
                Ready to manage your portfolio?
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Jump directly into leases, maintenance tracking, alerts, and accounting operations.
              </p>
            </div>

            <Link
              href="/dashboard"
              className="rounded-2xl bg-cyan-600 px-6 py-4 text-sm font-semibold text-white transition hover:bg-cyan-500"
            >
              Open Dashboard
            </Link>
          </div>
        </section>
      </div>
    </Shell>
  );
}
