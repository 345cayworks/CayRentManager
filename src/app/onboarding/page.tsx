import Link from 'next/link';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { getOnboardingState } from '@/lib/onboarding/state';
import { getEffectiveTimezone } from '@/lib/time/effective';
import { formatDate as formatDateHelper } from '@/lib/time/format';
import {
  dismissOnboardingAction,
  markOnboardingCompleteAction,
  restoreOnboardingAction,
} from '@/server/actions';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const { landlordId } = await getCurrentLandlordWorkspace();
  const state = await getOnboardingState(landlordId);
  const tz = await getEffectiveTimezone();
  const formatDate = (value: Date | null | undefined) =>
    value ? formatDateHelper(value, tz) : null;

  const allDone = state.completedCount === state.totalCount;

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
              <p className="text-xs uppercase tracking-wide text-slate-300">Setup Progress</p>
              <p className="mt-3 text-5xl font-black">
                {state.completedCount}/{state.totalCount}
              </p>
              <p className="mt-2 text-sm text-slate-300">onboarding milestones completed</p>
            </div>
          </div>
        </section>

        {state.isDismissed ? (
          <section className="flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900 lg:flex-row lg:items-center lg:justify-between">
            <p>
              Onboarding nudges are hidden. You can re-enable the checklist at any time.
            </p>
            <form action={restoreOnboardingAction}>
              <button className="rounded-2xl bg-amber-900 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-800">
                Restore onboarding
              </button>
            </form>
          </section>
        ) : null}

        {state.isComplete ? (
          <section className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-emerald-900">Setup complete</h2>
            <p className="mt-2 text-sm text-emerald-800">
              {state.completedAt
                ? `Marked complete on ${formatDate(state.completedAt)}.`
                : 'All onboarding milestones are done.'}
            </p>
            <form action={restoreOnboardingAction} className="mt-4">
              <button className="rounded-2xl border border-emerald-700 bg-white px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100">
                Re-open setup
              </button>
            </form>
          </section>
        ) : (
          <section className="grid gap-4 lg:grid-cols-2">
            {state.milestones.map((milestone) => (
              <div
                key={milestone.key}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-xl font-semibold text-slate-900">{milestone.title}</h2>
                      {milestone.completed ? (
                        <span aria-label="Completed" className="text-emerald-600">
                          ✓
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{milestone.description}</p>
                  </div>
                </div>
                <div className="mt-6 flex items-center justify-between">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      milestone.completed
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {milestone.completed ? 'Completed' : 'Pending'}
                  </span>
                  <Link
                    href={milestone.href}
                    className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    {milestone.completed ? 'Manage' : 'Start'}
                  </Link>
                </div>
              </div>
            ))}
          </section>
        )}

        {!state.isComplete ? (
          <section className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Wrap up onboarding</h3>
              <p className="mt-1 text-sm text-slate-600">
                Mark setup complete once every milestone is done, or hide the checklist if you want to come back later.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <form action={markOnboardingCompleteAction}>
                <button
                  disabled={!allDone}
                  className={`rounded-2xl px-5 py-3 text-sm font-semibold text-white transition ${
                    allDone
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'cursor-not-allowed bg-slate-300'
                  }`}
                >
                  Mark setup complete
                </button>
              </form>
              {!state.isDismissed ? (
                <form action={dismissOnboardingAction}>
                  <button className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    Hide onboarding
                  </button>
                </form>
              ) : null}
            </div>
          </section>
        ) : null}

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
