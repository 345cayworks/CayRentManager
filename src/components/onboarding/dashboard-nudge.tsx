import Link from 'next/link';
import type { OnboardingState } from '@/lib/onboarding/state';
import { dismissOnboardingAction } from '@/server/actions';

export function OnboardingNudge({ state }: { state: OnboardingState }) {
  if (!state.shouldNudge) return null;

  return (
    <section className="mb-4 rounded-3xl border border-cyan-200 bg-gradient-to-br from-cyan-50 to-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-700">
            Setup progress {state.completedCount}/{state.totalCount}
          </p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">
            Finish setting up your workspace
          </h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {state.milestones.map((milestone) => (
              <li
                key={milestone.key}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  milestone.completed
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {milestone.completed ? '✓ ' : ''}
                {milestone.title}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/onboarding"
            className="rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Continue setup
          </Link>
          <form action={dismissOnboardingAction}>
            <button className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Hide
            </button>
          </form>
        </div>
      </div>
    </section>
  );
}
