import Link from 'next/link';
import type { OnboardingMilestoneKey, OnboardingState } from '@/lib/onboarding/state';

export function OnboardingWizardSidebar({
  state,
  activeKey,
}: {
  state: OnboardingState;
  activeKey: OnboardingMilestoneKey;
}) {
  return (
    <aside className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 text-sm shadow-sm">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-600">
          Setup progress
        </p>
        <p className="mt-1 text-xl font-bold text-slate-900">
          {state.completedCount}/{state.totalCount} milestones
        </p>
      </div>
      <ol className="space-y-2">
        {state.milestones.map((milestone, index) => {
          const isActive = milestone.key === activeKey;
          return (
            <li
              key={milestone.key}
              className={`flex items-start gap-2 rounded-xl border px-3 py-2 ${
                isActive
                  ? 'border-cyan-300 bg-cyan-50'
                  : milestone.completed
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-slate-200 bg-white'
              }`}
            >
              <span
                className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold ${
                  milestone.completed
                    ? 'bg-emerald-600 text-white'
                    : isActive
                    ? 'bg-cyan-600 text-white'
                    : 'bg-slate-200 text-slate-700'
                }`}
              >
                {milestone.completed ? '✓' : index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  href={milestone.href}
                  className={`block text-sm font-medium ${
                    isActive ? 'text-cyan-900' : 'text-slate-800 hover:underline'
                  }`}
                >
                  {milestone.title}
                </Link>
              </div>
            </li>
          );
        })}
      </ol>
      <Link
        href="/onboarding"
        className="block rounded-2xl border border-slate-200 px-3 py-2 text-center text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        Back to onboarding
      </Link>
    </aside>
  );
}
